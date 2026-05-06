/**
 * Bench regression baseline — sprint Pro League 0.D.4.
 *
 * Sprint table : "sur chaque PR touchant `packages/sim-engine`, run
 * `--runs=5000` vs `bench-baseline.json`. Alerte si deviation > 5% sur
 * metriques cles. Baseline versionne avec `engineVer`."
 *
 * Le baseline est un snapshot fige des metriques attendues pour un
 * petit set de pairings representatifs. Tant que `engineVer` n'a pas
 * change, la simulation est replay-deterministe (lots 0.A.4 + 0.A.2),
 * donc une deviation > 5% indique soit un bug, soit un changement
 * intentionnel qui doit etre re-snapshotte avec un nouveau `engineVer`.
 */

import { z } from 'zod';

import type { VivacityMetrics } from './metrics';

/** Sprint default tolerance (5%). */
export const DEFAULT_BASELINE_TOLERANCE = 0.05;

const expectedMetricsSchema = z
  .object({
    /** SimResult.summary.touchdownCount mean. */
    tdMean: z.number().nonnegative(),
    /** Std dev across the run. */
    tdStd: z.number().nonnegative(),
    /** Casualty mean. */
    casualtyMean: z.number().nonnegative(),
    /** Turnover mean. */
    turnoverMean: z.number().nonnegative(),
    /** Outcome rates (sum to 1). */
    homeWinRate: z.number().min(0).max(1),
    awayWinRate: z.number().min(0).max(1),
    drawRate: z.number().min(0).max(1),
  })
  .strict();

export type ExpectedMetrics = z.infer<typeof expectedMetricsSchema>;

const baselineEntrySchema = z
  .object({
    homeId: z.string().min(1),
    awayId: z.string().min(1),
    runs: z.number().int().positive(),
    seedOffset: z.number().int().nonnegative(),
    expected: expectedMetricsSchema,
    /** Optional per-pairing tolerance override. */
    tolerance: z.number().positive().lt(1).optional(),
  })
  .strict();

export type BenchBaselineEntry = z.infer<typeof baselineEntrySchema>;

export const benchBaselineSchema = z
  .object({
    /** Sim engine version that produced this baseline. */
    engineVer: z.string().min(1),
    snapshotAt: z.string().min(1),
    /** Default tolerance applied unless an entry overrides it. */
    tolerance: z.number().positive().lt(1),
    pairings: z.array(baselineEntrySchema).min(1),
  })
  .strict();

export type BenchBaseline = z.infer<typeof benchBaselineSchema>;

export function parseBenchBaseline(input: unknown): BenchBaseline {
  return benchBaselineSchema.parse(input);
}

export interface MetricDeviation {
  metric: keyof ExpectedMetrics;
  expected: number;
  observed: number;
  /** Relative delta (`|observed - expected| / max(|expected|, eps)`). */
  relativeDelta: number;
  tolerance: number;
}

export interface BaselineComparison {
  passed: boolean;
  deviations: readonly MetricDeviation[];
}

function relativeDelta(observed: number, expected: number): number {
  if (expected === 0) {
    return Math.abs(observed);
  }
  return Math.abs(observed - expected) / Math.abs(expected);
}

function checkMetric(
  metric: keyof ExpectedMetrics,
  observed: number,
  expected: number,
  tolerance: number
): MetricDeviation | null {
  const delta = relativeDelta(observed, expected);
  if (delta <= tolerance) return null;
  return { metric, expected, observed, relativeDelta: delta, tolerance };
}

/**
 * Compares observed `VivacityMetrics` against a baseline entry.
 * Returns a list of deviations exceeding the tolerance (per-entry
 * override, or the global default).
 */
export function compareToBaseline(
  observed: VivacityMetrics,
  entry: BenchBaselineEntry,
  defaultTolerance: number
): BaselineComparison {
  const tolerance = entry.tolerance ?? defaultTolerance;
  const exp = entry.expected;
  const total = observed.outcomes.home + observed.outcomes.away + observed.outcomes.draw;
  const homeRate = total === 0 ? 0 : observed.outcomes.home / total;
  const awayRate = total === 0 ? 0 : observed.outcomes.away / total;
  const drawRate = total === 0 ? 0 : observed.outcomes.draw / total;

  const checks = [
    checkMetric('tdMean', observed.td.mean, exp.tdMean, tolerance),
    checkMetric('tdStd', observed.td.std, exp.tdStd, tolerance),
    checkMetric('casualtyMean', observed.casualties.mean, exp.casualtyMean, tolerance),
    checkMetric('turnoverMean', observed.turnovers.mean, exp.turnoverMean, tolerance),
    checkMetric('homeWinRate', homeRate, exp.homeWinRate, tolerance),
    checkMetric('awayWinRate', awayRate, exp.awayWinRate, tolerance),
    checkMetric('drawRate', drawRate, exp.drawRate, tolerance),
  ];
  const deviations = checks.filter((d): d is MetricDeviation => d !== null);
  return { passed: deviations.length === 0, deviations };
}

export interface BaselineLineItem {
  entry: BenchBaselineEntry;
  result: BaselineComparison;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatBaselineReport(items: readonly BaselineLineItem[]): string {
  const lines: string[] = [];
  let allPassed = true;
  for (const item of items) {
    const { entry, result } = item;
    const status = result.passed ? 'PASS' : 'FAIL';
    if (!result.passed) allPassed = false;
    lines.push(`[${status}] ${entry.homeId} vs ${entry.awayId} (runs=${entry.runs}, seed=${entry.seedOffset})`);
    for (const dev of result.deviations) {
      lines.push(
        `  - ${dev.metric.padEnd(14)} : expected=${dev.expected.toFixed(4)} observed=${dev.observed.toFixed(4)} delta=${pct(dev.relativeDelta)} (tol=${pct(dev.tolerance)})`
      );
    }
  }
  lines.push('');
  lines.push(allPassed ? 'PASS — all pairings within tolerance' : 'FAIL — at least one pairing drifted');
  return lines.join('\n');
}
