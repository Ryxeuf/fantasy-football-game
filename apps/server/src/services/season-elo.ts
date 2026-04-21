/**
 * L.8 — ELO saisonnier avec reset et placements (Sprint 17).
 *
 * Le `seasonElo` d'un LeagueParticipant est independant du rating global
 * (`User.eloRating`). Il est reinitialise pour chaque saison afin de
 * relancer le competitif sur une base comparable, puis converge rapidement
 * vers la "vraie" force du joueur grace a une periode de placement
 * (K-factor eleve sur les premiers matchs).
 *
 * Regles retenues :
 *  - Reset au demarrage de chaque saison : les participants commencent a
 *    `DEFAULT_SEASON_ELO` (1000), avec option de soft-reset a partir de
 *    l'ELO global via `deriveSeasonEloFromGlobal`.
 *  - Placements : K-factor 48 durant les `PLACEMENT_MATCH_COUNT` (5)
 *    premiers matchs du participant, 32 ensuite.
 *  - Plancher `MIN_SEASON_ELO` (100) — meme comportement que l'ELO global.
 *  - Asymetrique : si A est en placement et pas B, le delta de A utilise
 *    K=48 et celui de B utilise K=32 (somme non nulle assumee, c'est le
 *    prix de la convergence acceleree des nouveaux joueurs).
 *
 * Les deltas restent des entiers signes (arrondis) pour coller au modele
 * Prisma (Int) et au format existant de `elo.ts`.
 */

import { calculateExpectedScore } from "./elo";

export const PLACEMENT_MATCH_COUNT = 5;
export const PLACEMENT_K_FACTOR = 48;
export const REGULAR_K_FACTOR = 32;
export const MIN_SEASON_ELO = 100;
export const DEFAULT_SEASON_ELO = 1000;
export const SOFT_RESET_COEFFICIENT = 0.25;

export type SeasonMatchOutcome = "win" | "draw" | "loss";

export interface ParticipantPlayedCounters {
  readonly wins: number;
  readonly draws: number;
  readonly losses: number;
}

export interface SeasonEloChangeInput {
  readonly ratingA: number;
  readonly ratingB: number;
  readonly outcome: SeasonMatchOutcome;
  readonly inPlacementA: boolean;
  readonly inPlacementB: boolean;
}

export interface SeasonEloChangeResult {
  readonly deltaA: number;
  readonly deltaB: number;
}

export function isInPlacement(counters: ParticipantPlayedCounters): boolean {
  const played = counters.wins + counters.draws + counters.losses;
  return played < PLACEMENT_MATCH_COUNT;
}

function actualScoreFor(outcome: SeasonMatchOutcome, side: "A" | "B"): number {
  if (outcome === "draw") return 0.5;
  if (side === "A") return outcome === "win" ? 1 : 0;
  return outcome === "win" ? 0 : 1;
}

function kFactorFor(inPlacement: boolean): number {
  return inPlacement ? PLACEMENT_K_FACTOR : REGULAR_K_FACTOR;
}

export function calculateSeasonEloChange(
  input: SeasonEloChangeInput,
): SeasonEloChangeResult {
  const { ratingA, ratingB, outcome, inPlacementA, inPlacementB } = input;
  const expectedA = calculateExpectedScore(ratingA, ratingB);
  const expectedB = 1 - expectedA;
  const actualA = actualScoreFor(outcome, "A");
  const actualB = actualScoreFor(outcome, "B");

  const kA = kFactorFor(inPlacementA);
  const kB = kFactorFor(inPlacementB);

  const deltaA = Math.round(kA * (actualA - expectedA)) || 0;
  const deltaB = Math.round(kB * (actualB - expectedB)) || 0;

  return { deltaA, deltaB };
}

/**
 * Applique un reset "soft" : le seasonElo de depart est tire du rating global
 * vers DEFAULT_SEASON_ELO selon `SOFT_RESET_COEFFICIENT`.
 *
 * Exemple : globalElo=1400, coef=0.25 → seasonElo = 1000 + (1400-1000)*0.25
 * = 1100. Un tres fort joueur conserve donc un petit bonus initial mais doit
 * prouver a nouveau son niveau chaque saison.
 */
export function deriveSeasonEloFromGlobal(globalElo: number): number {
  const compressed =
    DEFAULT_SEASON_ELO +
    (globalElo - DEFAULT_SEASON_ELO) * SOFT_RESET_COEFFICIENT;
  const rounded = Math.round(compressed);
  return Math.max(MIN_SEASON_ELO, rounded);
}

/**
 * Applique un plancher strict : le seasonElo ne peut pas descendre sous
 * MIN_SEASON_ELO meme apres une defaite lourde.
 */
export function clampSeasonElo(rating: number): number {
  return Math.max(MIN_SEASON_ELO, Math.round(rating));
}
