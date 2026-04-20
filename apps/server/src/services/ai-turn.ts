/**
 * N.4 — Service orchestrateur des tours IA.
 *
 * Responsabilite stricte : calculer le prochain coup IA a partir d'un
 * `GameState` courant et d'un profil de difficulte, sans mutation cote serveur.
 * Le client (ou un futur loop serveur) est charge d'appliquer le coup obtenu
 * via `applyMove` puis de reappeler ce service tant que l'IA garde la main.
 */

import {
  pickAIMove,
  makeRNG,
  type AIDifficulty,
  type GameState,
  type Move,
  type TeamId,
} from "@bb/game-engine";

export interface ComputeAIMoveParams {
  readonly state: GameState;
  readonly aiTeam: TeamId;
  readonly difficulty: AIDifficulty;
  /** Seed deterministe pour la reproductibilite (tests, rejouabilite). */
  readonly seed?: string;
}

export interface ComputeAIMoveResult {
  /** `null` si aucun coup legal n'est disponible pour l'IA. */
  readonly move: Move | null;
  /** True si c'est effectivement le tour de l'IA au moment de l'appel. */
  readonly isAITurn: boolean;
}

/**
 * Determine si c'est le tour de l'equipe IA dans l'etat courant.
 * Retourne false si le match n'est pas en phase active de jeu.
 */
export function isAITurnToAct(state: GameState, aiTeam: TeamId): boolean {
  if (!state) return false;
  // Extended game states (pre-match, post-match) stockent la phase ailleurs.
  const preMatchPhase = (state as any)?.preMatch?.phase;
  if (preMatchPhase && preMatchPhase !== "idle" && preMatchPhase !== "setup") {
    return false;
  }
  return state.currentPlayer === aiTeam;
}

/**
 * Calcule le prochain coup a jouer pour l'IA.
 * - Ne modifie pas l'etat fourni.
 * - Retourne `{ isAITurn: false, move: null }` si ce n'est pas le tour de l'IA.
 */
export function computeAIMove(params: ComputeAIMoveParams): ComputeAIMoveResult {
  const { state, aiTeam, difficulty, seed } = params;
  const aiTurn = isAITurnToAct(state, aiTeam);
  if (!aiTurn) {
    return { move: null, isAITurn: false };
  }
  const rng = seed ? makeRNG(seed) : undefined;
  const move = pickAIMove(state, aiTeam, { difficulty, rng });
  return { move, isAITurn: true };
}
