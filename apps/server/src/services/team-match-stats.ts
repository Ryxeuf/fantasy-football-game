/**
 * Statistiques de matchs d'une équipe, TOUTES compétitions confondues.
 *
 * La fiche d'équipe ne comptait que les `LocalMatch` : les rencontres de
 * LIGUE (feuille de match validée, forfait, match en ligne rattaché à une
 * saison) n'y sont jamais matérialisées — elles vivent dans les compteurs
 * du `LeagueParticipant`. Une équipe ayant joué toute une saison affichait
 * donc « 0 match », et rien ne bougeait à la validation d'une feuille.
 *
 * Trois sources, disjointes par construction (aucun double compte) :
 *  - LIGUE : compteurs `wins/draws/losses/touchdowns*` sommés sur toutes
 *    les participations (toutes saisons, retrait compris). Ce sont ceux que lit
 *    le classement (`computeSeasonStandings`) : la fiche et le classement ne
 *    peuvent pas diverger ;
 *  - COUPE : le `LocalMatch` complété que matérialise la validation d'une
 *    feuille de coupe (`cupId` / `cupPairingId` renseigné) ;
 *  - AMICAL : tout autre `LocalMatch` complété (partie offline saisie à la
 *    main).
 *
 * Module PUR : le handler charge les lignes, ces fonctions les agrègent.
 */

export interface TeamRecordTotals {
  readonly played: number;
  readonly wins: number;
  readonly draws: number;
  readonly losses: number;
  readonly touchdownsFor: number;
  readonly touchdownsAgainst: number;
}

export interface TeamMatchStats extends TeamRecordTotals {
  readonly touchdownDiff: number;
  readonly bySource: {
    readonly league: TeamRecordTotals;
    readonly cup: TeamRecordTotals;
    readonly friendly: TeamRecordTotals;
  };
}

/** Compteurs historiques des seuls `LocalMatch` (contrat `localMatchStats`). */
export interface LocalMatchStats {
  readonly total: number;
  readonly pending: number;
  readonly waitingForPlayer: number;
  readonly inProgress: number;
  readonly completed: number;
  readonly cancelled: number;
  readonly matchesPlayed: number;
  readonly wins: number;
  readonly draws: number;
  readonly losses: number;
  readonly touchdownsFor: number;
  readonly touchdownsAgainst: number;
  readonly touchdownDiff: number;
}

export interface LocalMatchRow {
  readonly status: string;
  readonly teamAId: string;
  readonly teamBId: string | null;
  readonly scoreTeamA: number | null;
  readonly scoreTeamB: number | null;
  readonly cupId?: string | null;
  readonly cupPairingId?: string | null;
}

/**
 * `_sum` d'un `leagueParticipant.aggregate` : chaque somme vaut `null` quand
 * l'équipe n'a aucune participation.
 */
export interface LeagueCounterSums {
  readonly wins?: number | null;
  readonly draws?: number | null;
  readonly losses?: number | null;
  readonly touchdownsFor?: number | null;
  readonly touchdownsAgainst?: number | null;
}

export const EMPTY_RECORD: TeamRecordTotals = {
  played: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  touchdownsFor: 0,
  touchdownsAgainst: 0,
};

function addResult(
  acc: TeamRecordTotals,
  myScore: number,
  oppScore: number,
): TeamRecordTotals {
  return {
    played: acc.played + 1,
    wins: acc.wins + (myScore > oppScore ? 1 : 0),
    draws: acc.draws + (myScore === oppScore ? 1 : 0),
    losses: acc.losses + (myScore < oppScore ? 1 : 0),
    touchdownsFor: acc.touchdownsFor + myScore,
    touchdownsAgainst: acc.touchdownsAgainst + oppScore,
  };
}

