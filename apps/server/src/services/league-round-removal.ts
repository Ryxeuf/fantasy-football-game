/**
 * Suppression d'une JOURNÉE de ligue par le commissaire — décision PURE.
 *
 * Une journée (`LeagueRound`) emporte en cascade ses rencontres, leurs
 * feuilles de match (et leurs évènements) et leurs pronostics ; les `Match`
 * qui la référencent passent à `NULL`. La cascade ne DÉFAIT rien de ce qu'un
 * résultat a déjà écrit (classement, PSP, trésorerie, Couronnes…). D'où la
 * règle : on ne supprime qu'une journée dont AUCUNE rencontre n'est engagée.
 *
 * Refus, dans l'ordre :
 *   - saison clôturée (le palmarès est figé) ;
 *   - journée de play-off — `kind = "playoff"` OU `bracketSlot` renseigné :
 *     un tour de bracket créé à la main garde le `kind` par défaut
 *     (`regular`), seul son slot le trahit (cf. CLAUDE.md) ;
 *   - rencontre engagée (en cours, jouée, forfait) ;
 *   - rencontre matérialisée par un `Match` (partie lancée) ;
 *   - `Match` de la journée déjà reporté au classement (`leagueScoredAt`) ;
 *   - feuille de match sortie du BROUILLON (soumise, validée, invalidée —
 *     une feuille invalidée a été validée un jour : Couronnes versées,
 *     journal d'équipe écrit, on en garde la trace).
 *
 * Une feuille en brouillon et les pronostics partent avec la cascade : c'est
 * ce que l'écran annonce avant de confirmer. Pas de renumérotation : le
 * libellé affiché est le nom de la journée, et la prochaine journée créée
 * prend toujours `max(roundNumber) + 1`.
 */

/**
 * Statuts de rencontre qui rendent une journée insupprimable. Même liste que
 * `ENGAGED_PAIRING_STATUSES` de `commissioner-team-removal` (un module pur ne
 * l'importe pas : il tirerait Prisma).
 */
export const ENGAGED_PAIRING_STATUSES: ReadonlySet<string> = new Set([
  "in_progress",
  "played",
  "forfeit_home",
  "forfeit_away",
]);

/** Seul statut de feuille que la cascade peut emporter. */
export const REMOVABLE_SHEET_STATUS = "draft";

export type RoundRemovalRefusalCode =
  | "season_completed"
  | "playoff_round"
  | "pairing_engaged"
  | "match_linked"
  | "match_scored"
  | "sheet_submitted";

export interface RoundRemovalPairing {
  readonly status: string;
  /** Un `Match` matérialise la rencontre (partie lancée). */
  readonly hasMatch: boolean;
  /** Statut de la feuille de match, `null` sans feuille. */
  readonly sheetStatus: string | null;
  /** Pronostics posés sur la rencontre (emportés par la cascade). */
  readonly predictions: number;
}

export interface RoundRemovalInput {
  readonly round: { readonly kind: string; readonly bracketSlot: string | null };
  readonly seasonStatus: string;
  readonly pairings: readonly RoundRemovalPairing[];
  /** `Match` rattachés à la journée et déjà reportés au classement. */
  readonly scoredMatches: number;
}

export type RoundRemovalDecision =
  | {
      readonly allowed: true;
      readonly pairingsRemoved: number;
      readonly draftSheetsRemoved: number;
      readonly predictionsRemoved: number;
    }
  | {
      readonly allowed: false;
      readonly code: RoundRemovalRefusalCode;
      readonly message: string;
    };

function refuse(
  code: RoundRemovalRefusalCode,
  message: string,
): RoundRemovalDecision {
  return { allowed: false, code, message };
}

/** Vrai pour une journée de play-off, quel que soit son `kind`. */
export function isPlayoffRound(round: {
  readonly kind: string;
  readonly bracketSlot: string | null;
}): boolean {
  return round.kind === "playoff" || round.bracketSlot !== null;
}

export function decideRoundRemoval(
  input: RoundRemovalInput,
): RoundRemovalDecision {
  if (input.seasonStatus === "completed") {
    return refuse(
      "season_completed",
      "Saison cloturee : ses journees ne se suppriment plus",
    );
  }
  if (isPlayoffRound(input.round)) {
    return refuse(
      "playoff_round",
      "Journee de play-off : elle se gere depuis le bracket, pas depuis le calendrier",
    );
  }
  if (input.pairings.some((p) => ENGAGED_PAIRING_STATUSES.has(p.status))) {
    return refuse(
      "pairing_engaged",
      "Une rencontre de cette journee est en cours, jouee ou declaree forfait : suppression impossible",
    );
  }
  if (input.pairings.some((p) => p.hasMatch)) {
    return refuse(
      "match_linked",
      "Une rencontre de cette journee a deja un match lance : suppression impossible",
    );
  }
  if (input.scoredMatches > 0) {
    return refuse(
      "match_scored",
      "Un match de cette journee est deja reporte au classement : suppression impossible",
    );
  }
  if (
    input.pairings.some(
      (p) => p.sheetStatus !== null && p.sheetStatus !== REMOVABLE_SHEET_STATUS,
    )
  ) {
    return refuse(
      "sheet_submitted",
      "Une feuille de match de cette journee a ete soumise ou validee : suppression impossible",
    );
  }
  return {
    allowed: true,
    pairingsRemoved: input.pairings.length,
    draftSheetsRemoved: input.pairings.filter((p) => p.sheetStatus !== null)
      .length,
    predictionsRemoved: input.pairings.reduce(
      (sum, p) => sum + p.predictions,
      0,
    ),
  };
}

/**
 * Nom de journée tel qu'il s'ÉCRIT : chaîne vide (ou blanche) ⇒ `null`, que
 * l'affichage lit « Journée N ». `undefined` = champ non fourni.
 */
export function normalizeRoundName(
  raw: string | null | undefined,
): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}
