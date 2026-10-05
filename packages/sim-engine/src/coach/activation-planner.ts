/**
 * Lot 3 « cerveau du coach » — PLANIFICATEUR D'ACTIVATIONS.
 *
 * Pour chaque joueur encore activable, génère des ACTIVATIONS ENTIÈRES
 * (chemin case par case + action finale) et les score en espérance :
 *
 *   EV = P(succès de la séquence) × gain − (1 − P) × coût du turnover
 *
 * Le chemin vers chaque case est le plus SÛR (relaxation par couches de
 * pas, esquives, GFI et ramassage compris), pas le plus court. Le gain est
 * le delta de la fonction de valeur locale (`evaluate.ts`) ; un blocage
 * ajoute l'espérance de mise au sol moins le risque de chute de l'attaquant.
 *
 * Pur : ne consomme pas de RNG, ne mute pas l'état.
 */

import { canTeamBlitz, canUseTeamReroll, getDodgeSkillModifiers, hasPlayerActed, hasSkill, inBounds, isAdjacent, isProne } from '@bb/game-engine';
import type { GameState, Move, Player, Position, TeamId } from '@bb/game-engine';

import type { DrivePlan } from './drive-plan';
import { VALUE, buildEvalContext, chebyshev, endzoneX, isStanding, knockdownGain, onPitch, playerContribution, type EvalContext } from './evaluate';
import { personalityFor, traitFactor } from './personality';
import { armourBreak, blockOutcome, catchSuccess, gfiSuccess, passSuccess, pD6, pickupSuccess, withReroll } from './probability';
import { calculateDodgeTarget, calculatePickupTarget, calculatePickupModifiers, getWeatherModifiers } from '@bb/game-engine';

/** Classe de risque, dans l'ordre canonique BB d'un tour. */
export type RiskClass = 0 | 1 | 2 | 3 | 4;

export type ActivationKind = 'move' | 'block' | 'blitz' | 'pass' | 'handoff' | 'foul' | 'stand';

export interface ActivationCandidate {
  readonly playerId: string;
  readonly kind: ActivationKind;
  /** Coups à jouer dans l'ordre, `END_PLAYER_TURN` compris. */
  readonly moves: readonly Move[];
  /** Probabilité que toute la séquence réussisse. */
  readonly probability: number;
  readonly gain: number;
  readonly ev: number;
  readonly riskClass: RiskClass;
  readonly targetId?: string;
  /** Case finale du joueur (pour ancrer la cage sur le porteur). */
  readonly finalPos: Position;
  /** Le chemin ramasse le ballon. */
  readonly picksBall?: boolean;
  /** Blocage à un dé sans Blocage : un pari, jamais boosté comme « libérateur ». */
  readonly wager?: boolean;
}

export interface PathNode {
  readonly pos: Position;
  readonly steps: number;
  /** Produit des réussites jusqu'ici. */
  readonly prob: number;
  /** Le jet le moins sûr du chemin (celui qu'une relance d'équipe couvrirait). */
  readonly worstRoll: number;
  readonly dodges: number;
  readonly gfis: number;
  readonly picksBall: boolean;
  readonly parent: PathNode | null;
}

const DIRS: readonly Position[] = [
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
  { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 },
];

export interface PlannerInput {
  readonly state: GameState;
  readonly team: TeamId;
  readonly plan: DrivePlan;
  /** Joueurs activables (issus des coups légaux). */
  readonly eligible: ReadonlySet<string>;
  /** Nombre maximal de GFI consentis hors cas de score. */
  readonly maxGfi: number;
  /** Case visée par le porteur ce tour (calculée par le coach). */
  readonly carrierTarget?: Position;
}

/** Coût d'un turnover maintenant : ce que le reste du tour aurait rapporté. */
export function turnoverCost(state: GameState, team: TeamId, carrierInvolved: boolean): number {
  let remaining = 0;
  for (const p of state.players) {
    if (p.team === team && onPitch(p) && isStanding(p) && !hasPlayerActed(state, p.id)) remaining++;
  }
  // Un porteur qui chute lâche le ballon sur place : la possession est
  // DISPUTÉE, pas perdue — la moitié de sa valeur.
  return 60 + 20 * Math.max(0, remaining - 1) + (carrierInvolved ? VALUE.POSSESSION * 0.5 : 0) + VALUE.STANDING + VALUE.PRONE;
}

/**
 * Cases atteignables par `player` avec leur chemin le plus sûr.
 * `budget` = PM disponibles (après un relevé éventuel).
 */
