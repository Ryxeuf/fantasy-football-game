/**
 * Phase 6 — A2 : notification du coach invité dans une ligue.
 *
 * `createInvitation` (cf. `league-invitation.ts`) crée l'invitation mais
 * n'avertissait personne. Ce service comble ce trou : à la création d'une
 * NOUVELLE invitation, on prévient le coach ciblé via push (+ e-mail s'il a
 * une adresse) ou par e-mail seul (invitation ciblée e-mail hors plateforme).
 *
 * Trois cas de ciblage (cf. modèle `LeagueInvitation`) :
 *   1. `inviteeUserId` défini → push à l'utilisateur + e-mail si adresse connue.
 *   2. `inviteeEmail` défini (et pas d'userId) → e-mail à cette adresse.
 *   3. Aucun des deux (lien public par `code` seul) → aucune notification.
 *
 * ROBUSTESSE (pattern CLAUDE.md « Hook post-settlement encapsulé ») : la
 * notification est un effet secondaire. Tout échec push/e-mail/lookup est
 * capturé et loggé via `serverLog.error` — la fonction NE THROW JAMAIS, pour
 * ne jamais compromettre la création de l'invitation côté appelant.
 */

import { prisma } from "../prisma";
import { sendPushToUser, type PushPayload } from "./push-notifications";
import { sendEmail } from "./mailer";
import { serverLog } from "../utils/server-log";

/**
 * Sous-ensemble structurel de `LeagueInvitation` dont le service a besoin.
 * On ne dépend pas du type Prisma complet : seuls les champs de ciblage et
 * le code comptent, ce qui rend l'appel testable et tolérant.
 */
export interface InvitationNotifyTarget {
  readonly inviteeUserId?: string | null;
  readonly inviteeEmail?: string | null;
  readonly code?: string | null;
}

export interface NotifyInvitedCoachParams {
  readonly invitation: InvitationNotifyTarget;
  readonly leagueName: string;
  /**
   * Origine web absolue (ex. `https://web.nuffle-arena.orb.local`) servant à
   * construire le lien de rejoindre `${baseUrl}/leagues/invitations/${code}`.
   * Optionnel : sans lui, l'e-mail retombe sur le code brut.
   */
  readonly baseUrl?: string | null;
}

const NOTIFY_TITLE = "Invitation à une ligue";

function buildBody(leagueName: string): string {
  return `Tu es invité à rejoindre la ligue « ${leagueName} »`;
}

/**
 * Construit le lien public d'acceptation à partir de l'origine web et du code.
 * Retourne `null` si l'un des deux manque.
 */
export function buildJoinUrl(
  baseUrl?: string | null,
  code?: string | null,
): string | null {
  if (!baseUrl || !code) return null;
  return `${baseUrl.replace(/\/+$/, "")}/leagues/invitations/${code}`;
}

/**
 * Construit le corps texte de l'e-mail. Privilégie un LIEN cliquable de
 * rejoindre (point d'entrée principal) ; le code reste mentionné en repli
 * pour la saisie manuelle. Sans `baseUrl`, on retombe sur le code seul.
 */
function buildEmailText(
  leagueName: string,
  code?: string | null,
  baseUrl?: string | null,
): string {
  const base = buildBody(leagueName);
  const url = buildJoinUrl(baseUrl, code);
  if (url) {
    return (
      `${base}.\n\n` +
      `Pour rejoindre la ligue, clique sur ce lien :\n${url}\n\n` +
      `Si tu n'es pas encore connecté, tu pourras te connecter puis ` +
      `rejoindre directement.\n\n` +
      `(Code d'invitation à saisir manuellement : ${code})`
    );
  }
  if (code) {
    return `${base}.\n\nCode d'invitation : ${code}`;
  }
  return `${base}.`;
}

async function notifyByUserId(
  userId: string,
  leagueName: string,
  code?: string | null,
  baseUrl?: string | null,
): Promise<void> {
  const payload: PushPayload = {
    title: NOTIFY_TITLE,
    body: buildBody(leagueName),
    icon: "/images/favicon-optimized.png",
    url: "/leagues",
    tag: `league-invitation-${userId}`,
    data: { kind: "leagueInvitation", url: "/leagues" },
  };

  // Push : toléré, capturé indépendamment de l'e-mail.
  try {
    await sendPushToUser(userId, payload);
  } catch (e: unknown) {
    serverLog.error(
      `[league-invitation-notify] push failed for user ${userId}`,
      e,
    );
  }

  // E-mail : nécessite une adresse — lookup utilisateur.
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, coachName: true },
    });
    if (user?.email) {
      await sendEmail({
        to: user.email,
        subject: NOTIFY_TITLE,
        text: buildEmailText(leagueName, code, baseUrl),
      });
    }
  } catch (e: unknown) {
    serverLog.error(
      `[league-invitation-notify] email failed for user ${userId}`,
      e,
    );
  }
}

async function notifyByEmail(
  email: string,
  leagueName: string,
  code?: string | null,
  baseUrl?: string | null,
): Promise<void> {
  try {
    await sendEmail({
      to: email,
      subject: NOTIFY_TITLE,
      text: buildEmailText(leagueName, code, baseUrl),
    });
  } catch (e: unknown) {
    serverLog.error(
      `[league-invitation-notify] email failed for address ${email}`,
      e,
    );
  }
}

/**
 * Notifie le coach invité. Ne throw jamais (cf. doc en tête de fichier).
 *
 * - `inviteeUserId` présent → push + e-mail (si adresse connue).
 * - sinon `inviteeEmail` présent → e-mail seul.
 * - sinon → aucun effet (invitation par code public).
 */
export async function notifyInvitedCoach(
  params: NotifyInvitedCoachParams,
): Promise<void> {
  const { invitation, leagueName, baseUrl } = params;
  try {
    if (invitation.inviteeUserId) {
      await notifyByUserId(
        invitation.inviteeUserId,
        leagueName,
        invitation.code,
        baseUrl,
      );
      return;
    }
    if (invitation.inviteeEmail) {
      await notifyByEmail(
        invitation.inviteeEmail,
        leagueName,
        invitation.code,
        baseUrl,
      );
      return;
    }
    // Invitation par code public : pas de cible à notifier.
  } catch (e: unknown) {
    // Ceinture finale : aucune exception ne doit remonter.
    serverLog.error("[league-invitation-notify] unexpected failure", e);
  }
}
