/**
 * Lot 3 « cerveau du coach » — FONCTION DE VALEUR d'une position, tenant
 * compte du plan de drive. Elle est LOCALE : la valeur d'une équipe est la
 * somme de termes globaux (score, possession) et d'une contribution par
 * joueur qui ne dépend que de sa case et de ses voisins. Déplacer un joueur
 * ne recalcule donc que sa contribution — ce qui rend le planificateur
 * d'activations (des centaines de cases candidates par joueur) bon marché.
 *
 * Le contexte (`EvalContext`) est PRÉCALCULÉ une fois par décision : listes
 * des joueurs debout, grille des zones de tacle adverses, porteur, et la
 * case VISÉE par le porteur ce tour-ci (`carrierTarget`) — la cage se forme
 * là où le porteur VA, pas là où il est.
 */

import { hasPlayerActed, hasSkill, isAdjacent } from '@bb/game-engine';
import type { GameState, Player, Position, TeamId } from '@bb/game-engine';

import type { DrivePlan } from './drive-plan';
import { personalityFor } from './personality';
import { carrierAptitude, deriveRole, type PlayerRole } from './roles';

export const VALUE = {
  TOUCHDOWN: 1000,
  POSSESSION: 300,
  /** Un TD vaut 1000 et se construit sur ~25 cases : chaque case en vaut une part. */
  BALL_PROGRESS_PER_STEP: 30,
  STANDING: 30,
  PRONE: 15,
  CARRIER_TACKLE_ZONE: 48,
  CARRIER_ALLY: 18,
  CARRIER_CAGE_CORNER: 24,
  CARRIER_THREAT: 4,
  MARK_CARRIER: 30,
  POSITIONING_PER_STEP: 2.5,
  CLUMP_PENALTY: 4,
} as const;

export function chebyshev(a: Position, b: Position): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function isStanding(p: Player): boolean {
  return !p.stunned && (p.state === undefined || p.state === 'active');
}

export function onPitch(p: Player): boolean {
  return p.pos.x >= 0 && p.pos.y >= 0 && (p.state === undefined || p.state === 'active');
}

export function endzoneX(state: GameState, team: TeamId): number {
  return team === 'A' ? state.width - 1 : 0;
}

export function forwardProgress(state: GameState, team: TeamId, pos: Position): number {
  return state.width - 1 - Math.abs(pos.x - endzoneX(state, team));
}

/** Grille `x,y → nombre d'adversaires DEBOUT adjacents` (zones de tacle). */
export class TackleZoneGrid {
  private readonly counts: Int8Array;
  constructor(private readonly width: number, private readonly height: number, markers: readonly Player[]) {
    this.counts = new Int8Array(width * height);
    for (const m of markers) {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          const x = m.pos.x + dx;
          const y = m.pos.y + dy;
          if (x < 0 || y < 0 || x >= width || y >= height) continue;
          this.counts[y * width + x]++;
        }
      }
    }
  }
  at(pos: Position): number {
    if (pos.x < 0 || pos.y < 0 || pos.x >= this.width || pos.y >= this.height) return 0;
    return this.counts[pos.y * this.width + pos.x];
  }
}

export interface EvalContext {
  readonly state: GameState;
  readonly team: TeamId;
  readonly plan: DrivePlan;
  /** Adversaires sur le terrain (debout ou non). */
  readonly opponents: readonly Player[];
  readonly opponentsStanding: readonly Player[];
  /** Coéquipiers sur le terrain, debout. */
  readonly alliesStanding: readonly Player[];
  readonly oppTackleZones: TackleZoneGrid;
  readonly ownTackleZones: TackleZoneGrid;
  readonly carrier: Player | undefined;
  /** Case visée par NOTRE porteur ce tour (cage et escorte s'y forment). */
  readonly carrierTarget: Position | undefined;
  readonly roles: ReadonlyMap<string, PlayerRole>;
  /** Urgence de marquer (tours qui passent sans mener). */
  readonly urgency: number;
}

export function buildEvalContext(
  state: GameState,
  team: TeamId,
  plan: DrivePlan,
  carrierTarget?: Position,
): EvalContext {
  const opponents = state.players.filter((o) => o.team !== team && onPitch(o));
  const opponentsStanding = opponents.filter(isStanding);
  const alliesStanding = state.players.filter((a) => a.team === team && onPitch(a) && isStanding(a));
  const roles = new Map<string, PlayerRole>();
  for (const p of state.players) roles.set(p.id, deriveRole(p));
  const carrier = state.players.find((p) => p.hasBall && isStanding(p));
  const own = team === 'A' ? state.score.teamA : state.score.teamB;
  const opp = team === 'A' ? state.score.teamB : state.score.teamA;
  const urgency = own > opp ? 0 : Math.max(0, Math.min(0.7, (state.turn - 2) / 7)) * (own < opp ? 1.3 : 1);
  return {
    state,
    team,
    plan,
    opponents,
    opponentsStanding,
    alliesStanding,
    oppTackleZones: new TackleZoneGrid(state.width, state.height, opponentsStanding),
    ownTackleZones: new TackleZoneGrid(state.width, state.height, alliesStanding),
    carrier,
    carrierTarget: carrier && carrier.team === team ? carrierTarget : undefined,
    roles,
    urgency,
  };
}