export function reachableSquares(
  ctx: EvalContext,
  player: Player,
  budget: number,
  maxGfi: number,
  startHasBall: boolean,
): ReadonlyMap<number, PathNode> {
  const { state } = ctx;
  const W = state.width;
  const idx = (p: Position): number => p.y * W + p.x;
  const occupied = new Uint8Array(W * state.height);
  for (const p of state.players) if (onPitch(p) && p.id !== player.id) occupied[idx(p.pos)] = 1;
  const ballIdx = state.ball && !startHasBall ? idx(state.ball) : -1;
  const maxSteps = budget + maxGfi;
  const gfi = gfiSuccess(state, player);
  const weatherAg = getWeatherModifiers(state.weatherCondition).agilityModifier;
  const dodgeReroll = hasSkill(player, 'dodge');
  const best = new Map<number, PathNode>();
  const start: PathNode = { pos: player.pos, steps: 0, prob: 1, worstRoll: 1, dodges: 0, gfis: 0, picksBall: false, parent: null };
  best.set(idx(player.pos), start);
  let frontier: PathNode[] = [start];
  for (let layer = 0; layer < maxSteps && frontier.length > 0; layer++) {
    const next: PathNode[] = [];
    for (const node of frontier) {
      if (best.get(idx(node.pos)) !== node) continue;
      const fromTz = ctx.oppTackleZones.at(node.pos);
      let skillMods = 0;
      let tacklerAdjacent = false;
      if (fromTz > 0) {
        skillMods = getDodgeSkillModifiers(state, player, node.pos);
        for (const o of ctx.opponentsStanding) {
          if (isAdjacent(o.pos, node.pos) && hasSkill(o, 'tackle')) { tacklerAdjacent = true; break; }
        }
      }
      for (const d of DIRS) {
        const to = { x: node.pos.x + d.x, y: node.pos.y + d.y };
        if (!inBounds(state, to)) continue;
        const k = idx(to);
        if (occupied[k]) continue;
        let p = 1;
        let dodges = node.dodges;
        let gfis = node.gfis;
        if (fromTz > 0) {
          const mods = -ctx.oppTackleZones.at(to) + skillMods + weatherAg;
          p *= withReroll(pD6(calculateDodgeTarget(player, mods)), dodgeReroll && !tacklerAdjacent);
          dodges++;
        }
        if (node.steps + 1 > budget) {
          p *= gfi;
          gfis++;
        }
        let picksBall = node.picksBall;
        if (ballIdx === k) {
          const mods = calculatePickupModifiers(state, to, player.team, player) + weatherAg;
          p *= hasSkill(player, 'no-hands') ? 0 : withReroll(pD6(calculatePickupTarget(player, mods)), hasSkill(player, 'sure-hands'));
          picksBall = true;
        }
        const prob = node.prob * p;
        if (prob <= 0.02) continue;
        const prev = best.get(k);
        if (prev && (prev.prob > prob + 1e-9 || (Math.abs(prev.prob - prob) <= 1e-9 && prev.steps <= node.steps + 1))) continue;
        const nn: PathNode = { pos: to, steps: node.steps + 1, prob, worstRoll: Math.min(node.worstRoll, p), dodges, gfis, picksBall, parent: node };
        best.set(k, nn);
        next.push(nn);
      }
    }
    frontier = next;
  }
  return best;
}

function pathMoves(node: PathNode, playerId: string): Move[] {
  const positions: Position[] = [];
  let cur: PathNode | null = node;
  while (cur && cur.parent) {
    positions.push(cur.pos);
    cur = cur.parent;
  }
  positions.reverse();
  return positions.map((to) => ({ type: 'MOVE', playerId, to }));
}

function riskOfPath(node: PathNode): RiskClass {
  if (node.picksBall) return 3;
  if (node.dodges > 0 || node.gfis > 0) return 4;
  return 0;
}

function maxRisk(a: RiskClass, b: RiskClass): RiskClass {
  return (a > b ? a : b) as RiskClass;
}

interface BlockEv {
  readonly ev: number;
  readonly gain: number;
  readonly selfDown: number;
  readonly dice: number;
  readonly chooser: 'attacker' | 'defender';
  readonly oneDie: boolean;
}

