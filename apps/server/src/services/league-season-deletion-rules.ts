/**
 * Suppression d'une SAISON de ligue — décision PURE.
 *
 * La cascade Prisma depuis `LeagueSeason` emporte poules, inscriptions,
 * journées, rencontres, feuilles, évènements, pronostics et palmarès. Elle ne
 * DÉFAIT pas ce qu'un résultat a écrit ailleurs : PSP, blessures, trésorerie
 * et fans des équipes (feuilles validées), séquences d'après-match, Couronnes
 * gagnées (`CrownsReward.periodKey = season:<id>`), compteurs de carrière.
 * Supprimer une saison jouée laisserait ces effets SANS leur source — plus
 * aucune invalidation possible pour les reprendre.
 *
 * Règle : la suppression n'est ouverte (commissaire ou admin) qu'à une
 * saison SANS AUCUN effet persisté. Une saison jouée se clôture, ou la ligue
 * s'archive.
 *
 *   - feuille validée — ou invalidée : elle l'a été un jour (Couronnes
 *     versées, journal d'équipe écrit) ;
 *   - `Match` reporté au classement (`leagueScoredAt`), en ligne compris ;
 *   - rencontre jouée ou forfait : un résultat saisi HORS feuille compte ;
 *   - séquence d'après-match (`LeaguePostMatchSequence.seasonId`).
 */

export type SeasonDeletionRefusalCode =
  | "forbidden"
  | "sheets_validated"
  | "matches_scored"
  | "results_recorded"
  | "post_match_sequences";

export interface SeasonDeletionInput {
  readonly actor: {
    readonly isCommissioner: boolean;
    readonly isAdmin: boolean;
  };
  /** Feuilles validées ou invalidées de la saison. */
  readonly validatedSheets: number;
  /** `Match` de la saison reportés au classement. */
  readonly scoredMatches: number;
  /** Rencontres `played` / `forfeit_home` / `forfeit_away`. */
  readonly resultPairings: number;
  /** Séquences d'après-match rattachées à la saison. */
  readonly postMatchSequences: number;
}

export type SeasonDeletionDecision =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly code: SeasonDeletionRefusalCode;
      readonly message: string;
    };

/** Statuts de rencontre porteurs d'un résultat (feuille ou saisie directe). */
export const RESULT_PAIRING_STATUSES: readonly string[] = [
  "played",
  "forfeit_home",
  "forfeit_away",
];

/** Statuts de feuille qui ont produit des effets (même repris depuis). */
export const EFFECTFUL_SHEET_STATUSES: readonly string[] = [
  "validated",
  "invalidated",
];

const PLAYED_HINT =
  "Une saison jouee ne se supprime pas : cloturez-la, ou archivez la ligue.";

export function decideSeasonDeletion(
  input: SeasonDeletionInput,
): SeasonDeletionDecision {
  if (!input.actor.isCommissioner && !input.actor.isAdmin) {
    return {
      allowed: false,
      code: "forbidden",
      message:
        "Seul le commissaire (createur) ou un administrateur peut supprimer une saison",
    };
  }
  if (input.validatedSheets > 0) {
    return {
      allowed: false,
      code: "sheets_validated",
      message: `Suppression impossible : ${input.validatedSheets} feuille(s) de match validee(s). ${PLAYED_HINT}`,
    };
  }
  if (input.resultPairings > 0) {
    return {
      allowed: false,
      code: "results_recorded",
      message: `Suppression impossible : ${input.resultPairings} resultat(s) enregistre(s) (match joue ou forfait). ${PLAYED_HINT}`,
    };
  }
  if (input.scoredMatches > 0) {
    return {
      allowed: false,
      code: "matches_scored",
      message: `Suppression impossible : ${input.scoredMatches} match(s) deja reporte(s) au classement. ${PLAYED_HINT}`,
    };
  }
  if (input.postMatchSequences > 0) {
    return {
      allowed: false,
      code: "post_match_sequences",
      message: `Suppression impossible : une sequence d'apres-match a deja ete jouee. ${PLAYED_HINT}`,
    };
  }
  return { allowed: true };
}
