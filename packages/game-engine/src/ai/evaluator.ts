/**
 * N.3 — Evaluation heuristique basique pour l'IA adversaire.
 *
 * Fournit :
 *  - `evaluatePosition` : score scalaire (perspective equipe) d'un GameState.
 *  - `scoreMove`        : score estime d'un coup legal pour une equipe.
 *  - `pickBestMove`     : selectionne le coup legal au score maximal.
 *
 * Les heuristiques sont volontairement simples : elles capturent les leviers
 * de haut niveau (score au tableau, possession, progression, attrition,
 * protection du porteur) pour produire un adversaire coherent a un niveau
 * debutant. Des strates plus avancees (simulation multi-coups, apprentissage)
 * seront ajoutees ulterieurement.
 */

import type { GameState, Move, Player, Position, TeamId } from '../core/types';
import { getAdjacentOpponents, isAdjacent } from '../mechanics/movement';
import { getLegalMoves } from '../actions/actions';

export interface EvaluationBreakdown {
  score: number;
  possession: number;
  ballProgress: number;
  playerCount: number;
  carrierSafety: number;
  attrition: number;
  positioning: number;
}

export interface PositionEvaluation {
  total: number;
  breakdown: EvaluationBreakdown;
}

export const EVAL_WEIGHTS = {
  TOUCHDOWN: 1000,
  POSSESSION: 300,
  BALL_PROGRESS_PER_STEP: 15,
  PLAYER_ACTIVE: 30,
  PLAYER_STUNNED_PENALTY: 15,
  PLAYER_KO_PENALTY: 40,
  PLAYER_CASUALTY_PENALTY: 150,
  PLAYER_SENT_OFF_PENALTY: 120,
  CARRIER_PROTECTION_ALLY: 20,
  CARRIER_TACKLEZONE_PENALTY: 35,
  CARRIER_IN_ENDZONE_BONUS: 250,
  /**
   * Recompense par case de progression positionnelle pour les joueurs
   * non-porteurs : sans ce signal, deplacer un defenseur ou un soutien
   * laisse l evaluation globale identique et l IA prefere END_TURN.
   */
  POSITIONING_PER_STEP: 2,
  /**
   * Petit malus applique a END_TURN quand au moins une autre action existe :
   * il casse les egalites avec les coups au score 0 (la majorite des MOVE
   * sans incidence directe) en faveur du jeu actif.
   */
  END_TURN_PENALTY: 1,
} as const;

/**
 * Sprint Pro League — Lot 3.A.0.a : pondérations effectives passées
 * aux fonctions de scoring. Permet aux callers (sim-engine full
 * driver) d'override certaines poids selon le profil tactique de
 * l'équipe (Halflings ne pénalisent pas les casualties autant qu'une
 * équipe élite, Wood Elves valorisent plus la progression de balle,
 * etc.) tout en gardant `EVAL_WEIGHTS` immuable comme baseline.
 *
 * Le découplage est volontaire : `game-engine` ne dépend pas de
 * `@bb/sim-engine` (cyclic dep), donc la conversion
 * `TacticalProfile → Partial<EvalWeights>` se fait côté sim-engine
 * (`packages/sim-engine/src/tactics/ai-weights.ts`).
 *
 * Note typage : `EvalWeights` élargit chaque entrée de `EVAL_WEIGHTS`
 * (literals via `as const`) en `number` pour permettre des overrides
 * avec n'importe quelle valeur entière. La constante baseline reste
 * littérale et donc immutable.
 */
export type EvalWeights = {
  [K in keyof typeof EVAL_WEIGHTS]: number;
};

/**
 * Merge un override partiel avec les pondérations baseline. Toute
 * clé absente du `override` retombe sur la valeur d'`EVAL_WEIGHTS`.
 */
export function resolveWeights(
  override?: Partial<EvalWeights>
): EvalWeights {
  if (!override) return EVAL_WEIGHTS;
  return { ...EVAL_WEIGHTS, ...override } as EvalWeights;
}

const OPPOSITE: Record<TeamId, TeamId> = { A: 'B', B: 'A' };

function otherTeam(team: TeamId): TeamId {
  return OPPOSITE[team];
}

function isActive(player: Player): boolean {
  return (
    !player.stunned &&
    player.state !== 'casualty' &&
    player.state !== 'knocked_out' &&
    player.state !== 'sent_off'
  );
}

function teamScore(state: GameState, team: TeamId): number {
  return team === 'A' ? state.score.teamA : state.score.teamB;
}

