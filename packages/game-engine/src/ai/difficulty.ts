/**
 * N.4 — Mode pratique contre IA : trois niveaux de difficulte.
 *
 * Fournit :
 *  - `AI_DIFFICULTY_LEVELS` et `AI_DIFFICULTY_PROFILES` : catalogue des niveaux.
 *  - `pickAIMove`                 : selection de coup pondere par le niveau.
 *  - `scoreMoveForDifficulty`     : score heuristique augmente des biais de niveau.
 *
 * Chaque niveau applique un profil d'imperfections sur les scores heuristiques
 * produits par `scoreMove` : bruit additif, biais pro-END_TURN, evitement des
 * actions agressives (timidite). `hard` est strictement identique a
 * `pickBestMove` (profil neutre et deterministe).
 */

import type { GameState, Move, RNG, TeamId } from '../core/types';
import { getLegalMoves } from '../actions/actions';
import { makeRNG } from '../utils/rng';
import { pickBestMove, scoreMove } from './evaluator';

export type AIDifficulty = 'easy' | 'medium' | 'hard';

export const AI_DIFFICULTY_LEVELS: readonly AIDifficulty[] = Object.freeze([
  'easy',
  'medium',
  'hard',
] as const);

export const DEFAULT_AI_DIFFICULTY: AIDifficulty = 'medium';

export interface AIDifficultyProfile {
  readonly slug: AIDifficulty;
  /** Amplitude du bruit additif applique aux scores heuristiques. */
  readonly noise: number;
  /** Probabilite (0..1) de choisir au hasard parmi les coups les mieux scores. */
  readonly blunderRate: number;
  /** Probabilite (0..1) d'ecarter un coup agressif (BLOCK/BLITZ/FOUL/PASS). */
  readonly timidityRate: number;
  /** Bonus additif sur le score d'END_TURN (pro-termine rapidement le tour). */
  readonly endTurnBias: number;
}

const AGGRESSIVE_MOVE_TYPES: ReadonlySet<Move['type']> = new Set([
  'BLOCK',
  'BLITZ',
  'FOUL',
  'PASS',
]);

export const AI_DIFFICULTY_PROFILES: Readonly<Record<AIDifficulty, AIDifficultyProfile>> =
  Object.freeze({
    easy: Object.freeze({
      slug: 'easy',
      noise: 80,
      blunderRate: 0.35,
      timidityRate: 0.35,
      endTurnBias: 40,
    }),
    medium: Object.freeze({
      slug: 'medium',
      noise: 20,
      blunderRate: 0.1,
      timidityRate: 0.05,
      // Pas de bias pro-END_TURN : un coach moyen joue tous ses joueurs.
      // Le bruit et le blunderRate suffisent a donner un comportement faillible.
      endTurnBias: 0,
    }),
    hard: Object.freeze({
      slug: 'hard',
      noise: 0,
      blunderRate: 0,
      timidityRate: 0,
      endTurnBias: 0,
    }),
  });

export function getAIDifficultyProfile(difficulty: AIDifficulty): AIDifficultyProfile {
  return AI_DIFFICULTY_PROFILES[difficulty];
}

export function listAIDifficulties(): readonly AIDifficulty[] {
  return AI_DIFFICULTY_LEVELS;
}

/**
 * Score heuristique augmente des biais propres au niveau de difficulte.
 * `hard` retourne exactement `scoreMove` (profil neutre, deterministe).
 */
export function scoreMoveForDifficulty(
  state: GameState,
  move: Move,
  team: TeamId,
  difficulty: AIDifficulty,
  rng?: RNG
): number {
  const base = scoreMove(state, move, team);
  const profile = getAIDifficultyProfile(difficulty);
  let score = base;
  if (move.type === 'END_TURN') {
    score += profile.endTurnBias;
  }
  if (profile.noise > 0 && rng) {
    score += (rng() * 2 - 1) * profile.noise;
  }
  return score;
}

export interface PickAIMoveOptions {
  difficulty?: AIDifficulty;
  rng?: RNG;
}

/**
 * Selectionne le prochain coup pour `team` selon le niveau de difficulte.
 * `hard` delegue a `pickBestMove` (strictement optimal et deterministe).
 * `easy`/`medium` appliquent bruit, timidite et blunders pondenes par `rng`.
 * Si `rng` est omis sur un niveau non-`hard`, un RNG deterministe fixe est utilise
 * afin de garantir la reproductibilite (les choix restent stables appel apres appel).
 */
export function pickAIMove(
  state: GameState,
  team: TeamId,
  options: PickAIMoveOptions = {}
): Move | null {
  const difficulty = options.difficulty ?? DEFAULT_AI_DIFFICULTY;

  if (difficulty === 'hard') {
    return pickBestMove(state, team);
  }

  const legal = getLegalMoves(state);
  if (legal.length === 0) return null;

  const rng: RNG = options.rng ?? makeRNG(`ai-default-${difficulty}`);
  const profile = getAIDifficultyProfile(difficulty);

  const filtered = filterTimidMoves(legal, profile.timidityRate, rng);
  const pool = filtered.length > 0 ? filtered : legal;

  const scored = pool.map(candidate => ({
    move: candidate,
    score: scoreMoveForDifficulty(state, candidate, team, difficulty, rng),
  }));

  const sorted = sortByScoreDescStable(scored);

  if (profile.blunderRate > 0 && rng() < profile.blunderRate && sorted.length > 1) {
    const topCount = Math.max(2, Math.ceil(sorted.length * 0.4));
    const topSlice = sorted.slice(0, topCount);
    const pickIndex = Math.min(topSlice.length - 1, Math.floor(rng() * topSlice.length));
    return topSlice[pickIndex].move;
  }

  return sorted[0].move;
}

function filterTimidMoves(moves: readonly Move[], timidityRate: number, rng: RNG): Move[] {
  if (timidityRate <= 0) return [...moves];
  const kept: Move[] = [];
  for (const move of moves) {
    if (AGGRESSIVE_MOVE_TYPES.has(move.type) && rng() < timidityRate) {
      continue;
    }
    kept.push(move);
  }
  return kept;
}

interface ScoredMove {
  readonly move: Move;
  readonly score: number;
}

function sortByScoreDescStable(scored: readonly ScoredMove[]): ScoredMove[] {
  return scored
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      if (b.entry.score !== a.entry.score) return b.entry.score - a.entry.score;
      return a.index - b.index;
    })
    .map(({ entry }) => entry);
}
