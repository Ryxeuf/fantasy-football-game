/**
 * `aiPlay` — orchestrateur 3-passes du behavior tree (sprint 0.B.1).
 *
 *   Pass 1 — `evaluateSituation` : DriveState → DriveContext (flags
 *   normalises : possession, red-zone, mid-field, late-in-half, lead).
 *
 *   Pass 2 — `chooseStrategy` : softmax sur les 6 stratégies, pondéré
 *   par le profil tactique (riskAppetite → temperature) et le contexte.
 *   La stratégie élue détermine les patterns disponibles.
 *
 *   Pass 3 — `executePattern` : softmax sur les key moments, pondéré
 *   par les biais du pattern × scores derivés du profil. Retourne le
 *   `KeyMomentKind` à exécuter, ou `null` pour "rien de scripté ce
 *   tour-ci, juste de l'avancement yards".
 */

import type { Rng } from '../rng/seeded';
import type { TacticalProfile } from '../tactics/tactical-profile';
import { riskAppetiteToTemperature, softmaxSample } from '../tactics/temperature';

import { STRATEGIES, STRATEGY_BY_ID } from './strategy/strategies';
import { PATTERN_BY_ID } from './tactics/patterns';
import type {
  DriveContext,
  KeyMomentKind,
  PatternId,
  Strategy,
  StrategyId,
} from './types';

const FIELD_YARDS = 26; // mirrors the driver constant

export interface DriveSnapshot {
  hasPossession: boolean;
  ballYardline: number;
  turn: number;
  half: 1 | 2;
  scoreSelf: number;
  scoreOpp: number;
}

export function evaluateSituation(snap: DriveSnapshot): DriveContext {
  return {
    hasPossession: snap.hasPossession,
    inRedZone: snap.ballYardline >= FIELD_YARDS - 4,
    pastMidfield: snap.ballYardline >= FIELD_YARDS / 2,
    lateInHalf: snap.turn >= 6,
    leading: snap.scoreSelf > snap.scoreOpp,
    trailing: snap.scoreSelf < snap.scoreOpp,
  };
}

/** Pass 2 : softmax over the 6 strategies given context+profile. */
export function chooseStrategy(
  rng: Pick<Rng, 'next'>,
  context: DriveContext,
  profile: TacticalProfile
): StrategyId {
  const candidates = STRATEGIES.map((s) => ({
    value: s.id,
    score: s.score(context, profile),
  }));
  // Filter out strategies with zero score so they are never sampled.
  const live = candidates.filter((c) => c.score > 0);
  // Fallback : if every strategy scored 0 (e.g. no possession + bash team),
  // use the full list with a tiny epsilon so the softmax still works.
  const finalCandidates = live.length > 0 ? live : candidates.map((c) => ({ ...c, score: 0.01 }));
  return softmaxSample(rng, finalCandidates, riskAppetiteToTemperature(profile.riskAppetite));
}

/** Pass 3a : pick a pattern from the chosen strategy's available list. */
export function choosePattern(
  rng: Pick<Rng, 'next'>,
  strategy: Strategy,
  profile: TacticalProfile
): PatternId {
  if (strategy.patterns.length === 1) {
    return strategy.patterns[0];
  }
  // Multiple patterns : score them by how aligned their dominant moment
  // weight is with the team's profile. Simple proxy : pick the one whose
  // weights vector has the highest correlation with profile signals.
  const candidates = strategy.patterns.map((pid) => {
    const pattern = PATTERN_BY_ID[pid];
    let score = 0;
    score += (pattern.weights.block ?? 0) * (profile.bashIndex / 100);
    score += (pattern.weights.dodge ?? 0) * (profile.breakawayInstinct / 100);
    score += (pattern.weights.pass ?? 0) * (profile.passingFrequency / 100);
    score += (pattern.weights.foul ?? 0) * (profile.foulFrequency / 100);
    return { value: pid, score };
  });
  return softmaxSample(rng, candidates, riskAppetiteToTemperature(profile.riskAppetite));
}

/** Pass 3b : pick the actual key moment from the pattern's bias × profile. */
export function executePattern(
  rng: Pick<Rng, 'next'>,
  patternId: PatternId,
  profile: TacticalProfile,
  context: DriveContext
): KeyMomentKind | null {
  const pattern = PATTERN_BY_ID[patternId];
  const profileScore: Record<KeyMomentKind, number> = {
    block: profile.bashIndex / 100,
    dodge: (profile.breakawayInstinct / 100) * 0.8 + 0.2,
    pass: profile.passingFrequency / 100,
    pickup: 0.5,
    gfi: profile.gfiTolerance / 100,
    foul: profile.foulFrequency / 100,
  };
  const candidates: { value: KeyMomentKind | null; score: number }[] = [];
  for (const [kind, weight] of Object.entries(pattern.weights) as [KeyMomentKind, number][]) {
    candidates.push({ value: kind, score: weight * profileScore[kind] });
  }
  // Add a "do nothing scripted" branch unless we are in the red-zone or
  // missing possession — preserves narrative pace for low-pace teams.
  if (!context.inRedZone && context.hasPossession) {
    candidates.push({ value: null, score: 1 - profile.pace / 200 });
  }

  return softmaxSample(rng, candidates, riskAppetiteToTemperature(profile.riskAppetite));
}

/** Single-call orchestrator : runs the 3 passes in sequence. */
export function aiPlay(
  rng: Pick<Rng, 'next'>,
  snap: DriveSnapshot,
  profile: TacticalProfile
): { strategy: StrategyId; pattern: PatternId; moment: KeyMomentKind | null } {
  const context = evaluateSituation(snap);
  const strategyId = chooseStrategy(rng, context, profile);
  const strategy = STRATEGY_BY_ID[strategyId];
  const patternId = choosePattern(rng, strategy, profile);
  const moment = executePattern(rng, patternId, profile, context);
  return { strategy: strategyId, pattern: patternId, moment };
}
