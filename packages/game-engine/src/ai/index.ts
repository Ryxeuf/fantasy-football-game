/**
 * Barrel du module IA adversaire (N.3+).
 * Regroupe les utilitaires d'evaluation heuristique utilises par l'IA
 * (evaluer une position, scorer un coup, choisir le meilleur coup) ainsi que
 * les profils de difficulte (N.4 — mode pratique contre IA).
 */
export {
  evaluatePosition,
  scoreMove,
  pickBestMove,
  EVAL_WEIGHTS,
} from './evaluator';
export type { EvaluationBreakdown, PositionEvaluation } from './evaluator';

export {
  AI_DIFFICULTY_LEVELS,
  AI_DIFFICULTY_PROFILES,
  DEFAULT_AI_DIFFICULTY,
  getAIDifficultyProfile,
  listAIDifficulties,
  pickAIMove,
  scoreMoveForDifficulty,
} from './difficulty';
export type { AIDifficulty, AIDifficultyProfile, PickAIMoveOptions } from './difficulty';

// N.4b — Whitelist rosters IA adversaire (5 equipes prioritaires)
export {
  AI_OPPONENT_ALLOWED_ROSTERS,
  isAIOpponentRosterAllowed,
  listAIOpponentAllowedRosters,
  pickAIOpponentRoster,
} from './opponent-teams';
export type {
  AIOpponentRoster,
  PickAIOpponentRosterOptions,
} from './opponent-teams';