function endzoneX(state: GameState, team: TeamId): number {
  return team === 'A' ? state.width - 1 : 0;
}

function distanceToEndzone(state: GameState, pos: Position, team: TeamId): number {
  return Math.abs(pos.x - endzoneX(state, team));
}

function findPlayer(state: GameState, playerId: string): Player | undefined {
  return state.players.find(p => p.id === playerId);
}

function findBallCarrier(state: GameState): Player | undefined {
  return state.players.find(p => p.hasBall);
}

function attritionScore(
  state: GameState,
  team: TeamId,
  weights: EvalWeights
): number {
  let score = 0;
  for (const p of state.players) {
    const sign = p.team === team ? -1 : 1;
    if (p.state === 'casualty') {
      score += sign * weights.PLAYER_CASUALTY_PENALTY;
    } else if (p.state === 'sent_off') {
      score += sign * weights.PLAYER_SENT_OFF_PENALTY;
    } else if (p.state === 'knocked_out') {
      score += sign * weights.PLAYER_KO_PENALTY;
    } else if (p.stunned) {
      score += sign * weights.PLAYER_STUNNED_PENALTY;
    }
  }
  return score;
}

function playerCountScore(
  state: GameState,
  team: TeamId,
  weights: EvalWeights
): number {
  let score = 0;
  for (const p of state.players) {
    if (!isActive(p)) continue;
    score += (p.team === team ? 1 : -1) * weights.PLAYER_ACTIVE;
  }
  return score;
}

function carrierSafetyScore(
  state: GameState,
  team: TeamId,
  weights: EvalWeights
): number {
  const carrier = findBallCarrier(state);
  if (!carrier) return 0;
  const sign = carrier.team === team ? 1 : -1;

  const allies = state.players.filter(
    p =>
      p.team === carrier.team &&
      p.id !== carrier.id &&
      isActive(p) &&
      isAdjacent(p.pos, carrier.pos)
  ).length;
  const opponentsInTz = getAdjacentOpponents(state, carrier.pos, carrier.team).length;

  return (
    sign *
    (allies * weights.CARRIER_PROTECTION_ALLY -
      opponentsInTz * weights.CARRIER_TACKLEZONE_PENALTY)
  );
}

function chebyshevDistance(a: Position, b: Position): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/**
 * Score positionnel agrege sur tous les joueurs actifs de chaque equipe.
 * Sans cette composante, deplacer un joueur sans ballon laisse l evaluation
 * globale inchangee et l IA prefere systematiquement END_TURN.
 *
 * Heuristique simple :
 *  - Equipe en possession : on recompense la progression de chaque joueur
 *    actif vers la endzone adverse (pour escorter le porteur ou se rendre
 *    receveur).
 *  - Equipe sans la balle : on recompense la proximite au porteur adverse
 *    (pression / marquage). Si la balle est libre, on recompense la
 *    proximite a la balle (course au pickup).
 */
function positioningScore(
  state: GameState,
  team: TeamId,
  weights: EvalWeights
): number {
  const carrier = findBallCarrier(state);
  let total = 0;
  for (const p of state.players) {
    if (!isActive(p)) continue;
    const sign = p.team === team ? 1 : -1;

    if (carrier && p.team === carrier.team) {
      const distance = distanceToEndzone(state, p.pos, p.team);
      total += sign * (state.width - 1 - distance) * weights.POSITIONING_PER_STEP;
      continue;
    }

    if (carrier) {
      const distance = chebyshevDistance(p.pos, carrier.pos);
      total += sign * Math.max(0, state.width - distance) * weights.POSITIONING_PER_STEP;
      continue;
    }

    if (state.ball) {
      const distance = chebyshevDistance(p.pos, state.ball);
      total += sign * Math.max(0, state.width - distance) * weights.POSITIONING_PER_STEP;
    }
  }
  return total;
}

function ballProgressScore(
  state: GameState,
  team: TeamId,
  weights: EvalWeights
): number {
  const carrier = findBallCarrier(state);
  if (!carrier) return 0;
  const sign = carrier.team === team ? 1 : -1;
  const distance = distanceToEndzone(state, carrier.pos, carrier.team);
  const progress = (state.width - 1 - distance) * weights.BALL_PROGRESS_PER_STEP;
  const endzoneBonus = distance === 0 ? weights.CARRIER_IN_ENDZONE_BONUS : 0;
  return sign * (progress + endzoneBonus);
}

function possessionScore(
  state: GameState,
  team: TeamId,
  weights: EvalWeights
): number {
  const carrier = findBallCarrier(state);
  if (!carrier) return 0;
  return (carrier.team === team ? 1 : -1) * weights.POSSESSION;
}

