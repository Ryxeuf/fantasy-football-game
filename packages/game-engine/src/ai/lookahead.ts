/**
 * Sprint Pro League — Lot 3.A.0.b : 2-ply minimax lookahead.
 *
 * L'IA greedy 1-ply (`pickBestMove`) score chaque coup individuel
 * sans considérer ce que l'adversaire fera ensuite. Pour produire
 * des matchs IA-vs-IA cohérents en full driver, on enrichit la
 * décision sur le coup le plus important du tour : **END_TURN**.
 *
 * Pourquoi END_TURN spécifiquement
 * --------------------------------
 * END_TURN a deux propriétés qui le rendent idéal pour le 2-ply :
 *  1. Déterministe : pas de jet de dé, l'application du coup donne
 *     un état parfaitement prévisible (pas besoin de ré-échantillonner
 *     les futures probabilités).
 *  2. Critique : terminer son tour à un mauvais moment = livrer la
 *     balle à l'adversaire en bonne position. Le 1-ply ne voit pas
 *     ce coût (il évalue juste la position courante moins
 *     END_TURN_PENALTY).
 *
 * Pour les autres coups (BLOCK, DODGE, PASS), `scoreMove` modélise
 * déjà la part probabiliste via `estimateBlockKnockdown`. Refaire un
 * 2-ply sur eux multiplierait le coût compute sans gain net.
 *
 * Algorithme
 * ----------
 *   score(END_TURN) = -END_TURN_PENALTY
 *                   + Δ_position_après_endTurn
 *                   - Δ_position_après_meilleur_coup_adverse
 *
 * Le terme adverse est le `scoreMove` du meilleur coup retourné par
 * `pickBestMove(stateAfterEndTurn, opponent)`. Si l'adversaire a un
 * énorme coup à jouer (sortir un joueur clef, marquer un TD), ce
 * delta est élevé et `score(END_TURN)` chute en conséquence — l'IA
 * préfère alors continuer à agir plutôt que de céder le tour.
 *
 * Borne compute
 * -------------
 * Le 2-ply ajoute une boucle `pickBestMove` sur l'état successeur,
 * soit ~50-200 évaluations supplémentaires UNE seule fois par tour
 * (uniquement pour END_TURN). Acceptable pour de l'auto-play offline.
 */

import type { GameState, Move, RNG, TeamId } from '../core/types';
import { applyMove, getLegalMoves } from '../actions/actions';
import { makeRNG } from '../utils/rng';

import {
  type EvalWeights,
  evaluatePosition,
  pickBestMove,
  resolveWeights,
  scoreMove,
} from './evaluator';

/** RNG déterministe pour les simulations de lookahead. END_TURN ne
 *  consomme pas de dé en pratique, mais on fournit un RNG stable au
 *  cas où l'engine en lit un par défense. */
const STUB_LOOKAHEAD_RNG: RNG = makeRNG('ai-lookahead-stub');

const OPPOSITE: Record<TeamId, TeamId> = { A: 'B', B: 'A' };

function otherTeam(team: TeamId): TeamId {
  return OPPOSITE[team];
}

/**
 * Applique un Move déterministe à un état pour obtenir l'état
 * successeur. Utilisé uniquement par le 2-ply lookahead pour
 * END_TURN — un Move probabiliste donnerait un résultat différent
 * selon la seed et casserait la convergence du minimax.
 *
 * `applyMove` peut throw si le coup n'est pas légal (ce qui ne
 * devrait pas arriver puisqu'on lui passe le résultat de
 * `pickBestMove`). On wrappe dans un try/catch et retombons sur le
 * state initial en cas de pépin (logged côté caller via la stratégie
 * de fallback).
 */
function tryApplyDeterministic(
  state: GameState,
  move: Move
): GameState | null {
  try {
    return applyMove(state, move, STUB_LOOKAHEAD_RNG);
  } catch {
    return null;
  }
}

/**
 * Score 2-ply d'un Move. Pour END_TURN, simule la réponse adverse
 * et soustrait son delta de scoring. Pour les autres types, retombe
 * sur `scoreMove` 1-ply.
 */
export function scoreMove2Ply(
  state: GameState,
  move: Move,
  team: TeamId,
  weightsOverride?: Partial<EvalWeights>
): number {
  const baseScore = scoreMove(state, move, team, weightsOverride);

  if (move.type !== 'END_TURN') return baseScore;

  // 2-ply : que se passe-t-il après END_TURN ?
  const stateAfterEnd = tryApplyDeterministic(state, move);
  if (!stateAfterEnd) return baseScore;

  const opponent = otherTeam(team);
  const opponentBest = pickBestMove(stateAfterEnd, opponent, weightsOverride);
  if (!opponentBest) return baseScore;

  // Le scoreMove adverse retourne le gain estimé pour l'adversaire :
  // un score haut = bonne situation pour l'opposition = mauvaise pour
  // nous. On soustrait pour pénaliser un END_TURN qui livre une
  // grosse opportunité à l'adversaire.
  const opponentScore = scoreMove(
    stateAfterEnd,
    opponentBest,
    opponent,
    weightsOverride
  );

  // Delta de position après notre END_TURN (avant la réponse adverse)
  // — capture les changements automatiques (recovery, fanFactor, etc.)
  // induits par `handleEndTurn`.
  const weights = resolveWeights(weightsOverride);
  const positionDelta =
    evaluatePosition(stateAfterEnd, team, weights).total -
    evaluatePosition(state, team, weights).total;

  return baseScore + positionDelta - opponentScore;
}

/**
 * Variante de `pickBestMove` qui score chaque END_TURN candidat avec
 * un lookahead 2-ply et tous les autres coups en 1-ply.
 *
 * Comportement attendu : sur un tour où l'IA a encore des actions
 * intéressantes à faire (blitz disponible, ball carrier en mauvaise
 * posture pour l'adversaire), END_TURN sera fortement pénalisé et
 * l'IA continuera à jouer activement.
 */
export function pickBestMove2Ply(
  state: GameState,
  team: TeamId,
  weightsOverride?: Partial<EvalWeights>
): Move | null {
  const legal = getLegalMoves(state);
  if (legal.length === 0) return null;

  let bestMove: Move = legal[0];
  let bestScore = scoreMove2Ply(state, bestMove, team, weightsOverride);
  for (let i = 1; i < legal.length; i++) {
    const candidate = legal[i];
    const candidateScore = scoreMove2Ply(state, candidate, team, weightsOverride);
    if (candidateScore > bestScore) {
      bestScore = candidateScore;
      bestMove = candidate;
    }
  }
  return bestMove;
}
