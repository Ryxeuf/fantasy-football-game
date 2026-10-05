/**
 * Lot 3 « cerveau du coach » — le PLAN DE DRIVE.
 *
 * Choisi au début d'un drive (softmax sur les stratégies, température tirée
 * de `riskAppetite`), il COLLE : il n'est ré-évalué que sur évènement
 * (changement de possession, de mi-temps, passage en fin de mi-temps,
 * bascule du score). Le driver hybride le retirait à chaque « key moment »,
 * cause documentée des drives illisibles.
 *
 * Un plan fixe : la formation cible, le tempo, le plancher de probabilité
 * accepté (budget de risque), la politique de relance et d'agression, et
 * si le blitz est réservé à la protection du porteur.
 */

import type { GameState, Player, RNG, TeamId } from '@bb/game-engine';

import { STRATEGIES } from '../ai/strategy/strategies';
import type { DriveContext, Strategy, StrategyId } from '../ai/types';
import type { TacticalProfile } from '../tactics/tactical-profile';
import { riskAppetiteToTemperature, softmaxSample } from '../tactics/temperature';

export type CoachStrategyId = StrategyId | 'two-turn-score' | 'safe-hold' | 'mark-receivers';

export type DriveFormation = 'cage' | 'column' | 'spread' | 'screen' | 'press' | 'mark';

export interface DrivePlan {
  readonly strategy: CoachStrategyId;
  readonly formation: DriveFormation;
  /** 0 = tenir le ballon, 1 = marquer au plus vite. */
  readonly tempo: number;
  /** Probabilité de succès minimale d'une activation hors cas de score. */
  readonly riskFloor: number;
  /** Probabilité de réussite à partir de laquelle une relance d'équipe est dépensée. */
  readonly rerollThreshold: number;
  /** 0 = jamais d'agression, 1 = dès que possible. */
  readonly foulAppetite: number;
  /** Garder le blitz pour dégager le porteur plutôt que pour un blocage opportuniste. */
  readonly keepBlitzForCarrier: boolean;
  /** `passingFrequency` du profil (le coût perçu d'une passe ratée en dépend). */
  readonly passingFrequency: number;
  /** Contexte dans lequel le plan a été choisi (pour `shouldReplan`). */
  readonly context: DriveContext;
  readonly half: number;
}

interface CoachStrategy {
  readonly id: CoachStrategyId;
  readonly formation: DriveFormation;
  readonly tempo: number;
  readonly riskFloor: number;
  readonly score: Strategy['score'];
}

const FORMATION_BY_STRATEGY: Record<StrategyId, DriveFormation> = {
  'cage-build': 'cage',
  breakaway: 'spread',
  'defensive-screen': 'screen',
  'blitz-train': 'press',
  stall: 'cage',
  'foul-fest': 'press',
};

const TEMPO_BY_STRATEGY: Record<StrategyId, number> = {
  'cage-build': 0.45,
  breakaway: 0.9,
  'defensive-screen': 0.5,
  'blitz-train': 0.6,
  stall: 0.1,
  'foul-fest': 0.5,
};

const RISK_FLOOR_BY_STRATEGY: Record<StrategyId, number> = {
  'cage-build': 0.6,
  breakaway: 0.42,
  'defensive-screen': 0.6,
  'blitz-train': 0.5,
  stall: 0.75,
  'foul-fest': 0.55,
};

const EXTRA_STRATEGIES: readonly CoachStrategy[] = [
  {
    id: 'two-turn-score',
    formation: 'column',
    tempo: 0.85,
    riskFloor: 0.5,
    score: (ctx, p) => {
      if (!ctx.hasPossession) return 0;
      return (ctx.inRedZone ? 0.5 : ctx.pastMidfield ? 0.25 : 0) + p.pace / 200 + (ctx.trailing ? 0.25 : 0);
    },
  },
  {
    id: 'safe-hold',
    formation: 'cage',
    tempo: 0.25,
    riskFloor: 0.7,
    score: (ctx, p) => {
      if (!ctx.hasPossession) return 0;
      return (ctx.leading ? 0.35 : 0) + p.patience / 150 + (ctx.lateInHalf ? 0.15 : 0);
    },
  },
  {
    id: 'mark-receivers',
    formation: 'mark',
    tempo: 0.5,
    riskFloor: 0.6,
    score: (ctx, p) => {
      if (ctx.hasPossession) return 0;
      return p.screenAffinity / 200 + p.patience / 250 + (ctx.pastMidfield ? 0 : 0.15);
    },
  },
];

/**
 * Le « stall » du driver hybride se déclenchait sur le seul profil : un
 * coach qui ne mène pas ne gèle pas le ballon à 18 cases de l'en-but.
 */
function stallScore(ctx: DriveContext, p: TacticalProfile): number {
  if (!ctx.hasPossession) return 0;
  if (ctx.trailing) return 0;
  if (!ctx.leading && !ctx.lateInHalf) return 0;
  return p.stallTendency / 100 + (ctx.lateInHalf && ctx.leading ? 0.6 : 0.2) + p.patience / 300;
}