function blockEv(
  ctx: EvalContext,
  attacker: Player,
  attackerPos: Position,
  target: Player,
  isBlitz: boolean,
  pathProb: number,
  moveGain: number,
  cost: number,
  aggression: number,
  teamReroll: boolean,
): BlockEv | null {
  const outcome = blockOutcome(ctx.state, attacker, target, isBlitz, attackerPos);
  // Un blocage à 2 dés contre soi n'est jamais envisagé par un coach.
  if (outcome.dice.chooser === 'defender' && outcome.dice.dice >= 2) return null;
  // Une relance d'équipe couvre un jet de blocage raté : la chute de
  // l'attaquant exige alors deux mauvais tirages.
  const selfDown = teamReroll ? outcome.selfDown * outcome.selfDown : outcome.selfDown;
  const kdGain = knockdownGain(ctx, target) + armourBreak(target) * 40;
  const expectedBlock = outcome.knockdown * kdGain - selfDown * cost;
  const gain = moveGain + expectedBlock;
  // Un blocage à un dé sans Blocage est un pari : un coach ne le prend que
  // s'il rapporte gros (porteur, marqueur du porteur), avec une relance en
  // poche, et il passe en fin de tour (classe de risque des esquives).
  const oneDie = outcome.dice.dice === 1 && !hasSkill(attacker, 'block');
  const myCarrier = ctx.carrier && ctx.carrier.team === attacker.team ? ctx.carrier : undefined;
  const worthTheWager = target.hasBall || (myCarrier !== undefined && isAdjacent(target.pos, myCarrier.pos));
  let ev = (pathProb * gain - (1 - pathProb) * cost) * traitFactor(aggression, 0.2);
  if (oneDie) {
    ev *= worthTheWager ? 0.6 : 0.3;
    if (!worthTheWager && ev < 25) ev = -1;
    if (worthTheWager && !teamReroll && ev < 15) ev = -1;
  }
  return { ev, gain, selfDown, dice: outcome.dice.dice, chooser: outcome.dice.chooser, oneDie };
}

/**
 * Probabilité d'un chemin en comptant la relance d'équipe sur son jet le
 * moins sûr, si le plan la dépenserait (`wantsTeamReroll` applique la même
 * règle au moment du jet).
 */
export function pathProbability(node: PathNode, teamRerollAvailable: boolean, plan: DrivePlan, critical: boolean): number {
  if (!teamRerollAvailable || node.worstRoll >= 1) return node.prob;
  const threshold = critical ? Math.min(plan.rerollThreshold, 0.5) : plan.rerollThreshold;
  if (node.worstRoll < threshold) return node.prob;
  return (node.prob / node.worstRoll) * withReroll(node.worstRoll, true);
}