/** Cases de cage : les quatre diagonales du porteur. */
function isCageCorner(carrierPos: Position, pos: Position): boolean {
  return Math.abs(pos.x - carrierPos.x) === 1 && Math.abs(pos.y - carrierPos.y) === 1;
}

function alliesAdjacent(ctx: EvalContext, pos: Position, exceptId: string): Player[] {
  const out: Player[] = [];
  for (const a of ctx.alliesStanding) if (a.id !== exceptId && isAdjacent(a.pos, pos)) out.push(a);
  return out;
}

/**
 * Contribution d'un joueur de `ctx.team` placé en `pos` (debout), le reste
 * de l'état étant tel quel. `withBall` force le statut de porteur.
 */
export function playerContribution(ctx: EvalContext, player: Player, pos: Position, withBall: boolean): number {
  const { state, team, plan } = ctx;
  const oppTz = ctx.oppTackleZones.at(pos);
  const persona = personalityFor(player.id);
  let value = VALUE.STANDING;

  if (withBall) {
    const tempo = Math.min(1.4, 0.5 + plan.tempo + ctx.urgency);
    value += forwardProgress(state, team, pos) * VALUE.BALL_PROGRESS_PER_STEP * tempo;
    value -= oppTz * VALUE.CARRIER_TACKLE_ZONE;
    // Escorte : les coéquipiers déjà adjacents comptent plein ; ceux qui
    // n'ont pas encore joué et PEUVENT rejoindre la case comptent comme
    // soutien potentiel — sinon la cage formée autour de la case actuelle
    // retient le porteur (chaque pas en avant « perdait » ses gardes).
    let support = 0;
    for (const a of ctx.alliesStanding) {
      if (a.id === player.id) continue;
      if (isAdjacent(a.pos, pos)) {
        support += isCageCorner(pos, a.pos) ? VALUE.CARRIER_CAGE_CORNER : VALUE.CARRIER_ALLY;
      } else if (!hasPlayerActed(state, a.id) && chebyshev(a.pos, pos) <= a.ma) {
        support += VALUE.CARRIER_ALLY * 0.7;
      }
    }
    value += Math.min(support, VALUE.CARRIER_CAGE_CORNER * 4 + VALUE.CARRIER_ALLY);
    // Menaces à un tour : un adversaire déjà marqué par un des nôtres doit
    // d'abord esquiver, il pèse moins.
    let threats = 0;
    for (const o of ctx.opponentsStanding) {
      const d = chebyshev(o.pos, pos);
      if (d > 1 && d <= o.ma + 1) threats += ctx.ownTackleZones.at(o.pos) > 0 ? 0.4 : 1;
    }
    value -= Math.min(4, threats) * VALUE.CARRIER_THREAT * (plan.formation === 'cage' ? 1.2 : 1);
    // Mobilité : un porteur dont les trois cases AVANT sont occupées (par
    // sa propre cage, le plus souvent) ne peut plus avancer sans défaire
    // sa protection. Il lui faut au moins une case libre vers l'en-but.
    const dir = team === 'A' ? 1 : -1;
    let freeAhead = 0;
    for (let dy = -1; dy <= 1; dy++) {
      const sq = { x: pos.x + dir, y: pos.y + dy };
      if (sq.x < 0 || sq.x >= state.width || sq.y < 0 || sq.y >= state.height) continue;
      if (!state.players.some((p) => p.id !== player.id && onPitch(p) && p.pos.x === sq.x && p.pos.y === sq.y)) freeAhead++;
    }
    if (freeAhead === 0) value -= 45;
    else if (freeAhead === 1) value -= 10;
    // La ligne de touche est un piège (une poussée suffit) : le porteur
    // reste au large, d'autant plus qu'il est marqué.
    const sideline = Math.min(pos.y, state.height - 1 - pos.y);
    if (sideline < 3) value -= (3 - sideline) * 12 * (oppTz > 0 ? 1.5 : 1);
    value += carrierAptitude(player) * 0.3;
    return value;
  }

  const carrier = ctx.carrier;
  const ownCarrier = carrier && carrier.team === team && carrier.id !== player.id ? carrier : undefined;
  const oppCarrier = carrier && carrier.team !== team ? carrier : undefined;
  const role = ctx.roles.get(player.id) ?? 'lineman';

  if (ownCarrier) {
    const anchor = ctx.carrierTarget ?? ownCarrier.pos;
    if (isAdjacent(pos, anchor)) {
      // Géométrie de l'escorte : les COINS (diagonales) protègent sans
      // gêner, les côtés un peu moins, la case juste DEVANT bouche le
      // couloir du porteur.
      const ahead = (team === 'A' ? 1 : -1);
      if (isCageCorner(anchor, pos)) {
        value += plan.formation === 'cage' ? VALUE.CARRIER_CAGE_CORNER : VALUE.CARRIER_ALLY;
      } else if (pos.x === anchor.x + ahead) {
        value -= 12;
      } else if (pos.x === anchor.x) {
        value += VALUE.CARRIER_ALLY * 0.6;
      } else {
        value += VALUE.CARRIER_ALLY * 0.4;
      }
    }
    const dist = chebyshev(pos, anchor);
    if (plan.formation === 'spread' || plan.formation === 'column') {
      if (role === 'catcher' || role === 'thrower') {
        value += forwardProgress(state, team, pos) * VALUE.POSITIONING_PER_STEP * (0.5 + plan.tempo);
        value += (persona.greed / 100) * 10;
        value -= oppTz * 6;
      } else {
        value -= Math.max(0, dist - 2) * VALUE.POSITIONING_PER_STEP * 2;
      }
    } else {
      value -= Math.max(0, dist - 1) * VALUE.POSITIONING_PER_STEP * 2.5;
      value += forwardProgress(state, team, pos) * VALUE.POSITIONING_PER_STEP * (plan.tempo + ctx.urgency) * 0.5;
    }
    // Marquer les adversaires qui menacent le porteur — et surtout ceux qui
    // le MARQUENT : un coéquipier adjacent au marqueur, c'est un soutien
    // qui transforme le prochain blocage en blocage à deux dés.
    for (const o of ctx.opponentsStanding) {
      if (!isAdjacent(o.pos, pos)) continue;
      if (isAdjacent(o.pos, ownCarrier.pos)) value += 20;
      else if (chebyshev(o.pos, anchor) <= o.ma + 1) value += 8;
    }
  } else if (oppCarrier) {
    const dist = chebyshev(pos, oppCarrier.pos);
    if (isAdjacent(pos, oppCarrier.pos)) value += VALUE.MARK_CARRIER;
    if (plan.formation === 'press') {
      value -= Math.max(0, dist - 1) * VALUE.POSITIONING_PER_STEP * 2.5;
    } else if (plan.formation === 'screen') {
      const goal = endzoneX(state, team === 'A' ? 'B' : 'A');
      const dir = goal > oppCarrier.pos.x ? 1 : -1;
      const lineX = oppCarrier.pos.x + dir * 3;
      value -= Math.abs(pos.x - lineX) * VALUE.POSITIONING_PER_STEP * 1.5;
      value -= Math.max(0, Math.abs(pos.y - oppCarrier.pos.y) - 4) * VALUE.POSITIONING_PER_STEP;
      value -= alliesAdjacent(ctx, pos, player.id).length * VALUE.CLUMP_PENALTY;
    } else {
      let nearest = 99;
      for (const o of ctx.opponentsStanding) {
        if (o.hasBall || ctx.roles.get(o.id) !== 'catcher') continue;
        nearest = Math.min(nearest, chebyshev(pos, o.pos));
      }
      if (nearest < 99) value -= Math.max(0, nearest - 1) * VALUE.POSITIONING_PER_STEP * 2;
      value -= Math.max(0, dist - 3) * VALUE.POSITIONING_PER_STEP;
    }
  } else if (state.ball) {
    const dist = chebyshev(pos, state.ball);
    const aptitude = Math.max(0, carrierAptitude(player)) / 40;
    value -= Math.max(0, dist - 1) * VALUE.POSITIONING_PER_STEP * (1.5 + aptitude);
  } else {
    value += forwardProgress(state, team, pos) * VALUE.POSITIONING_PER_STEP * 0.5;
  }

  if (oppTz >= 2 && alliesAdjacent(ctx, pos, player.id).length === 0) value -= 10;
  if (hasSkill(player, 'stunty') && oppTz > 0) value -= 5;
  return value;
}

/** Valeur d'un adversaire mis au sol (du point de vue de `ctx.team`). */
export function knockdownGain(ctx: EvalContext, target: Player): number {
  let gain = VALUE.STANDING + VALUE.PRONE;
  const carrier = ctx.carrier;
  if (carrier && carrier.team === ctx.team) {
    const anchor = ctx.carrierTarget ?? carrier.pos;
    if (isAdjacent(target.pos, carrier.pos)) gain += VALUE.CARRIER_TACKLE_ZONE;
    else if (chebyshev(target.pos, anchor) <= 2) gain += 15;
  }
  if (target.hasBall) gain += VALUE.POSSESSION * 0.8;
  return gain;
}
