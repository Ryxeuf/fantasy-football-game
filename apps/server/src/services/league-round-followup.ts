/**
 * Relance d'une journée de ligue : à qui écrire, et pourquoi.
 *
 * Le commissaire d'une ligue passe son temps à courir après deux choses, et
 * n'a pour cela qu'un fil de discussion hors application :
 *
 *  1. les rencontres que personne n'a **planifiées** (pas de date convenue) ;
 *  2. les rencontres dont la **date est passée** sans qu'une feuille de match
 *     lui soit parvenue.
 *
 * Ce module est la partie PURE de la relance : à partir des rencontres d'une
 * journée et de l'instant courant, il dit lesquelles sont en retard, dans
 * quel cas, et rédige le message. Aucune I/O — l'envoi vit dans
 * `league-round-followup-notify.ts`, ce qui rend les règles (et les textes
 * validés par le commissaire) testables sans Prisma ni transport e-mail.
 */

/** Cas de relance. L'ordre est celui du déroulé d'une rencontre. */
export type ReminderReason = "not_scheduled" | "sheet_overdue";

/**
 * Statuts pour lesquels une rencontre reste « à jouer ». Un forfait, une
 * annulation ou un match joué ne se relance pas. Miroir de `OPEN_STATUSES`
 * dans `league-pairing-schedule`.
 */
const OPEN_STATUSES: ReadonlySet<string> = new Set(["scheduled", "in_progress"]);

/**
 * Statuts de feuille qui valent « le commissaire a de quoi travailler ».
 * Une feuille en brouillon ne lui est PAS parvenue : elle n'éteint pas la
 * relance. Une feuille invalidée ne compte pas non plus — elle est
 * précisément revenue aux coachs.
 */
const SHEET_DELIVERED_STATUSES: ReadonlySet<string> = new Set([
  "submitted_home",
  "submitted_away",
  "both_submitted",
  "validated",
]);

/** Ce que la relance a besoin de savoir d'une rencontre. */
export interface ReminderPairing {
  readonly id: string;
  readonly status: string;
  /** Date prévisionnelle convenue, `null` si la rencontre n'est pas planifiée. */
  readonly scheduledAt: Date | null;
  /** Statut de la feuille de match, `null`/absent si aucune feuille ouverte. */
  readonly matchSheetStatus?: string | null;
}

/** Une rencontre retenue pour relance, avec son motif. */
export interface ReminderTarget<P extends ReminderPairing = ReminderPairing> {
  readonly pairing: P;
  readonly reason: ReminderReason;
}

/**
 * Rencontres à relancer dans une journée, et pourquoi.
 *
 * - `not_scheduled` : rencontre encore ouverte, sans date convenue.
 * - `sheet_overdue` : rencontre encore ouverte, date convenue DÉPASSÉE, et
 *   aucune feuille parvenue au commissaire.
 *
 * Une rencontre planifiée dont la date n'est pas encore passée n'est pas en
 * retard : elle ne relève d'aucun des deux cas.
 */
export function selectReminderTargets<P extends ReminderPairing>(
  pairings: readonly P[],
  now: Date = new Date(),
): ReminderTarget<P>[] {
  const targets: ReminderTarget<P>[] = [];
  for (const pairing of pairings) {
    if (!OPEN_STATUSES.has(pairing.status)) continue;
    if (!pairing.scheduledAt) {
      targets.push({ pairing, reason: "not_scheduled" });
      continue;
    }
    if (pairing.scheduledAt.getTime() > now.getTime()) continue;
    const sheet = pairing.matchSheetStatus ?? null;
    if (sheet && SHEET_DELIVERED_STATUSES.has(sheet)) continue;
    targets.push({ pairing, reason: "sheet_overdue" });
  }
  return targets;
}

/**
 * Corps du message, au mot près tel que le commissaire l'a formulé. Ce sont
 * des CONSTANTES, pas des gabarits : la relance doit dire la même chose à
 * tout le monde, à chaque journée.
 */
export const REMINDER_BODIES: Readonly<Record<ReminderReason, string>> = {
  not_scheduled:
    "Ton match de la journée en cours n'est pas encore planifié. Contacte " +
    "rapidement ton adversaire pour fixer une date ou le commissaire pour " +
    "signaler tout PB. Merci",
  sheet_overdue:
    "La feuille de match de la journée en cours n'est pas parvenue au " +
    "commissaire alors que le match a dû se dérouler. Merci de faire le " +
    "nécessaire rapidement et de prévenir le commissaire",
};

/** Objet de l'e-mail / titre de la notification, par motif. */
export const REMINDER_SUBJECTS: Readonly<Record<ReminderReason, string>> = {
  not_scheduled: "Match non planifié",
  sheet_overdue: "Feuille de match attendue",
};

export interface ReminderContext {
  /** Nom de la ligue (« Ligue du Mordorbihan »). */
  readonly leagueName: string;
  /** Numéro de journée (`LeagueRound.roundNumber`). */
  readonly roundNumber: number;
  /** Libellé de la rencontre (« Reikland vs Skavenblight »). */
  readonly matchLabel: string;
  /** Lien web absolu vers la ligue, si l'origine est connue. */
  readonly leagueUrl?: string | null;
}

/**
 * Corps de l'e-mail : le message du commissaire, encadré du strict minimum
 * pour que le destinataire sache DE QUEL match on parle (un coach peut jouer
 * plusieurs ligues) et où agir.
 */
export function buildReminderEmailText(
  reason: ReminderReason,
  context: ReminderContext,
): string {
  const header = `${context.leagueName} — Journée ${context.roundNumber}\n${context.matchLabel}`;
  const link = context.leagueUrl
    ? `\n\nVoir la journée : ${context.leagueUrl}`
    : "";
  return `${header}\n\n${REMINDER_BODIES[reason]}${link}`;
}

/** Objet de l'e-mail : motif + ligue, pour qu'il se lise dans une boîte. */
export function buildReminderSubject(
  reason: ReminderReason,
  context: Pick<ReminderContext, "leagueName" | "roundNumber">,
): string {
  return `[${context.leagueName}] J${context.roundNumber} — ${REMINDER_SUBJECTS[reason]}`;
}
