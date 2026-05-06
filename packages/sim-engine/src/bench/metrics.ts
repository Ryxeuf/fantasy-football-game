/**
 * Métriques "vivacité" — sprint Pro League 0.D.3.
 *
 * Au-delà des moyennes, le bench harness (lot 0.D.1) doit valider que
 * la simulation produit assez de variance pour rester intéressante :
 * - std dev TD >= 1.4 (pas tous les matchs à 3-3)
 * - upset rate 12-18% (les outsiders gagnent parfois)
 * - distribution MVP non concentrée sur les stars (Gini coefficient)
 * - fat-tails : % de matchs avec >= 5 TD, >= 4 casualties
 *
 * Toutes les fonctions sont pures et n'allouent aucun side-effect ; le
 * harness CLI (0.D.1) et la baseline CI (0.D.4) consomment cette API.
 */

import type { Casualty, MatchOutcome, SimResult } from '../types';

/** Sprint targets — flagged in `meetsTargets`. Tunable later via 0.E. */
export const TARGET_STD_DEV_TD = 1.4;
export const TARGET_UPSET_RATE_MIN = 0.12;
export const TARGET_UPSET_RATE_MAX = 0.18;

/** Match-level data point consumed by the metrics aggregator. */
export interface VivacitySample {
  /** SimResult.summary.touchdownCount. */
  totalTd: number;
  /** SimResult.result. */
  outcome: MatchOutcome;
  /** Optional pre-match favorite — when set, an outcome != favorite
   *  counts as an upset. Set by the bench harness from TV gap or
   *  pre-sim odds (lot 1.D.3). */
  favorite?: 'home' | 'away';
  /** Number of casualties in the match. */
  casualties: number;
  /** Total turnovers. */
  turnovers: number;
}

export interface VivacityMetrics {
  matches: number;
  td: { mean: number; std: number; p5: number; p95: number };
  casualties: { mean: number; std: number };
  turnovers: { mean: number };
  fatTails: {
    /** Fraction of matches with >= 5 TDs. */
    highScoring: number;
    /** Fraction of matches with >= 4 casualties. */
    bloodbath: number;
  };
  outcomes: {
    home: number;
    away: number;
    draw: number;
    /** Fraction of matches where outcome != favorite. 0 when no
     *  favorite is annotated on any match. */
    upsetRate: number;
  };
  meetsTargets: {
    stdDevTd: boolean;
    /** True when upset rate is in `[TARGET_UPSET_RATE_MIN,
     *  TARGET_UPSET_RATE_MAX]`. */
    upsetRate: boolean;
  };
}

const HIGH_SCORING_TD_THRESHOLD = 5;
const BLOODBATH_CASUALTY_THRESHOLD = 4;

export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

export function variance(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const m = mean(values);
  let acc = 0;
  for (const v of values) {
    const d = v - m;
    acc += d * d;
  }
  return acc / values.length;
}

export function stdDev(values: readonly number[]): number {
  return Math.sqrt(variance(values));
}

/**
 * Linear-interpolation quantile (R type-7). `p` in `[0, 1]`. Returns 0
 * for an empty array (never throws — bench code consumes degenerate
 * inputs during smoke tests).
 */
export function quantile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];
  const sorted = [...values].sort((a, b) => a - b);
  const clamped = Math.max(0, Math.min(1, p));
  const idx = clamped * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const frac = idx - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

/**
 * Gini coefficient over a non-negative distribution (typically MVP
 * scores per player across N matches). Returns `0` for perfectly
 * uniform / empty / all-zero inputs ; approaches `1` when one player
 * captures all the value.
 */
export function giniCoefficient(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  let sum = 0;
  let weightedSum = 0;
  for (let i = 0; i < n; i += 1) {
    const v = sorted[i];
    if (v < 0) {
      throw new Error('giniCoefficient: values must be non-negative');
    }
    sum += v;
    weightedSum += (i + 1) * v;
  }
  if (sum === 0) return 0;
  // G = (2 * sum_i i*x_i) / (n * sum) - (n + 1) / n
  return (2 * weightedSum) / (n * sum) - (n + 1) / n;
}

/** Convenience helper : extract a `VivacitySample` from a `SimResult`. */
export function simResultToSample(
  result: Pick<SimResult, 'result' | 'summary' | 'casualties'>,
  favorite?: 'home' | 'away'
): VivacitySample {
  return {
    totalTd: result.summary.touchdownCount,
    outcome: result.result,
    favorite,
    casualties: (result.casualties as readonly Casualty[]).length,
    turnovers: result.summary.turnoverCount,
  };
}

export function computeVivacityMetrics(
  samples: readonly VivacitySample[]
): VivacityMetrics {
  if (samples.length === 0) {
    return {
      matches: 0,
      td: { mean: 0, std: 0, p5: 0, p95: 0 },
      casualties: { mean: 0, std: 0 },
      turnovers: { mean: 0 },
      fatTails: { highScoring: 0, bloodbath: 0 },
      outcomes: { home: 0, away: 0, draw: 0, upsetRate: 0 },
      meetsTargets: { stdDevTd: false, upsetRate: false },
    };
  }

  const tds = samples.map((s) => s.totalTd);
  const cas = samples.map((s) => s.casualties);
  const tos = samples.map((s) => s.turnovers);

  let home = 0;
  let away = 0;
  let draw = 0;
  let highScoring = 0;
  let bloodbath = 0;
  let upsetCount = 0;
  let withFavorite = 0;
  for (const s of samples) {
    if (s.outcome === 'home') home += 1;
    else if (s.outcome === 'away') away += 1;
    else draw += 1;
    if (s.totalTd >= HIGH_SCORING_TD_THRESHOLD) highScoring += 1;
    if (s.casualties >= BLOODBATH_CASUALTY_THRESHOLD) bloodbath += 1;
    if (s.favorite !== undefined) {
      withFavorite += 1;
      // Iter #3 (engineVer 0.4.0) : an upset means the underdog
      // actually WINS the match. Draws are not upsets — they remain
      // neutral on the outcome ledger.
      const underdogSide = s.favorite === 'home' ? 'away' : 'home';
      if (s.outcome === underdogSide) upsetCount += 1;
    }
  }
  const upsetRate = withFavorite > 0 ? upsetCount / withFavorite : 0;
  const tdStd = stdDev(tds);

  return {
    matches: samples.length,
    td: {
      mean: mean(tds),
      std: tdStd,
      p5: quantile(tds, 0.05),
      p95: quantile(tds, 0.95),
    },
    casualties: { mean: mean(cas), std: stdDev(cas) },
    turnovers: { mean: mean(tos) },
    fatTails: {
      highScoring: highScoring / samples.length,
      bloodbath: bloodbath / samples.length,
    },
    outcomes: {
      home,
      away,
      draw,
      upsetRate,
    },
    meetsTargets: {
      stdDevTd: tdStd >= TARGET_STD_DEV_TD,
      upsetRate:
        withFavorite > 0 &&
        upsetRate >= TARGET_UPSET_RATE_MIN &&
        upsetRate <= TARGET_UPSET_RATE_MAX,
    },
  };
}