function scoreDifferenceScore(
  state: GameState,
  team: TeamId,
  weights: EvalWeights
): number {
  const diff = teamScore(state, team) - teamScore(state, otherTeam(team));
  return diff * weights.TOUCHDOWN;
}

/**
 * Score global d'un GameState du point de vue de `team`.
 * Plus haut = meilleur pour `team`.
 *
 * Lot 3.A.0.a — accepte un override `weights` partiel pour modulation
 * tactique (sim-engine full driver passe les poids dérivés du
 * `TacticalProfile` de l'équipe).
 */
export function evaluatePosition(
  state: GameState,
  team: TeamId,
  weightsOverride?: Partial<EvalWeights>
): PositionEvaluation {
  if (state.gamePhase === 'ended' && state.score.teamA === 0 && state.score.teamB === 0) {
    const zero: EvaluationBreakdown = {
      score: 0,
      possession: 0,
      ballProgress: 0,
      playerCount: 0,
      carrierSafety: 0,
      attrition: 0,
      positioning: 0,
    };
    return { total: 0, breakdown: zero };
  }

  const weights = resolveWeights(weightsOverride);
  const breakdown: EvaluationBreakdown = {
    score: scoreDifferenceScore(state, team, weights),
    possession: possessionScore(state, team, weights),
    ballProgress: ballProgressScore(state, team, weights),
    playerCount: playerCountScore(state, team, weights),
    carrierSafety: carrierSafetyScore(state, team, weights),
    attrition: attritionScore(state, team, weights),
    positioning: positioningScore(state, team, weights),
  };

  const total =
    breakdown.score +
    breakdown.possession +
    breakdown.ballProgress +
    breakdown.playerCount +
    breakdown.carrierSafety +
    breakdown.attrition +
    breakdown.positioning;

  return { total, breakdown };
}

/**
 * Estimation simple de la probabilite de knockdown de la cible lors d'un
 * blocage : fonction monotone de la difference de force (incluant les
 * assistances indirectes via les joueurs adjacents).
 */
function estimateBlockKnockdown(state: GameState, attacker: Player, target: Player): number {
  const atkAssists = state.players.filter(
    p =>
      p.team === attacker.team &&
      p.id !== attacker.id &&
      isActive(p) &&
      isAdjacent(p.pos, target.pos)
  ).length;
  const defAssists = state.players.filter(
    p =>
      p.team === target.team && p.id !== target.id && isActive(p) && isAdjacent(p.pos, attacker.pos)
  ).length;
  const atkStrength = attacker.st + atkAssists;
  const defStrength = target.st + defAssists;

  if (atkStrength >= 2 * defStrength) return 0.7;
  if (atkStrength > defStrength) return 0.55;
  if (atkStrength === defStrength) return 0.33;
  if (defStrength >= 2 * atkStrength) return 0.08;
  return 0.18;
}

function scoreMoveMove(
  state: GameState,
  move: Extract<Move, { type: 'MOVE' }>,
  team: TeamId,
  weightsOverride?: Partial<EvalWeights>
): number {
  const player = findPlayer(state, move.playerId);
  if (!player) return -Infinity;

  const before = evaluatePosition(state, team, weightsOverride).total;
  const simulated: GameState = {
    ...state,
    players: state.players.map(p =>
      p.id === player.id ? { ...p, pos: move.to, pm: Math.max(0, p.pm - 1) } : p
    ),
    ball: player.hasBall ? { ...move.to } : state.ball,
  };
  const after = evaluatePosition(simulated, team, weightsOverride).total;
  return after - before;
}

function scoreMoveBlock(
  state: GameState,
  move: Extract<Move, { type: 'BLOCK' }>,
  team: TeamId,
  weightsOverride?: Partial<EvalWeights>
): number {
  const attacker = findPlayer(state, move.playerId);
  const target = findPlayer(state, move.targetId);
  if (!attacker || !target) return -Infinity;

  const weights = resolveWeights(weightsOverride);
  const knockdown = estimateBlockKnockdown(state, attacker, target);
  const knockoutValue =
    target.team === team
      ? -weights.PLAYER_ACTIVE - weights.PLAYER_STUNNED_PENALTY
      : weights.PLAYER_ACTIVE + weights.PLAYER_STUNNED_PENALTY;

  const possessionSwing = target.hasBall ? weights.POSSESSION * 0.5 : 0;
  const selfRisk = knockdown < 0.2 ? -30 : knockdown < 0.4 ? -10 : 0;
  return knockdown * (knockoutValue + possessionSwing) + selfRisk;
}

