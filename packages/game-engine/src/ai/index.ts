/**
 * Barrel du module IA adversaire (N.3+).
 * Regroupe les utilitaires d'evaluation heuristique utilises par l'IA
 * (evaluer une position, scorer un coup, choisir le meilleur coup).
 */
export {
  evaluatePosition,
  scoreMove,
  pickBestMove,
  EVAL_WEIGHTS,
} from './evaluator';
export type { EvaluationBreakdown, PositionEvaluation } from './evaluator';
