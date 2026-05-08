/**
 * Comparator pure hybrid vs full driver (Lot 3.B.2).
 *
 * `compareDriversOnce` exécute `simulateMatch` deux fois sur le même
 * `SimInput` (même seed donc même tirages PRNG côté hybrid + même
 * tactique côté full) et calcule les deltas absolus entre les deux
 * résultats.
 *
 * `aggregateComparisons` consolide N runs : mean / p50 / p95 / max sur
 * chaque métrique + ratio de matchs "divergents" (deltaScore > 0 ou
 * outcome flip).
 *
 * Pure / pas d'I/O / pas de dépendance Prisma => testable hors DB et
 * réutilisable depuis un script CLI ou depuis un service serveur.
 *
 * Le caller est responsable de fournir une fonction `simulate` (par
 * défaut : la `simulateMatch` du package). Permet aux tests d'injecter
 * un mock pour rester sub-50ms.
 */

import { simulateMatch } from '../simulate-match';
import type { SimInput, SimResult } from '../types';

import type { SimulateMatchOptions } from '../simulate-match';

/** Driver de simulation utilisé pour le comparator. */
export type CompareDriverKind = 'hybrid' | 'full';

/** Deltas absolus entre les deux résultats d'un même match. */
export interface ComparisonDeltas {
  /** |hybrid.score.home − full.score.home| */
  readonly scoreHome: number;
  /** |hybrid.score.away − full.score.away| */
  readonly scoreAway: number;
  /** scoreHome + scoreAway — utilisé pour le percentile global. */
  readonly scoreTotal: number;
  /** |hybrid.turnoverCount − full.turnoverCount| */
  readonly turnoverCount: number;
  /** |hybrid.touchdownCount − full.touchdownCount| */
  readonly touchdownCount: number;
  /** |hybrid.casualties.length − full.casualties.length| */
  readonly casualtyCount: number;
  /** True si l'outcome (home/away/draw) diffère entre les deux drivers. */
  readonly outcomeChanged: boolean;
}

/** Résultat d'une comparaison unique sur un seul match. */
export interface ComparisonRun {
  readonly hybrid: SimResult;
  readonly full: SimResult;
  readonly deltas: ComparisonDeltas;
}

/** Stats agrégées sur une métrique numérique. */
export interface MetricStats {
  readonly mean: number;
  readonly p50: number;
  readonly p95: number;
  readonly max: number;
}

/** Stats globales sur N runs de comparator. */
export interface ComparisonAggregate {
  readonly matches: number;
  readonly scoreTotal: MetricStats;
  readonly turnoverCount: MetricStats;
  readonly touchdownCount: MetricStats;
  readonly casualtyCount: MetricStats;
  /** Nombre de matchs où l'outcome a flip (home<->away, ou draw->win). */
  readonly outcomeFlippedCount: number;
  /** Pct de runs avec scoreTotal > 0 OU outcomeChanged. */
  readonly divergedPct: number;
}

/**
 * Type d'un `simulateMatch` injectable. Sert au testing pour éviter le
 * coût d'un sim réel et au CLI pour pouvoir wrapper la fonction réelle
 * d'un timing externe.
 */
export type SimulateFn = (
  input: SimInput,
  options?: SimulateMatchOptions
) => SimResult;

export interface CompareDriversOnceOpts {
  /** Override du `simulateMatch` réel — utile pour les tests. */
  readonly simulate?: SimulateFn;
}

function abs(a: number, b: number): number {
  return Math.abs(a - b);
}

export function compareDriversOnce(
  input: SimInput,
  opts: CompareDriversOnceOpts = {}
): ComparisonRun {
  const sim = opts.simulate ?? simulateMatch;
  const hybrid = sim(input, { driverKind: 'hybrid' });
  const full = sim(input, { driverKind: 'full' });

  const scoreHome = abs(hybrid.summary.score.home, full.summary.score.home);
  const scoreAway = abs(hybrid.summary.score.away, full.summary.score.away);

  return {
    hybrid,
    full,
    deltas: {
      scoreHome,
      scoreAway,
      scoreTotal: scoreHome + scoreAway,
      turnoverCount: abs(
        hybrid.summary.turnoverCount,
        full.summary.turnoverCount
      ),
      touchdownCount: abs(
        hybrid.summary.touchdownCount,
        full.summary.touchdownCount
      ),
      casualtyCount: abs(hybrid.casualties.length, full.casualties.length),
      outcomeChanged: hybrid.summary.outcome !== full.summary.outcome,
    },
  };
}

/**
 * Percentile par interpolation lineaire (méthode standard NIST type 7,
 * identique à numpy.percentile sans interpolation explicite). Sur
 * `values=[]` retourne 0 — comportement choisi pour ne pas polluer les
 * gauges Prometheus avec NaN sur un appel à vide.
 */
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

function statsOf(values: readonly number[]): MetricStats {
  if (values.length === 0) {
    return { mean: 0, p50: 0, p95: 0, max: 0 };
  }
  const sum = values.reduce((acc, v) => acc + v, 0);
  return {
    mean: sum / values.length,
    p50: percentile(values, 50),
    p95: percentile(values, 95),
    max: Math.max(...values),
  };
}

export function aggregateComparisons(
  runs: readonly ComparisonRun[]
): ComparisonAggregate {
  if (runs.length === 0) {
    const zero: MetricStats = { mean: 0, p50: 0, p95: 0, max: 0 };
    return {
      matches: 0,
      scoreTotal: zero,
      turnoverCount: zero,
      touchdownCount: zero,
      casualtyCount: zero,
      outcomeFlippedCount: 0,
      divergedPct: 0,
    };
  }

  const scoreTotals = runs.map((r) => r.deltas.scoreTotal);
  const turnovers = runs.map((r) => r.deltas.turnoverCount);
  const touchdowns = runs.map((r) => r.deltas.touchdownCount);
  const casualties = runs.map((r) => r.deltas.casualtyCount);

  const flipped = runs.filter((r) => r.deltas.outcomeChanged).length;
  const diverged = runs.filter(
    (r) => r.deltas.scoreTotal > 0 || r.deltas.outcomeChanged
  ).length;

  return {
    matches: runs.length,
    scoreTotal: statsOf(scoreTotals),
    turnoverCount: statsOf(turnovers),
    touchdownCount: statsOf(touchdowns),
    casualtyCount: statsOf(casualties),
    outcomeFlippedCount: flipped,
    divergedPct: diverged / runs.length,
  };
}
