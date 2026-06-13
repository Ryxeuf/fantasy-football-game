/**
 * Réengagement — Phase B : job d'envoi du digest e-mail hebdomadaire.
 *
 * Orchestration (impure : Prisma + mailer) :
 *   1. charge les préférences opt-in (`EmailDigestPreference.enabled`)
 *   2. filtre via `selectStaleRecipients` (idempotence : pas de
 *      double-envoi dans la fenêtre)
 *   3. pour chaque destinataire : charge ses données, construit l'e-mail
 *      (builder pur), envoie via le mailer, puis marque `lastSentAt`
 *
 * Idempotence : `lastSentAt` est mis à jour pour chaque destinataire
 * *traité* (tenté), donc un re-run le même jour les saute. Cadence
 * hebdomadaire ⇒ un éventuel échec transitoire de mail est toléré
 * jusqu'à la semaine suivante.
 *
 * Le loader et l'envoi réel ne sont validables qu'en prod (transport
 * SMTP réel + vraies adresses). Les briques pures (builder, sélection,
 * token) sont testées en unit.
 */

import { prisma } from "../prisma";
import { serverLog } from "../utils/server-log";
import { sendEmail } from "./mailer";
import {
  buildUnsubscribeToken,
  getUnsubscribeSecret,
} from "./email-unsubscribe-token";
import { listLatestEdition } from "./pro-gazette";
import {
  buildDigestEmail,
  selectStaleRecipients,
  type DigestData,
  type DigestRecipientRow,
  DIGEST_IDEMPOTENCE_WINDOW_MS,
} from "./weekly-digest";

/** URL publique de l'app web pour le CTA "revenir jouer". */
function getAppUrl(): string {
  return (
    process.env.PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "https://nufflearena.fr"
  );
}

/**
 * URL publique de l'API (serveur Express) pour le lien de
 * désinscription, qui est servi directement par cette app.
 */
function getApiUrl(): string {
  return (
    process.env.PUBLIC_API_URL ||
    process.env.API_URL ||
    getAppUrl()
  );
}

function buildUnsubscribeUrl(userId: string): string {
  const token = buildUnsubscribeToken(userId, getUnsubscribeSecret());
  return `${getApiUrl().replace(/\/$/, "")}/email/unsubscribe?token=${encodeURIComponent(
    token,
  )}`;
}

// ---------------------------------------------------------------------------
// Loader (impur, best-effort)
// ---------------------------------------------------------------------------

/**
 * Charge les données digest d'un coach. Retourne `null` si l'user est
 * absent ou n'a pas d'e-mail. Chaque agrégat optionnel est en try/catch
 * isolé pour dégrader proprement (un sous-échec ne casse pas le digest).
 */
export async function loadDigestData(
  userId: string,
  appUrl: string = getAppUrl(),
): Promise<DigestData | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, coachName: true },
  });
  if (!user || !user.email) return null;

  let teams: { name: string }[] = [];
  try {
    teams = await prisma.team.findMany({
      where: { userId },
      select: { name: true },
      orderBy: { createdAt: "asc" },
      take: 20,
    });
  } catch {
    teams = [];
  }

  let pendingMatchCount = 0;
  try {
    pendingMatchCount = await prisma.match.count({
      where: { mode: "async", status: "active", currentTurnUserId: userId },
    });
  } catch {
    pendingMatchCount = 0;
  }

  let gazetteHeadline: string | null = null;
  try {
    const edition = await listLatestEdition();
    gazetteHeadline = edition?.articles[0]?.title ?? null;
  } catch {
    gazetteHeadline = null;
  }

  return {
    coachName: user.coachName ?? "Coach",
    email: user.email,
    teams,
    pendingMatchCount,
    gazetteHeadline,
    unsubscribeUrl: buildUnsubscribeUrl(userId),
    appUrl,
  };
}

// ---------------------------------------------------------------------------
// Orchestrateur
// ---------------------------------------------------------------------------

export interface RunWeeklyDigestOptions {
  readonly now?: Date;
  readonly windowMs?: number;
  readonly appUrl?: string;
}

export interface RunWeeklyDigestResult {
  readonly selected: number;
  readonly sent: number;
  readonly failed: number;
}

export async function runWeeklyDigest(
  opts: RunWeeklyDigestOptions = {},
): Promise<RunWeeklyDigestResult> {
  const now = opts.now ?? new Date();
  const windowMs = opts.windowMs ?? DIGEST_IDEMPOTENCE_WINDOW_MS;
  const appUrl = opts.appUrl ?? getAppUrl();

  const rows: DigestRecipientRow[] = await prisma.emailDigestPreference.findMany(
    {
      where: { enabled: true },
      select: { userId: true, enabled: true, lastSentAt: true },
    },
  );

  const recipients = selectStaleRecipients(rows, now, windowMs);

  let sent = 0;
  let failed = 0;

  for (const r of recipients) {
    try {
      const data = await loadDigestData(r.userId, appUrl);
      if (!data) {
        // Pas d'e-mail / user absent : marque quand même pour ne pas
        // re-tenter en boucle ce destinataire chaque tick.
        await markSent(r.userId, now);
        continue;
      }
      const email = buildDigestEmail(data);
      const result = await sendEmail({
        to: data.email,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });
      if (result.delivered) sent++;
      else failed++;
      // Idempotence : marque traité quoi qu'il arrive.
      await markSent(r.userId, now);
    } catch (e: unknown) {
      failed++;
      const msg = e instanceof Error ? e.message : "unknown";
      serverLog.error(
        `[weekly-digest] échec pour user=${r.userId}: ${msg}`,
      );
    }
  }

  serverLog.info(
    `[weekly-digest] run: selected=${recipients.length} sent=${sent} failed=${failed}`,
  );
  return { selected: recipients.length, sent, failed };
}

async function markSent(userId: string, now: Date): Promise<void> {
  await prisma.emailDigestPreference.update({
    where: { userId },
    data: { lastSentAt: now },
  });
}
