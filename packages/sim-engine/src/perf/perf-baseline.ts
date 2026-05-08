/**
 * Perf baseline pour le sim engine (Lot 3.B.3).
 *
 * `measureSimulationPerf` exécute N matchs avec un driver donné, mesure
 * la durée wall-clock via `performance.now()` (injectable pour les
 * tests) et retourne mean / p50 / p95 / max.
 *
 * Sert :
 *  - aux tests de regression CI : "p95 hybrid < 200ms" / "p95 full < 5s"
 *    (cf. `perf-baseline.smoke.test.ts`).
 *  - aux benches manuels : `pnpm sim:perf` (script dans la même PR).
 *  - au monitoring : alimenter une jauge Prometheus avec le ratio
 *    `full.p95 / hybrid.p95` pour détecter une regression entre
 *    `engineVer`.
 *
 * Pure (pas d'I/O, pas de DB) — `simulate` et `now` sont injectables.
 */

import { performance as nodePerformance } from "node:perf_hooks";

import { simulateMatch } from "../simulate-match";
import type { SimInput, SimResult } from "../types";
import type {
  SimulateDriverKind,
  SimulateMatchOptions,
} from "../simulate-match";

export type SimulateFn = (
  input: SimInput,
  options?: SimulateMatchOptions,
) => SimResult;

export interface MeasureSimulationPerfInput {
  readonly input: SimInput;
  readonly driverKind: SimulateDriverKind;
  readonly runs: number;
  /** Override du `simulateMatch` réel — utile pour les tests. */
  readonly simulate?: SimulateFn;
  /** Override du `performance.now` — par défaut `node:perf_hooks`. */
  readonly now?: () => number;
}

export interface PerfBaselineResult {
  readonly driverKind: SimulateDriverKind;
  readonly runs: number;
  readonly samplesMs: readonly number[];
  readonly mean: number;
  readonly p50: number;
  readonly p95: number;
  readonly max: number;
}

function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  const frac = rank - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

export function measureSimulationPerf(
  args: MeasureSimulationPerfInput,
): PerfBaselineResult {
  if (!Number.isInteger(args.runs) || args.runs <= 0) {
    throw new Error("measureSimulationPerf: runs doit être un entier positif");
  }
  const sim = args.simulate ?? simulateMatch;
  const now = args.now ?? (() => nodePerformance.now());

  const samples: number[] = [];
  for (let i = 0; i < args.runs; i++) {
    const start = now();
    sim(args.input, { driverKind: args.driverKind });
    const end = now();
    samples.push(end - start);
  }

  const sum = samples.reduce((acc, v) => acc + v, 0);
  return {
    driverKind: args.driverKind,
    runs: args.runs,
    samplesMs: samples,
    mean: sum / samples.length,
    p50: percentile(samples, 50),
    p95: percentile(samples, 95),
    max: Math.max(...samples),
  };
}
