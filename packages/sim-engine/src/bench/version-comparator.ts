/**
 * Cross-version baseline comparator (Lot 4.B.1).
 *
 * Pourquoi
 * --------
 * Avant chaque bump majeur d'engineVer, on veut visualiser la drift
 * introduite par les changements. Le bench-baseline.json contient
 * deja les metriques attendues pour un set fixe de pairings et seeds ;
 * il suffit de produire deux snapshots (un par version) et de les
 * diffuser cote pourcentages.
 *
 * Workflow recommande :
 *   1. git checkout v0.15.0
 *   2. pnpm sim:bench:snapshot > /tmp/baseline-0.15.0.json
 *   3. git checkout v0.16.0
 *   4. pnpm sim:bench:snapshot > /tmp/baseline-0.16.0.json
 *   5. pnpm sim:compare-versions --base /tmp/baseline-0.15.0.json --head /tmp/baseline-0.16.0.json
 *
 * Pure : aucune I/O ici. Le CLI lit les deux fichiers via fs et call
 * `compareBaselines`, puis decide texte ou JSON.
 */

import type { BenchBaseline, BenchBaselineEntry, ExpectedMetrics } from './baseline';

export type ComparisonSeverity = 'normal' | 'warn' | 'critical';

const METRIC_KEYS: ReadonlyArray<keyof ExpectedMetrics> = [
  'tdMean',
  'tdStd',
  'casualtyMean',
  'turnoverMean',
  'homeWinRate',
  'awayWinRate',
  'drawRate',
];

export interface PairingDelta {
  readonly homeId: string;
  readonly awayId: string;
  readonly base: ExpectedMetrics;
  readonly head: ExpectedMetrics;
  /** Delta signed (head - base) per metric. */
  readonly deltas: ExpectedMetrics;
  /** Severity = max abs(delta_relative) across metrics, vs warn / critical. */
  readonly severity: ComparisonSeverity;
  /** Max abs delta relative observed for this pairing (any metric). */
  readonly maxAbsRelativeDelta: number;
}

export interface MissingPairing {
  readonly homeId: string;
  readonly awayId: string;
}

export interface ComparisonSummary {
  /** Max absolute delta across pairings, par metric. */
  readonly maxAbsDeltaByMetric: ExpectedMetrics;
  readonly missingInBase: readonly MissingPairing[];
  readonly missingInHead: readonly MissingPairing[];
  readonly matchedPairings: number;
  readonly warnCount: number;
  readonly criticalCount: number;
}

export interface VersionComparisonResult {
  readonly base: { readonly engineVer: string; readonly snapshotAt: string };
  readonly head: { readonly engineVer: string; readonly snapshotAt: string };
  readonly pairings: readonly PairingDelta[];
  readonly summary: ComparisonSummary;
}

export interface CompareBaselinesOptions {
  /** Threshold relatif (default 0.1 = 10%) pour severity 'warn'. */
  readonly warnThreshold?: number;
  /** Threshold relatif (default 0.25 = 25%) pour severity 'critical'. */
  readonly criticalThreshold?: number;
}

const DEFAULT_WARN = 0.1;
const DEFAULT_CRITICAL = 0.25;

function pairingKey(p: { homeId: string; awayId: string }): string {
  return `${p.homeId}__${p.awayId}`;
}

function emptyMetrics(): ExpectedMetrics {
  return {
    tdMean: 0,
    tdStd: 0,
    casualtyMean: 0,
    turnoverMean: 0,
    homeWinRate: 0,
    awayWinRate: 0,
    drawRate: 0,
  };
}

function computeDeltas(
  base: ExpectedMetrics,
  head: ExpectedMetrics,
): ExpectedMetrics {
  return {
    tdMean: head.tdMean - base.tdMean,
    tdStd: head.tdStd - base.tdStd,
    casualtyMean: head.casualtyMean - base.casualtyMean,
    turnoverMean: head.turnoverMean - base.turnoverMean,
    homeWinRate: head.homeWinRate - base.homeWinRate,
    awayWinRate: head.awayWinRate - base.awayWinRate,
    drawRate: head.drawRate - base.drawRate,
  };
}

function relativeDelta(base: number, delta: number): number {
  if (base === 0) return delta === 0 ? 0 : Number.POSITIVE_INFINITY;
  return Math.abs(delta) / Math.abs(base);
}

function severityFor(
  base: ExpectedMetrics,
  deltas: ExpectedMetrics,
  warn: number,
  critical: number,
): { readonly severity: ComparisonSeverity; readonly maxAbsRel: number } {
  let maxAbsRel = 0;
  for (const k of METRIC_KEYS) {
    const rel = relativeDelta(base[k], deltas[k]);
    if (rel > maxAbsRel) maxAbsRel = rel;
  }
  if (maxAbsRel > critical) return { severity: 'critical', maxAbsRel };
  if (maxAbsRel > warn) return { severity: 'warn', maxAbsRel };
  return { severity: 'normal', maxAbsRel };
}

