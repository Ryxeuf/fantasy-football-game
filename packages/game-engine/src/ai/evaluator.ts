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
import { hasSkill } from '../skills/skill-effects';
import {
  findPlayerById,
  getActiveTeamPlayers,
  getBallCarrier as cachedBallCarrier,
} from '../core/state-cache';

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
  /**
   * Audit round 4 — scoring FOUL. Avant, ces valeurs etaient hardcodees
   * dans `scoreMoveFoul` (baseValue 90 carrier / 30 non-carrier, malus
   * -40 pour le risque turnover). Resultat : impossibles a moduler via
   * `TacticalProfile` (Goblins / Underworld avec haut `foulFrequency`
   * devraient valoriser plus les fouls, mais le score ignorait les
   * weights). Maintenant dans `EvalWeights` → modulables par profile.
   */
  FOUL_CARRIER_VALUE: 90,
  FOUL_NON_CARRIER_VALUE: 30,
  FOUL_TURNOVER_RISK: 40,
  /**
   * Audit round 4 — scoring PASS. Avant : malus hardcode -8 pour PASS,
   * 0 pour HANDOFF. Maintenant modulable via `PASS_RISK_PENALTY` (un
   * profil pace+pass-heavy peut le baisser, un profil bash le hausser).
   */
  PASS_RISK_PENALTY: 8,
  HANDOFF_RISK_PENALTY: 0,
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
  // Sprint Perf : delegation au cache WeakMap (O(1) via Map) au lieu
  // du O(n) precedent. Comportement identique pour les ids manquants
  // (retourne undefined).
  return findPlayerById(state, playerId);
}

function findBallCarrier(state: GameState): Player | undefined {
  // Sprint Perf : cache WeakMap, cache aussi l'absence de porteur
  // (frequent en debut de drive / apres turnover).
  return cachedBallCarrier(state);
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

  // Sprint Perf : iteration sur les actifs deja filtres (cache
  // WeakMap), evite le re-filtre `isActive` sur l'integralite des
  // joueurs a chaque appel.
  let allies = 0;
  for (const p of getActiveTeamPlayers(state, carrier.team)) {
    if (p.id !== carrier.id && isAdjacent(p.pos, carrier.pos)) {
      allies++;
    }
  }
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
 * Sprint Perf (audit 2026-05-19 §13) — cache des resultats
 * `evaluatePosition` par state immuable. `scoreMoveMove` /
 * `scoreMovePass` calculent un `before = evaluatePosition(state, team)`
 * pour chaque coup candidat : meme state, meme team, meme weights.
 * Avec N coups candidats, on faisait N appels identiques au calcul ;
 * desormais on en fait un seul.
 *
 * Cache uniquement les appels sans override de poids : l'override est
 * une reference partielle dont on ne peut pas hasher proprement, et
 * en pratique le hot path standard (tests, gameplay direct) n'en
 * utilise pas. Le full driver sim-engine passe des weights — il
 * tombera sur le slow path mais c'est acceptable (cf. roadmap
 * S27.x : refacto futur pour figer un EvalWeights stable et cacher
 * par profile).
 */
interface EvalCacheEntry {
  A?: PositionEvaluation;
  B?: PositionEvaluation;
}
const evalCache: WeakMap<GameState, EvalCacheEntry> = new WeakMap();

function evaluatePositionUncached(
  state: GameState,
  team: TeamId,
  weights: EvalWeights
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
  // Slow path : un override de poids casse le cache (cf. note ci-dessus).
  if (weightsOverride) {
    return evaluatePositionUncached(state, team, resolveWeights(weightsOverride));
  }
  let entry = evalCache.get(state);
  if (!entry) {
    entry = {};
    evalCache.set(state, entry);
  }
  if (!entry[team]) {
    entry[team] = evaluatePositionUncached(state, team, EVAL_WEIGHTS);
  }
  return entry[team]!;
}

/**
 * Probabilites de knockdown calibrees sur les faces de des de Blood Bowl
 * 2020 (POW, POW/PUSH, PUSH, BOTH_DOWN, ATTACKER_DOWN) — l'attaquant
 * (ou le defenseur) choisit le meilleur (pire) parmi N des selon le
 * ratio de force.
 */
const KNOCKDOWN_BASE = {
  /** Attaquant >= 2x defenseur : 3 des, attaquant choisit. */
  attackerThreeDice: 0.7,
  /** Attaquant > defenseur : 2 des, attaquant choisit. */
  attackerTwoDice: 0.56,
  /** Force egale : 1 de. */
  equal: 0.33,
  /** Defenseur > attaquant (sans 2x) : 2 des, defenseur choisit. */
  defenderTwoDice: 0.11,
  /** Defenseur >= 2x attaquant : 3 des, defenseur choisit. */
  defenderThreeDice: 0.05,
} as const;