/** Génère les candidats d'un joueur. */
export function planPlayerActivations(input: PlannerInput, ctx: EvalContext, player: Player): ActivationCandidate[] {
  const { state, team, plan } = input;
  const out: ActivationCandidate[] = [];
  const persona = personalityFor(player.id);
  const role = ctx.roles.get(player.id) ?? 'lineman';
  if (hasPlayerActed(state, player.id)) return out;
  const prone = isProne(player);

  const prefix: Move[] = [];
  let budget = player.pm;
  if (prone) {
    prefix.push({ type: 'STAND_UP', playerId: player.id });
    budget = hasSkill(player, 'jump-up') ? player.ma : Math.max(0, player.ma - 3);
  }
  const endOf = (moves: Move[]): Move[] => [...prefix, ...moves, { type: 'END_PLAYER_TURN', playerId: player.id }];
  const startHasBall = !!player.hasBall;
  const base = prone ? -VALUE.PRONE : playerContribution(ctx, player, player.pos, startHasBall);
  const ownEndzone = endzoneX(state, team);
  const cautionFactor = traitFactor(persona.caution, 0.3);
  const riskFloor = Math.min(0.95, plan.riskFloor * cautionFactor);
  const gfiAllowed = Math.min(input.maxGfi, persona.discipline >= 70 ? 1 : 2);
  const carrierCost = turnoverCost(state, team, startHasBall);
  const plainCost = turnoverCost(state, team, false);

  if (prone) {
    const gain = playerContribution(ctx, player, player.pos, startHasBall) - base;
    out.push({ playerId: player.id, kind: 'stand', moves: endOf([]), probability: 1, gain, ev: gain, riskClass: 0, finalPos: player.pos });
  }

  const teamReroll = canUseTeamReroll(state, team);
  const reach = reachableSquares(ctx, player, budget, gfiAllowed, startHasBall);
  const blitzAvailable = canTeamBlitz(state, team) && !state.kickoffBlitzTurn && !prone;
  const myCarrier = ctx.carrier && ctx.carrier.team === team ? ctx.carrier : undefined;

  for (const rawNode of reach.values()) {
    if (rawNode.steps === 0) continue;
    const hasBall = startHasBall || rawNode.picksBall;
    const node = { ...rawNode, prob: pathProbability(rawNode, teamReroll, plan, hasBall) };
    const scoresTd = hasBall && node.pos.x === ownEndzone;
    // Marquer vaut TOUJOURS un touchdown de plus que rester : le gain est
    // posé sur la base, pas comparé à elle (sinon un porteur à une case de
    // l'en-but, dont la progression vaut déjà beaucoup, ne rentrerait pas).
    const contribution = scoresTd
      ? base + VALUE.TOUCHDOWN
      : playerContribution(ctx, player, node.pos, hasBall) + (node.picksBall ? VALUE.POSSESSION : 0);
    const gain = contribution - base;
    const risk = riskOfPath(node);
    // Un ramassage raté laisse le ballon au sol (pas aux adversaires) : le
    // coût est celui d'un turnover ordinaire, pas d'une perte de possession.
    const cost = startHasBall ? carrierCost : node.picksBall ? plainCost + 40 : plainCost;
    // Plancher de risque : hors cas de score ou de ramassage, on refuse les
    // séquences trop incertaines (le porteur, lui, doit parfois forcer).
    const floor = hasBall ? riskFloor - 0.15 : riskFloor;
    if (!scoresTd && !node.picksBall && node.prob < floor) continue;
    if (gain > 0) {
      const ev = node.prob * gain - (1 - node.prob) * cost;
      if (ev > 0) {
        out.push({ playerId: player.id, kind: 'move', moves: endOf(pathMoves(node, player.id)), probability: node.prob, gain, ev, riskClass: risk, finalPos: node.pos, picksBall: node.picksBall });
      }
    }

    // Blitz : arriver au contact avec au moins 1 PM, puis bloquer.
    if (blitzAvailable && !hasBall && node.steps <= budget - 1) {
      for (const target of ctx.opponentsStanding) {
        if (!isAdjacent(node.pos, target.pos)) continue;
        const ev = blockEv(ctx, player, node.pos, target, true, node.prob, gain, plainCost, persona.aggression, teamReroll);
        if (ev === null) continue;
        let evAdj = ev.ev;
        if (plan.keepBlitzForCarrier && myCarrier && !isAdjacent(target.pos, myCarrier.pos)) evAdj -= 25;
        if (evAdj <= 0) continue;
        const moves =
          node.steps === 1
            ? [{ type: 'BLITZ', playerId: player.id, to: node.pos, targetId: target.id } as Move]
            : [...pathMoves(node, player.id), { type: 'BLOCK', playerId: player.id, targetId: target.id } as Move];
        out.push({
          playerId: player.id,
          kind: 'blitz',
          moves: endOf(moves),
          probability: node.prob * (1 - ev.selfDown),
          gain: ev.gain,
          ev: evAdj,
          riskClass: maxRisk(risk, ev.oneDie ? 4 : 2),
          targetId: target.id,
          finalPos: node.pos,
          wager: ev.oneDie,
        });
      }
    }
  }

  // Blocage sur place (début d'activation, adversaire adjacent).
  if (!prone && !state.kickoffBlitzTurn) {
    for (const target of ctx.opponentsStanding) {
      if (!isAdjacent(player.pos, target.pos)) continue;
      // Le porteur qui bloque risque le ballon : coût d'un turnover de porteur.
      const ev = blockEv(ctx, player, player.pos, target, false, 1, 0, startHasBall ? carrierCost : plainCost, persona.aggression, teamReroll);
      if (ev === null || ev.ev <= 0) continue;
      out.push({
        playerId: player.id,
        kind: 'block',
        moves: endOf([{ type: 'BLOCK', playerId: player.id, targetId: target.id }]),
        probability: 1 - ev.selfDown,
        gain: ev.gain,
        ev: ev.ev,
        riskClass: ev.oneDie ? 4 : ev.dice >= 2 && ev.chooser === 'attacker' ? 1 : 2,
        targetId: target.id,
        finalPos: player.pos,
        wager: ev.oneDie,
      });
    }
  }

  // Passe et remise (début d'activation uniquement : règle du moteur).
  if (startHasBall && !prone && !state.kickoffBlitzTurn) {
    const passerAfter = playerContribution(ctx, player, player.pos, false) - base;
    const passCost = carrierCost * (1.4 - (plan.passingFrequency / 100) * 0.8);
    for (const receiver of ctx.alliesStanding) {
      if (receiver.id === player.id) continue;
      const adjacent = isAdjacent(player.pos, receiver.pos);
      const p = adjacent ? catchSuccess(state, receiver, true) : passSuccess(state, player, receiver);
      if (p <= 0.05) continue;
      const receiverGreed = traitFactor(personalityFor(receiver.id).greed, 0.2);
      const scoresTd = receiver.pos.x === ownEndzone;
      const before = playerContribution(ctx, receiver, receiver.pos, false);
      const after = scoresTd ? before + VALUE.TOUCHDOWN : playerContribution(ctx, receiver, receiver.pos, true) * receiverGreed;
      const gain = after - before + passerAfter;
      if (gain <= 0) continue;
      const ev = p * gain - (1 - p) * (adjacent ? carrierCost : passCost);
      if (ev <= 0) continue;
      out.push({
        playerId: player.id,
        kind: adjacent ? 'handoff' : 'pass',
        moves: endOf([{ type: adjacent ? 'HANDOFF' : 'PASS', playerId: player.id, targetId: receiver.id } as Move]),
        probability: p,
        gain,
        ev,
        riskClass: 3,
        targetId: receiver.id,
        finalPos: player.pos,
      });
    }
  }

  // Agression : adversaire au sol adjacent, une par tour, selon l'appétit.
  if (!prone && plan.foulAppetite > 0.05 && !state.kickoffBlitzTurn && (state.teamFoulCount?.[team] ?? 0) === 0) {
    for (const target of ctx.opponents) {
      if (!target.stunned || !isAdjacent(player.pos, target.pos)) continue;
      let assists = 0;
      for (const a of ctx.alliesStanding) if (a.id !== player.id && isAdjacent(a.pos, target.pos)) assists++;
      const breakP = armourBreak(target, assists + (hasSkill(player, 'dirty-player') ? 1 : 0));
      const gain = breakP * (VALUE.STANDING + VALUE.PRONE + 30) * (role === 'fouler' ? 1.3 : 1);
      // Expulsion sur un double (armure ou blessure) : le joueur ET le tour.
      const sentOffRisk = (hasSkill(player, 'sneaky-git') ? 0.1 : 0.28) * (VALUE.STANDING * 2 + plainCost);
      const ev = (gain * plan.foulAppetite - sentOffRisk * (1 - plan.foulAppetite * 0.5)) * traitFactor(100 - persona.discipline, 0.4);
      if (ev <= 0) continue;
      out.push({
        playerId: player.id,
        kind: 'foul',
        moves: endOf([{ type: 'FOUL', playerId: player.id, targetId: target.id }]),
        probability: 1,
        gain,
        ev,
        riskClass: 4,
        targetId: target.id,
        finalPos: player.pos,
      });
    }
  }

  return out;
}