function sumRecords(records: readonly TeamRecordTotals[]): TeamRecordTotals {
  return records.reduce<TeamRecordTotals>(
    (acc, r) => ({
      played: acc.played + r.played,
      wins: acc.wins + r.wins,
      draws: acc.draws + r.draws,
      losses: acc.losses + r.losses,
      touchdownsFor: acc.touchdownsFor + r.touchdownsFor,
      touchdownsAgainst: acc.touchdownsAgainst + r.touchdownsAgainst,
    }),
    EMPTY_RECORD,
  );
}

function isCupMatch(match: LocalMatchRow): boolean {
  return Boolean(match.cupId || match.cupPairingId);
}

/**
 * Bilan des `LocalMatch` COMPLÉTÉS de l'équipe, séparé coupe / amical.
 * Un match non complété (en attente, en cours, annulé) n'a pas de résultat.
 */
export function summarizeLocalMatchRecords(
  teamId: string,
  matches: readonly LocalMatchRow[],
): { readonly cup: TeamRecordTotals; readonly friendly: TeamRecordTotals } {
  let cup = EMPTY_RECORD;
  let friendly = EMPTY_RECORD;
  for (const match of matches) {
    if (match.status !== "completed") continue;
    const isTeamA = match.teamAId === teamId;
    const myScore = (isTeamA ? match.scoreTeamA : match.scoreTeamB) ?? 0;
    const oppScore = (isTeamA ? match.scoreTeamB : match.scoreTeamA) ?? 0;
    if (isCupMatch(match)) cup = addResult(cup, myScore, oppScore);
    else friendly = addResult(friendly, myScore, oppScore);
  }
  return { cup, friendly };
}

/**
 * Compteurs `LocalMatch` par statut + bilan des complétés. Contrat historique
 * de `GET /team/:id` (`localMatchStats`), conservé tel quel pour les
 * consommateurs existants.
 */
export function summarizeLocalMatchStats(
  teamId: string,
  matches: readonly LocalMatchRow[],
): LocalMatchStats {
  const countOf = (status: string): number =>
    matches.filter((m) => m.status === status).length;
  const { cup, friendly } = summarizeLocalMatchRecords(teamId, matches);
  const record = sumRecords([cup, friendly]);
  return {
    total: matches.length,
    pending: countOf("pending"),
    waitingForPlayer: countOf("waiting_for_player"),
    inProgress: countOf("in_progress"),
    completed: record.played,
    cancelled: countOf("cancelled"),
    matchesPlayed: record.played,
    wins: record.wins,
    draws: record.draws,
    losses: record.losses,
    touchdownsFor: record.touchdownsFor,
    touchdownsAgainst: record.touchdownsAgainst,
    touchdownDiff: record.touchdownsFor - record.touchdownsAgainst,
  };
}

/**
 * Bilan de ligue : sommes des compteurs de toutes les participations (toutes
 * saisons, retrait compris). Un match joué = une victoire, un nul ou une
 * défaite — même règle que la colonne MJ du classement, forfaits compris.
 */
export function summarizeLeagueRecord(
  sums: LeagueCounterSums | null | undefined,
): TeamRecordTotals {
  const wins = sums?.wins ?? 0;
  const draws = sums?.draws ?? 0;
  const losses = sums?.losses ?? 0;
  return {
    played: wins + draws + losses,
    wins,
    draws,
    losses,
    touchdownsFor: sums?.touchdownsFor ?? 0,
    touchdownsAgainst: sums?.touchdownsAgainst ?? 0,
  };
}

export function buildTeamMatchStats(input: {
  readonly teamId: string;
  readonly localMatches: readonly LocalMatchRow[];
  readonly leagueSums: LeagueCounterSums | null | undefined;
}): TeamMatchStats {
  const league = summarizeLeagueRecord(input.leagueSums);
  const { cup, friendly } = summarizeLocalMatchRecords(
    input.teamId,
    input.localMatches,
  );
  const total = sumRecords([league, cup, friendly]);
  return {
    ...total,
    touchdownDiff: total.touchdownsFor - total.touchdownsAgainst,
    bySource: { league, cup, friendly },
  };
}