/**
 * Probabilite que l'attaquant tombe lui-meme apres son block (ATTACKER_DOWN
 * ou BOTH_DOWN sans skill Block). Sans skill, BOTH_DOWN (1/6) + ATTACKER_DOWN
 * (1/6) = 2/6 sur un de. Avec Block, BOTH_DOWN ne fait pas tomber l'attaquant.
 */
const SELFDOWN_BASE = {
  attackerThreeDice: 0.02,
  attackerTwoDice: 0.06,
  equal: 0.33,
  defenderTwoDice: 0.55,
  defenderThreeDice: 0.7,
} as const;

const SELFDOWN_WITH_BLOCK_MULT = 0.5; // BOTH_DOWN annule pour l'attaquant
const DEFENDER_BLOCK_KD_MULT = 0.83; // BOTH_DOWN n'abat plus le defenseur
const DEFENDER_DODGE_KD_MULT = 0.83; // STUMBLE devient PUSH sans Tackle adverse
const DEFENDER_WRESTLE_KD_MULT = 0.92; // BOTH_DOWN: choix mutuel down

interface BlockProbabilities {
  readonly knockdown: number;
  readonly selfDown: number;
}

/**
 * Determine le ratio de force pour un block, en tenant compte des
 * assistances et du skill Dauntless (qui permet de jouer comme si la force
 * etait egale a celle de la cible — modelise ici en probabilite-pondere).
 */
function computeEffectiveStrength(
  state: GameState,
  attacker: Player,
  target: Player,
  isBlitz: boolean
): { atk: number; def: number; dauntlessUpscaleProb: number } {
  // Sprint Perf : cache WeakMap des actifs par equipe — eligibles ont
  // deja le filtre isActive applique, on n'en a que la proximite a
  // verifier.
  let atkAssists = 0;
  for (const p of getActiveTeamPlayers(state, attacker.team)) {
    if (p.id !== attacker.id && isAdjacent(p.pos, target.pos)) {
      atkAssists++;
    }
  }
  let defAssists = 0;
  for (const p of getActiveTeamPlayers(state, target.team)) {
    if (p.id !== target.id && isAdjacent(p.pos, attacker.pos)) {
      defAssists++;
    }
  }
  const hornsBonus = isBlitz && hasSkill(attacker, 'horns') ? 1 : 0;
  const atk = attacker.st + atkAssists + hornsBonus;
  const def = target.st + defAssists;

  // Dauntless : si la cible est plus forte, l'attaquant lance 1D6 + sa ST.
  // Si le total >= ST cible, il joue comme si ST egales. Probabilite =
  // (7 - delta) / 6 si delta in [1..6], sinon 0.
  let dauntlessUpscaleProb = 0;
  if (hasSkill(attacker, 'dauntless') && def > atk) {
    const delta = def - atk;
    if (delta >= 1 && delta <= 6) {
      dauntlessUpscaleProb = (7 - delta) / 6;
    }
  }
  return { atk, def, dauntlessUpscaleProb };
}

function probsFromRatio(atk: number, def: number): BlockProbabilities {
  if (atk >= 2 * def) {
    return { knockdown: KNOCKDOWN_BASE.attackerThreeDice, selfDown: SELFDOWN_BASE.attackerThreeDice };
  }
  if (atk > def) {
    return { knockdown: KNOCKDOWN_BASE.attackerTwoDice, selfDown: SELFDOWN_BASE.attackerTwoDice };
  }
  if (atk === def) {
    return { knockdown: KNOCKDOWN_BASE.equal, selfDown: SELFDOWN_BASE.equal };
  }
  if (def >= 2 * atk) {
    return { knockdown: KNOCKDOWN_BASE.defenderThreeDice, selfDown: SELFDOWN_BASE.defenderThreeDice };
  }
  return { knockdown: KNOCKDOWN_BASE.defenderTwoDice, selfDown: SELFDOWN_BASE.defenderTwoDice };
}

/**
 * Estimation des probabilites d'issue d'un block, avec prise en compte
 * des skills cles (Block, Dodge, Tackle, Wrestle, Dauntless, Horns).
 *
 * Retourne deux probabilites independantes :
 *  - `knockdown` : la cible tombe (= valeur offensive du block)
 *  - `selfDown`  : l'attaquant tombe (= turnover potentiel, risque)
 *
 * Les deux peuvent coexister (BOTH_DOWN sans skills), c'est pour cela
 * qu'on ne les modelise pas en somme = 1.
 */
