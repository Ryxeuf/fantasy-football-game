/**
 * Réengagement — Phase B : construction PURE du digest e-mail
 * hebdomadaire + sélection des destinataires.
 *
 * Tout ici est testable sans I/O : le builder prend des données déjà
 * chargées et produit `{ subject, text, html }` ; la sélection des
 * destinataires filtre sur l'opt-in + une fenêtre d'idempotence (ne pas
 * ré-envoyer deux fois la même semaine).
 *
 * Le loader Prisma + l'envoi réel vivent dans `weekly-digest-job.ts`.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DigestTeamSummary {
  readonly name: string;
}

export interface DigestData {
  readonly coachName: string;
  readonly email: string;
  /** Équipes du coach (peut être vide). */
  readonly teams: readonly DigestTeamSummary[];
  /** Nb de matchs async où c'est au coach de jouer (actions en attente). */
  readonly pendingMatchCount: number;
  /** Titre de la dernière Gazette (récap IA), si disponible. */
  readonly gazetteHeadline: string | null;
  /** Lien de désinscription signé (RGPD). */
  readonly unsubscribeUrl: string;
  /** URL de base de l'app pour le CTA (ex: "https://nufflearena.fr"). */
  readonly appUrl: string;
}

export interface DigestEmail {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

// ---------------------------------------------------------------------------
// Builder (pur)
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Construit le digest e-mail pour un coach. 100% pur.
 *
 * Le sujet reflète l'élément le plus actionnable : s'il y a des actions
 * en attente, on le met en avant (levier de réengagement).
 */
export function buildDigestEmail(data: DigestData): DigestEmail {
  const teamNames = data.teams.map((t) => t.name);
  const hasPending = data.pendingMatchCount > 0;

  const subject = hasPending
    ? `Nuffle Arena — ${data.pendingMatchCount} match${
        data.pendingMatchCount > 1 ? "s" : ""
      } vous attend${data.pendingMatchCount > 1 ? "ent" : ""} !`
    : "Nuffle Arena — votre brève hebdomadaire";

  // ----- Texte brut -----
  const textLines: string[] = [];
  textLines.push(`Bonjour ${data.coachName},`);
  textLines.push("");
  if (hasPending) {
    textLines.push(
      `⚔️  ${data.pendingMatchCount} match${
        data.pendingMatchCount > 1 ? "s" : ""
      } async attend${data.pendingMatchCount > 1 ? "ent" : ""} votre coup. ` +
        "Vos adversaires n'attendent que vous !",
    );
    textLines.push("");
  }
  if (teamNames.length > 0) {
    textLines.push("Vos équipes :");
    for (const name of teamNames) {
      textLines.push(`  • ${name}`);
    }
    textLines.push("");
  }
  if (data.gazetteHeadline) {
    textLines.push(`📰  À la une de la Gazette : ${data.gazetteHeadline}`);
    textLines.push("");
  }
  if (!hasPending && teamNames.length === 0 && !data.gazetteHeadline) {
    textLines.push(
      "Le terrain vous attend : créez une équipe et lancez votre première " +
        "saison sur Nuffle Arena.",
    );
    textLines.push("");
  }
  textLines.push(`Revenir jouer : ${data.appUrl}`);
  textLines.push("");
  textLines.push(
    `Se désinscrire de ce digest : ${data.unsubscribeUrl}`,
  );
  const text = textLines.join("\n");

  // ----- HTML (style parchemin sobre, inline pour compat clients mail) -----
  const teamItems = teamNames
    .map((n) => `<li style="margin:2px 0;">${escapeHtml(n)}</li>`)
    .join("");

  const pendingBlock = hasPending
    ? `<p style="font-size:16px;margin:0 0 16px;">⚔️ <strong>${
        data.pendingMatchCount
      }</strong> match${
        data.pendingMatchCount > 1 ? "s" : ""
      } async attend${
        data.pendingMatchCount > 1 ? "ent" : ""
      } votre coup. Vos adversaires n'attendent que vous&nbsp;!</p>`
    : "";

  const teamsBlock =
    teamNames.length > 0
      ? `<p style="font-size:15px;margin:0 0 6px;"><strong>Vos équipes</strong></p><ul style="margin:0 0 16px;padding-left:20px;color:#2C2416;">${teamItems}</ul>`
      : "";

  const gazetteBlock = data.gazetteHeadline
    ? `<p style="font-size:15px;margin:0 0 16px;">📰 <strong>À la une de la Gazette&nbsp;:</strong> ${escapeHtml(
        data.gazetteHeadline,
      )}</p>`
    : "";

  const emptyBlock =
    !hasPending && teamNames.length === 0 && !data.gazetteHeadline
      ? `<p style="font-size:15px;margin:0 0 16px;">Le terrain vous attend&nbsp;: créez une équipe et lancez votre première saison.</p>`
      : "";

  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#2C2416;">
  <div style="max-width:600px;margin:0 auto;padding:24px;background:#F5ECD7;color:#2C2416;font-family:Georgia,'Times New Roman',serif;">
    <h1 style="font-size:22px;margin:0 0 16px;color:#7A5C1E;">Nuffle Arena</h1>
    <p style="font-size:16px;margin:0 0 16px;">Bonjour <strong>${escapeHtml(
      data.coachName,
    )}</strong>,</p>
    ${pendingBlock}
    ${teamsBlock}
    ${gazetteBlock}
    ${emptyBlock}
    <p style="margin:24px 0;">
      <a href="${escapeHtml(
        data.appUrl,
      )}" style="display:inline-block;background:#CB9E35;color:#2C2416;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:bold;">Revenir jouer</a>
    </p>
    <hr style="border:none;border-top:1px solid #d8c9a3;margin:24px 0;">
    <p style="font-size:12px;color:#7a6f57;margin:0;">
      Vous recevez cet e-mail car vous avez activé le digest hebdomadaire.
      <a href="${escapeHtml(
        data.unsubscribeUrl,
      )}" style="color:#7a6f57;">Se désinscrire</a>.
    </p>
  </div>
</body></html>`;

  return { subject, text, html };
}

// ---------------------------------------------------------------------------
// Sélection des destinataires (pur) — opt-in + idempotence
// ---------------------------------------------------------------------------

export interface DigestRecipientRow {
  readonly userId: string;
  readonly enabled: boolean;
  readonly lastSentAt: Date | null;
}

/** Fenêtre d'idempotence par défaut : 6 jours (digest hebdomadaire). */
export const DIGEST_IDEMPOTENCE_WINDOW_MS = 6 * 24 * 60 * 60 * 1000;

/**
 * Filtre les lignes éligibles à un envoi : opt-in actif ET pas déjà
 * envoyé dans la fenêtre d'idempotence. Pur — garantit qu'un re-run du
 * job le même jour ne ré-envoie pas.
 */
export function selectStaleRecipients(
  rows: readonly DigestRecipientRow[],
  now: Date,
  windowMs: number = DIGEST_IDEMPOTENCE_WINDOW_MS,
): readonly DigestRecipientRow[] {
  const nowMs = now.getTime();
  return rows.filter((r) => {
    if (!r.enabled) return false;
    if (r.lastSentAt === null) return true;
    return nowMs - r.lastSentAt.getTime() >= windowMs;
  });
}