/**
 * Libérer le porteur AVANT de le faire esquiver : quand notre porteur est
 * marqué, les blocages et blitz sur ses marqueurs héritent d'une part de ce
 * que son déplacement rapporterait (un marqueur repoussé ou au sol rend le
 * chemin libre), et ses esquives sont décotées tant qu'un tel blocage reste
 * disponible. Les candidats sont regénérés à chaque activation : une fois
 * les marqueurs écartés, le porteur se déplace sans jet.
 */
function sequenceAroundCarrier(
  input: PlannerInput,
  ctx: EvalContext,
  candidates: ActivationCandidate[],
): ActivationCandidate[] {
  const carrier = ctx.carrier;
  if (!carrier || carrier.team !== ctx.team || hasPlayerActed(ctx.state, carrier.id)) return candidates;
  let carrierBest = 0;
  for (const c of candidates) if (c.playerId === carrier.id && c.kind === 'move') carrierBest = Math.max(carrierBest, c.ev);

  // OUVRIR LE COULOIR : ce que le porteur gagnerait si tel adversaire proche
  // n'était plus debout (repoussé ou au sol). Les blocages et blitz sur cet
  // adversaire en héritent, pondérés par leur chance de le déplacer.
  const laneValue = new Map<string, number>();
  const near = ctx.opponentsStanding.filter((o) => chebyshev(o.pos, carrier.pos) <= 3);
  const carrierBestWithout = (removed: readonly string[]): number => {
    const without = buildEvalContext(
      { ...ctx.state, players: ctx.state.players.map((p) => (removed.includes(p.id) ? { ...p, stunned: true } : p)) },
      ctx.team,
      ctx.plan,
      input.carrierTarget,
    );
    let best = 0;
    for (const c of planPlayerActivations(input, without, carrier)) if (c.kind === 'move') best = Math.max(best, c.ev);
    return best;
  };
  for (const o of near) {
    const delta = carrierBestWithout([o.id]) - Math.max(0, carrierBest);
    if (delta > 10) laneValue.set(o.id, delta);
  }
  // Porteur ENCERCLÉ (aucun adversaire seul ne libère le couloir) : on
  // regarde les paires d'adversaires les plus proches — deux blocages
  // ouvrent souvent ce qu'un seul ne peut pas.
  if (laneValue.size === 0 && carrierBest <= 0 && near.length >= 2) {
    const closest = [...near].sort((a, b) => chebyshev(a.pos, carrier.pos) - chebyshev(b.pos, carrier.pos)).slice(0, 4);
    for (let i = 0; i < closest.length; i++) {
      for (let j = i + 1; j < closest.length; j++) {
        const delta = carrierBestWithout([closest[i].id, closest[j].id]);
        if (delta > 10) {
          laneValue.set(closest[i].id, Math.max(laneValue.get(closest[i].id) ?? 0, delta * 0.5));
          laneValue.set(closest[j].id, Math.max(laneValue.get(closest[j].id) ?? 0, delta * 0.5));
        }
      }
    }
  }
  if (laneValue.size === 0) return candidates;
  const markers = new Set(ctx.opponentsStanding.filter((o) => isAdjacent(o.pos, carrier.pos)).map((o) => o.id));
  let freeing = false;
  const boosted = candidates.map((c) => {
    if ((c.kind === 'block' || c.kind === 'blitz') && c.targetId && c.playerId !== carrier.id && c.ev > 0 && !c.wager) {
      const lane = laneValue.get(c.targetId) ?? 0;
      if (lane <= 0) return c;
      if (markers.has(c.targetId)) freeing = true;
      // Un blocage repousse ou renverse la cible dans ~0,9 des cas à 2 dés.
      return { ...c, ev: c.ev + lane * 0.5 * c.probability };
    }
    return c;
  });
  if (!freeing) return boosted;
  return boosted.map((c) => (c.playerId === carrier.id && c.kind === 'move' && c.probability < 1 ? { ...c, ev: c.ev * 0.7 } : c));
}