function estimateBlockProbabilities(
  state: GameState,
  attacker: Player,
  target: Player,
  isBlitz = false
): BlockProbabilities {
  const { atk, def, dauntlessUpscaleProb } = computeEffectiveStrength(state, attacker, target, isBlitz);

  const baseProbs = probsFromRatio(atk, def);
  // Dauntless : avec probabilite p, on joue a force egale (meilleur que sub-force).
  const probs: BlockProbabilities =
    dauntlessUpscaleProb > 0
      ? {
          knockdown:
            baseProbs.knockdown * (1 - dauntlessUpscaleProb) +
            KNOCKDOWN_BASE.equal * dauntlessUpscaleProb,
          selfDown:
            baseProbs.selfDown * (1 - dauntlessUpscaleProb) +
            SELFDOWN_BASE.equal * dauntlessUpscaleProb,
        }
      : baseProbs;

  // Skills defensifs reduisent le knockdown.
  let kdMult = 1;
  if (hasSkill(target, 'block')) kdMult *= DEFENDER_BLOCK_KD_MULT;
  if (hasSkill(target, 'dodge') && !hasSkill(attacker, 'tackle')) {
    kdMult *= DEFENDER_DODGE_KD_MULT;
  }
  if (hasSkill(target, 'wrestle')) kdMult *= DEFENDER_WRESTLE_KD_MULT;

  // Skill Block attaquant : reduit fortement le selfDown (annule BOTH_DOWN).
  const selfMult = hasSkill(attacker, 'block') ? SELFDOWN_WITH_BLOCK_MULT : 1;

  return {
    knockdown: probs.knockdown * kdMult,
    selfDown: probs.selfDown * selfMult,
  };
}

/**
 * Backward-compat shim : meme signature que l'ancien `estimateBlockKnockdown`,
 * pour eviter de toucher les callers qui ne consomment que la probabilite
 * de knockdown (lookahead, tests existants).
 */
function estimateBlockKnockdown(state: GameState, attacker: Player, target: Player): number {
  return estimateBlockProbabilities(state, attacker, target, false).knockdown;
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

function scoreMoveBlockInternal(
  state: GameState,
  attackerId: string,
  targetId: string,
  team: TeamId,
  isBlitz: boolean,
  weightsOverride?: Partial<EvalWeights>
): number {
  const attacker = findPlayer(state, attackerId);
  const target = findPlayer(state, targetId);
  if (!attacker || !target) return -Infinity;

  const weights = resolveWeights(weightsOverride);
  const { knockdown, selfDown } = estimateBlockProbabilities(state, attacker, target, isBlitz);

  const knockoutValue =
    target.team === team
      ? -weights.PLAYER_ACTIVE - weights.PLAYER_STUNNED_PENALTY
      : weights.PLAYER_ACTIVE + weights.PLAYER_STUNNED_PENALTY;

  const possessionSwing = target.hasBall ? weights.POSSESSION * 0.5 : 0;
  // selfRisk = perte de valeur attendue si l'attaquant tombe (turnover + lui-meme stunned).
  const selfRisk = -selfDown * (weights.PLAYER_ACTIVE + weights.PLAYER_STUNNED_PENALTY);
  return knockdown * (knockoutValue + possessionSwing) + selfRisk;
}

function scoreMoveBlock(
  state: GameState,
  move: Extract<Move, { type: 'BLOCK' }>,
  team: TeamId,
  weightsOverride?: Partial<EvalWeights>
): number {
  return scoreMoveBlockInternal(state, move.playerId, move.targetId, team, false, weightsOverride);
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
  const blockDelta = scoreMoveBlockInternal(
    simulated,
    move.playerId,
    move.targetId,
    team,
    true, // isBlitz=true → active Horns si present
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
  // BUG fix audit round 4 : avant le risque etait hardcode -8 pour
  // PASS et 0 pour HANDOFF. Maintenant modulable via weights.
  const weights = resolveWeights(weightsOverride);
  const risk =
    move.type === 'PASS' ? -weights.PASS_RISK_PENALTY : -weights.HANDOFF_RISK_PENALTY;
  return delta + risk;
}

function scoreMoveFoul(
  state: GameState,
  move: Extract<Move, { type: 'FOUL' }>,
  team: TeamId,
  weightsOverride?: Partial<EvalWeights>
): number {
  const target = findPlayer(state, move.targetId);
  if (!target) return -Infinity;
  if (target.team === team) return -Infinity;
  // BUG fix audit round 4 : avant ces valeurs etaient hardcodees
  // (90 / 30 / -40). Maintenant modulables via weights pour permettre
  // aux profils foul-happy (Goblins / Underworld) de valoriser plus.
  const weights = resolveWeights(weightsOverride);
  const baseValue = target.hasBall
    ? weights.FOUL_CARRIER_VALUE
    : weights.FOUL_NON_CARRIER_VALUE;
  return baseValue - weights.FOUL_TURNOVER_RISK;
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
      return scoreMoveFoul(state, move, team, weightsOverride);
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