export function compareBaselines(
  base: BenchBaseline,
  head: BenchBaseline,
  options: CompareBaselinesOptions = {},
): VersionComparisonResult {
  const warn = options.warnThreshold ?? DEFAULT_WARN;
  const critical = options.criticalThreshold ?? DEFAULT_CRITICAL;

  const baseByKey = new Map<string, BenchBaselineEntry>();
  for (const p of base.pairings) baseByKey.set(pairingKey(p), p);
  const headByKey = new Map<string, BenchBaselineEntry>();
  for (const p of head.pairings) headByKey.set(pairingKey(p), p);

  const pairings: PairingDelta[] = [];
  const missingInBase: MissingPairing[] = [];
  const missingInHead: MissingPairing[] = [];
  const maxAbs = emptyMetrics() as Record<keyof ExpectedMetrics, number>;
  let warnCount = 0;
  let criticalCount = 0;

  // Iterate union, ordered by (head pairings first, then base-only).
  const seen = new Set<string>();
  for (const p of head.pairings) {
    const key = pairingKey(p);
    seen.add(key);
    const basePair = baseByKey.get(key);
    if (!basePair) {
      missingInBase.push({ homeId: p.homeId, awayId: p.awayId });
      continue;
    }
    const deltas = computeDeltas(basePair.expected, p.expected);
    const { severity, maxAbsRel } = severityFor(
      basePair.expected,
      deltas,
      warn,
      critical,
    );
    if (severity === 'warn') warnCount += 1;
    else if (severity === 'critical') criticalCount += 1;
    for (const k of METRIC_KEYS) {
      const abs = Math.abs(deltas[k]);
      if (abs > maxAbs[k]) maxAbs[k] = abs;
    }
    pairings.push({
      homeId: p.homeId,
      awayId: p.awayId,
      base: basePair.expected,
      head: p.expected,
      deltas,
      severity,
      maxAbsRelativeDelta: maxAbsRel,
    });
  }
  for (const p of base.pairings) {
    if (!seen.has(pairingKey(p))) {
      missingInHead.push({ homeId: p.homeId, awayId: p.awayId });
    }
  }

  return {
    base: { engineVer: base.engineVer, snapshotAt: base.snapshotAt },
    head: { engineVer: head.engineVer, snapshotAt: head.snapshotAt },
    pairings,
    summary: {
      maxAbsDeltaByMetric: maxAbs as ExpectedMetrics,
      missingInBase,
      missingInHead,
      matchedPairings: pairings.length,
      warnCount,
      criticalCount,
    },
  };
}

function fmtSigned(n: number, digits = 2): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(digits)}`;
}

export function formatVersionComparisonReport(
  comparison: VersionComparisonResult,
): string {
  const { base, head, pairings, summary } = comparison;
  const lines: string[] = [
    `=== Cross-version comparison ===`,
    `  base : ${base.engineVer}  (snapshot ${base.snapshotAt})`,
    `  head : ${head.engineVer}  (snapshot ${head.snapshotAt})`,
    `  matched pairings : ${summary.matchedPairings}`,
    `  warn : ${summary.warnCount}     critical : ${summary.criticalCount}`,
    '',
  ];

  if (pairings.length > 0) {
    lines.push(`Per-pairing deltas (head - base):`);
    for (const p of pairings) {
      const tag = p.severity === 'normal' ? '   ' : `[${p.severity.toUpperCase()}]`;
      lines.push(
        `  ${tag} ${p.homeId} vs ${p.awayId}  ` +
          `tdMean=${fmtSigned(p.deltas.tdMean)}  ` +
          `casMean=${fmtSigned(p.deltas.casualtyMean)}  ` +
          `homeWin=${fmtSigned(p.deltas.homeWinRate, 3)}  ` +
          `awayWin=${fmtSigned(p.deltas.awayWinRate, 3)}`,
      );
    }
  }

  if (summary.missingInBase.length > 0) {
    lines.push('');
    lines.push('Missing in base (new pairings in head):');
    for (const p of summary.missingInBase) {
      lines.push(`  - ${p.homeId} vs ${p.awayId}`);
    }
  }
  if (summary.missingInHead.length > 0) {
    lines.push('');
    lines.push('Missing in head (removed pairings):');
    for (const p of summary.missingInHead) {
      lines.push(`  - ${p.homeId} vs ${p.awayId}`);
    }
  }
  return lines.join('\n');
}
