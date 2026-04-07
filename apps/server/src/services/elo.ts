/**
 * ELO rating calculation service for Nuffle Arena.
 *
 * Uses the standard ELO formula with K-factor 32.
 * Default rating for new players is 1000.
 */

export const DEFAULT_ELO = 1000;
export const K_FACTOR = 32;

/**
 * Calculate the expected score (probability of winning) for playerA
 * against playerB using the standard ELO formula.
 *
 * Returns a value between 0 and 1.
 */
export function calculateExpectedScore(
  ratingA: number,
  ratingB: number,
): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export type MatchOutcome = "win" | "draw";

export interface EloChangeResult {
  /** ELO delta for the first player (playerA / winner in case of win) */
  winnerDelta: number;
  /** ELO delta for the second player (playerB / loser in case of win) */
  loserDelta: number;
}

/**
 * Calculate the ELO rating change after a match.
 *
 * For a "win" outcome: playerA is the winner, playerB is the loser.
 * For a "draw" outcome: playerA and playerB drew — winnerDelta/loserDelta
 * refer to playerA/playerB respectively.
 */
export function calculateEloChange(
  ratingA: number,
  ratingB: number,
  outcome: MatchOutcome,
): EloChangeResult {
  const expectedA = calculateExpectedScore(ratingA, ratingB);

  const actualA = outcome === "win" ? 1 : 0.5;
  const deltaA = Math.round(K_FACTOR * (actualA - expectedA)) || 0;

  return {
    winnerDelta: deltaA,
    loserDelta: (-deltaA) || 0,
  };
}