function scoreMoveBlitz(
  state: GameState,
  move: Extract<Move, { type: 'BLITZ' }>,
  team: TeamId,
  weightsOverride?: Partial<EvalWeights>
): number {
  const attacker = findPlayer(state, move.playerId);
  const target = findPlayer(state, move.targetId);
  if (!attacker || !target) return -Infinity;

  const moveDelta = scoreMoveMove(
    state,
    { type: 'MOVE', playerId: move.playerId, to: move.to },
    team,
    weightsOverride
  );
  const simulated: GameState = {
    ...state,
    players: state.players.map(p => (p.id === attacker.id ? { ...p, pos: move.to } : p)),
  };
  const blockDelta = scoreMoveBlock(
    simulated,
    { type: 'BLOCK', playerId: move.playerId, targetId: move.targetId },
    team,
    weightsOverride
  );
  return moveDelta + blockDelta;
}

function scoreMovePass(
  state: GameState,
  move: Extract<Move, { type: 'PASS' | 'HANDOFF' }>,
  team: TeamId,
  weightsOverride?: Partial<EvalWeights>
): number {
  const passer = findPlayer(state, move.playerId);
  const receiver = findPlayer(state, move.targetId);
  if (!passer || !receiver) return -Infinity;

  const simulated: GameState = {
    ...state,
    ball: { ...receiver.pos },
    players: state.players.map(p => {
      if (p.id === passer.id) return { ...p, hasBall: false };
      if (p.id === receiver.id) return { ...p, hasBall: true };
      return p;
    }),
  };
  const delta =
    evaluatePosition(simulated, team, weightsOverride).total -
    evaluatePosition(state, team, weightsOverride).total;
  const risk = move.type === 'PASS' ? -8 : 0;
  return delta + risk;
}

function scoreMoveFoul(
  state: GameState,
  move: Extract<Move, { type: 'FOUL' }>,
  team: TeamId
): number {
  const target = findPlayer(state, move.targetId);
  if (!target) return -Infinity;
  if (target.team === team) return -Infinity;
  const baseValue = target.hasBall ? 90 : 30;
  return baseValue - 40;
}

/**
 * Score heuristique d'un coup (perspective `team`).
 * Un score plus haut indique un coup juge preferable.
 *
 * Lot 3.A.0.a — accepte un override `weights` partiel (typiquement
 * dérivé du `TacticalProfile` côté sim-engine full driver).
 */
export function scoreMove(
  state: GameState,
  move: Move,
  team: TeamId,
  weightsOverride?: Partial<EvalWeights>
): number {
  const weights = resolveWeights(weightsOverride);
  switch (move.type) {
    case 'END_TURN':
      return -weights.END_TURN_PENALTY;
    case 'MOVE':
      return scoreMoveMove(state, move, team, weightsOverride);
    case 'LEAP':
      return (
        scoreMoveMove(
          state,
          { type: 'MOVE', playerId: move.playerId, to: move.to },
          team,
          weightsOverride
        ) - 15
      );
    case 'BLOCK':
      return scoreMoveBlock(state, move, team, weightsOverride);
    case 'BLITZ':
      return scoreMoveBlitz(state, move, team, weightsOverride);
    case 'PASS':
    case 'HANDOFF':
      return scoreMovePass(state, move, team, weightsOverride);
    case 'FOUL':
      return scoreMoveFoul(state, move, team);
    case 'END_PLAYER_TURN':
      return -5;
    default:
      return -50;
  }
}

/**
 * Retourne le coup legal au meilleur score pour `team` (null si aucun coup).
 * En cas d'egalite, conserve le premier coup rencontre (ordre stable).
 *
 * Lot 3.A.0.a — `weightsOverride` propagé jusqu'au scoring.
 */
export function pickBestMove(
  state: GameState,
  team: TeamId,
  weightsOverride?: Partial<EvalWeights>
): Move | null {
  const legal = getLegalMoves(state);
  if (legal.length === 0) return null;

  let bestMove: Move = legal[0];
  let bestScore = scoreMove(state, bestMove, team, weightsOverride);
  for (let i = 1; i < legal.length; i++) {
    const candidate = legal[i];
    const candidateScore = scoreMove(state, candidate, team, weightsOverride);
    if (candidateScore > bestScore) {
      bestScore = candidateScore;
      bestMove = candidate;
    }
  }
  return bestMove;
}