/** « Blitz-train » est un plan de DÉFENSE : le driver hybride lui laissait 0,05 en attaque. */
function blitzTrainScore(ctx: DriveContext, p: TacticalProfile): number {
  if (ctx.hasPossession) return 0;
  return p.blitzPriority / 100 + p.bashIndex / 200 + (ctx.pastMidfield ? 0.15 : 0);
}

export const COACH_STRATEGIES: readonly CoachStrategy[] = [
  ...STRATEGIES.map<CoachStrategy>((s) => ({
    id: s.id,
    formation: FORMATION_BY_STRATEGY[s.id],
    tempo: TEMPO_BY_STRATEGY[s.id],
    riskFloor: RISK_FLOOR_BY_STRATEGY[s.id],
    score: s.id === 'stall' ? stallScore : s.id === 'blitz-train' ? blitzTrainScore : s.score,
  })),
  ...EXTRA_STRATEGIES,
];

function endzoneX(state: GameState, team: TeamId): number {
  return team === 'A' ? state.width - 1 : 0;
}

export function ballCarrier(state: GameState): Player | undefined {
  return state.players.find((p) => p.hasBall && !p.stunned);
}

/** Contexte normalisé d'un drive pour `team`. */
export function buildDriveContext(state: GameState, team: TeamId): DriveContext {
  const carrier = ballCarrier(state);
  const ballPos = carrier?.pos ?? state.ball;
  const mid = (state.width - 1) / 2;
  // Un ballon libre dans NOTRE moitié (réception de coup d'envoi, ballon
  // lâché derrière nos lignes) fait de nous l'attaque : on va le chercher.
  const looseInOurHalf =
    !carrier && !!ballPos && ballPos.x >= 0 && (team === 'A' ? ballPos.x <= mid : ballPos.x >= mid);
  const hasPossession = carrier ? carrier.team === team : looseInOurHalf;
  const distToGoal = ballPos ? Math.abs(ballPos.x - endzoneX(state, team)) : state.width;
  const pastMidfield = ballPos
    ? team === 'A'
      ? ballPos.x > mid
      : ballPos.x < mid
    : false;
  const own = team === 'A' ? state.score.teamA : state.score.teamB;
  const opp = team === 'A' ? state.score.teamB : state.score.teamA;
  return {
    hasPossession,
    inRedZone: hasPossession && distToGoal <= 4,
    pastMidfield,
    lateInHalf: state.turn >= 6,
    leading: own > opp,
    trailing: own < opp,
  };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Construit le plan correspondant à une stratégie et au profil. */
export function planFromStrategy(
  strategy: CoachStrategy,
  profile: TacticalProfile,
  ctx: DriveContext,
  half: number,
): DrivePlan {
  const paceShift = (profile.pace - 50) / 250; // ±0,2
  const riskShift = (profile.riskAppetite - 50) / 333; // ±0,15
  return {
    strategy: strategy.id,
    formation: strategy.formation,
    tempo: clamp01(strategy.tempo + paceShift + (ctx.trailing && ctx.lateInHalf ? 0.2 : 0)),
    riskFloor: clamp01(strategy.riskFloor - riskShift),
    rerollThreshold: clamp01(0.67 - (profile.rerollUsage / 100) * 0.33),
    foulAppetite: clamp01(profile.foulFrequency / 100 + (strategy.id === 'foul-fest' ? 0.3 : 0)),
    keepBlitzForCarrier: ctx.hasPossession && profile.patience >= 50,
    passingFrequency: profile.passingFrequency,
    context: ctx,
    half,
  };
}

/** Choisit un plan par softmax sur les stratégies applicables. */
export function choosePlan(
  state: GameState,
  team: TeamId,
  profile: TacticalProfile,
  rng: RNG,
): DrivePlan {
  const ctx = buildDriveContext(state, team);
  const candidates = COACH_STRATEGIES.map((s) => ({ value: s, score: s.score(ctx, profile) })).filter(
    (c) => c.score > 0,
  );
  if (candidates.length === 0) {
    const fallback = COACH_STRATEGIES.find((s) => (ctx.hasPossession ? s.id === 'cage-build' : s.id === 'defensive-screen'));
    return planFromStrategy(fallback ?? COACH_STRATEGIES[0], profile, ctx, state.half);
  }
  // Les scores des stratégies sont dans [0, ~1,5] : la température de
  // `riskAppetite` (0..2,5) est ramenée à cette échelle.
  const temperature = riskAppetiteToTemperature(profile.riskAppetite) * 0.25;
  const chosen = softmaxSample({ next: () => rng() }, candidates, temperature);
  return planFromStrategy(chosen, profile, ctx, state.half);
}

/** Le plan est ré-évalué seulement sur évènement. */
export function shouldReplan(plan: DrivePlan, state: GameState, team: TeamId): boolean {
  const ctx = buildDriveContext(state, team);
  if (plan.half !== state.half) return true;
  if (plan.context.hasPossession !== ctx.hasPossession) return true;
  if (!plan.context.lateInHalf && ctx.lateInHalf) return true;
  if (plan.context.leading !== ctx.leading || plan.context.trailing !== ctx.trailing) return true;
  if (!plan.context.inRedZone && ctx.inRedZone) return true;
  return false;
}