/** Tous les candidats du tour, pour les joueurs éligibles. */
export function planActivations(input: PlannerInput): ActivationCandidate[] {
  const ctx = buildEvalContext(input.state, input.team, input.plan, input.carrierTarget);
  const out: ActivationCandidate[] = [];
  for (const player of input.state.players) {
    if (player.team !== input.team || !onPitch(player) || !input.eligible.has(player.id)) continue;
    out.push(...planPlayerActivations(input, ctx, player));
  }
  return sequenceAroundCarrier(input, ctx, out);
}

/** Meilleure destination du porteur ce tour (ancre de la cage), ou `undefined`. */
export function carrierIntent(input: PlannerInput): Position | undefined {
  const ctx = buildEvalContext(input.state, input.team, input.plan, undefined);
  const carrier = ctx.carrier;
  if (!carrier || carrier.team !== input.team || !input.eligible.has(carrier.id)) return undefined;
  const candidates = planPlayerActivations(input, ctx, carrier).filter((c) => c.kind === 'move');
  if (candidates.length === 0) return undefined;
  let best = candidates[0];
  for (const c of candidates) if (c.ev > best.ev) best = c;
  return best.finalPos;
}

/** Relance d'équipe : dépensée si le jet rejoué a assez de chances et vaut le coup. */
export function wantsTeamReroll(state: GameState, team: TeamId, plan: DrivePlan): boolean {
  const pending = state.pendingReroll;
  if (!pending || !canUseTeamReroll(state, team)) return false;
  const player = state.players.find((p) => p.id === pending.playerId);
  const target = state.lastDiceResult?.targetNumber ?? 4;
  const p = pD6(target);
  const critical = pending.rollType === 'pickup' || !!player?.hasBall;
  if (critical) return p >= Math.min(plan.rerollThreshold, 0.5);
  // Dernier tour de la mi-temps : la relance ne se garde pas.
  if (state.turn >= 8) return p >= 0.34;
  return p >= plan.rerollThreshold;
}

export { chebyshev };
