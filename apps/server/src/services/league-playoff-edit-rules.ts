/**
 * Édition d'un bracket de play-offs de LIGUE déjà généré — règles PURES.
 *
 * Deux leviers du commissaire, qui ne se chevauchent pas :
 *
 *  - RÉINITIALISER : tant qu'aucune rencontre du bracket n'est engagée, on
 *    supprime tous les tours de bracket ; la taille redevient éditable et
 *    le commissaire relance. C'est la réponse à « j'ai choisi une finale à
 *    2, je veux un carré final ».
 *  - REMPLACER un qualifié dans UNE rencontre non engagée, même si d'autres
 *    rencontres du bracket sont jouées. C'est la réponse à « le 2e a quitté
 *    la ligue, je ne peux pas mettre le 3e ». L'éditeur complet existant
 *    (`overridePlayoffParticipants`) reste le levier quand rien n'est joué.
 *
 * Le service charge, ce module décide : aucune I/O, testable sans Prisma.
 */

/** Rencontre ENCORE OUVERTE (aucun résultat). */
export const OPEN_PLAYOFF_PAIRING_STATUSES: ReadonlySet<string> = new Set([
  "scheduled",
  "in_progress",
]);

/**
 * Statuts de feuille qui disent qu'un résultat a été saisi : soumise par un
 * coach, par les deux, validée, ou en correction après invalidation.
 */
const SHEET_ENGAGED_STATUSES: ReadonlySet<string> = new Set([
  "submitted_home",
  "submitted_away",
  "both_submitted",
  "validated",
  "invalidated",
]);

/** Une rencontre de bracket telle que les décisions doivent la lire. */
export interface PlayoffPairingState {
  readonly id: string;
  readonly status: string;
  readonly homeParticipantId: string;
  readonly awayParticipantId: string;
  /** Match en ligne rattaché (`Match.leaguePairingId`), null sinon. */
  readonly matchId: string | null;
  /** Statut de la feuille de match, null si aucune feuille n'existe. */
  readonly sheetStatus: string | null;
  /** Nombre d'évènements saisis sur la feuille (0 sans feuille). */
  readonly sheetEventCount: number;
}

/**
 * Une rencontre est ENGAGÉE dès que quelque chose a été joué ou saisi :
 * résultat (statut terminal hors annulation), match en ligne lancé, feuille
 * soumise / validée / invalidée, ou brouillon qui porte déjà des évènements.
 * Une feuille en brouillon VIDE ne compte pas : elle n'est qu'un gel des
 * rosters, recréé à la prochaine ouverture.
 */
export function isPlayoffPairingEngaged(p: PlayoffPairingState): boolean {
  if (p.status !== "scheduled" && p.status !== "cancelled") return true;
  if (p.matchId) return true;
  if (p.sheetStatus && SHEET_ENGAGED_STATUSES.has(p.sheetStatus)) return true;
  return p.sheetEventCount > 0;
}

/** Convention de bracket : une rencontre dont un seul côté est connu. */
export function isPlaceholderPairing(p: {
  readonly homeParticipantId: string;
  readonly awayParticipantId: string;
}): boolean {
  return p.homeParticipantId === p.awayParticipantId;
}

// ───────────────────────────── Réinitialisation ─────────────────────────────

export type PlayoffResetRefusal =
  | "season_completed"
  | "no_bracket"
  | "bracket_engaged";

export type PlayoffResetDecision =
  | { readonly ok: true; readonly roundCount: number }
  | {
      readonly ok: false;
      readonly code: PlayoffResetRefusal;
      readonly message: string;
      /** Rencontres qui bloquent (pour `bracket_engaged`). */
      readonly engagedPairingIds?: readonly string[];
    };

export function decidePlayoffReset(input: {
  readonly seasonStatus: string;
  readonly rounds: ReadonlyArray<{
    readonly pairings: readonly PlayoffPairingState[];
  }>;
}): PlayoffResetDecision {
  if (input.seasonStatus === "completed") {
    return {
      ok: false,
      code: "season_completed",
      message: "Saison clôturée : le bracket ne peut plus être réinitialisé",
    };
  }
  if (input.rounds.length === 0) {
    return {
      ok: false,
      code: "no_bracket",
      message: "Aucun bracket de play-offs à réinitialiser",
    };
  }
  const engaged = input.rounds
    .flatMap((r) => r.pairings)
    .filter(isPlayoffPairingEngaged)
    .map((p) => p.id);
  if (engaged.length > 0) {
    return {
      ok: false,
      code: "bracket_engaged",
      message:
        "Une rencontre de play-off est déjà jouée ou en cours de saisie : remplacez plutôt le qualifié dans la rencontre concernée",
      engagedPairingIds: engaged,
    };
  }
  return { ok: true, roundCount: input.rounds.length };
}
