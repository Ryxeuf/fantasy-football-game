import { describe, expect, it } from 'vitest';

import {
  DEFAULT_BASELINE_TOLERANCE,
  compareToBaseline,
  formatBaselineReport,
  parseBenchBaseline,
  type BenchBaseline,
  type BenchBaselineEntry,
} from './baseline';
import type { VivacityMetrics } from './metrics';

const baselineEntry = (
  overrides: Partial<BenchBaselineEntry> = {}
): BenchBaselineEntry => ({
  homeId: 'pit-smashers',
  awayId: 'kc-soaring-hawks',
  runs: 200,
  seedOffset: 0,
  expected: {
    tdMean: 1.64,
    tdStd: 0.94,
    casualtyMean: 0.04,
    turnoverMean: 6.07,
    homeWinRate: 0.38,
    awayWinRate: 0.305,
    drawRate: 0.315,
  },
  ...overrides,
});

const fullBaseline = (
  overrides: Partial<BenchBaseline> = {}
): BenchBaseline => ({
  engineVer: '0.1.0',
  snapshotAt: '2026-05-06',
  tolerance: DEFAULT_BASELINE_TOLERANCE,
  pairings: [baselineEntry()],
  ...overrides,
});

const observed = (overrides: Partial<VivacityMetrics> = {}): VivacityMetrics => ({
  matches: 200,
  td: { mean: 1.64, std: 0.94, p5: 0, p95: 3 },
  casualties: { mean: 0.04, std: 0.18 },
  turnovers: { mean: 6.07 },
  fatTails: { highScoring: 0, bloodbath: 0 },
  outcomes: { home: 76, away: 61, draw: 63, upsetRate: 0 },
  meetsTargets: { stdDevTd: false, upsetRate: false },
  ...overrides,
});

describe('parseBenchBaseline — sprint Pro League 0.D.4', () => {
  it('exposes the documented default tolerance (5%)', () => {
    expect(DEFAULT_BASELINE_TOLERANCE).toBe(0.05);
  });

  it('accepts a well-formed baseline', () => {
    expect(() => parseBenchBaseline(fullBaseline())).not.toThrow();
  });

  it('rejects an unknown extra key (strict)', () => {
    const bad = { ...fullBaseline(), foo: 'bar' };
    expect(() => parseBenchBaseline(bad)).toThrow();
  });

  it('rejects a tolerance outside (0, 1)', () => {
    expect(() => parseBenchBaseline(fullBaseline({ tolerance: -0.1 }))).toThrow();
    expect(() => parseBenchBaseline(fullBaseline({ tolerance: 1.5 }))).toThrow();
  });

  it('rejects a non-positive runs value', () => {
    expect(() =>
      parseBenchBaseline(fullBaseline({ pairings: [baselineEntry({ runs: 0 })] }))
    ).toThrow();
  });

  it('rejects an empty pairings array', () => {
    expect(() => parseBenchBaseline(fullBaseline({ pairings: [] }))).toThrow();
  });
});

describe('compareToBaseline — within tolerance', () => {
  it('returns passed=true when observed exactly matches expected', () => {
    const baseline = fullBaseline();
    const out = compareToBaseline(observed(), baseline.pairings[0], baseline.tolerance);
    expect(out.passed).toBe(true);
    expect(out.deviations).toEqual([]);
  });

  it('returns passed=true when each metric is within ±5%', () => {
    // Bump tdMean by 4% — still within 5%.
    const out = compareToBaseline(
      observed({ td: { mean: 1.64 * 1.04, std: 0.94, p5: 0, p95: 3 } }),
      baselineEntry(),
      DEFAULT_BASELINE_TOLERANCE
    );
    expect(out.passed).toBe(true);
  });

  it('flags a deviation that exceeds the tolerance', () => {
    // Bump tdMean by 10% — clearly exceeds 5%.
    const out = compareToBaseline(
      observed({ td: { mean: 1.64 * 1.1, std: 0.94, p5: 0, p95: 3 } }),
      baselineEntry(),
      DEFAULT_BASELINE_TOLERANCE
    );
    expect(out.passed).toBe(false);
    expect(out.deviations.find((d) => d.metric === 'tdMean')).toBeDefined();
  });

  it('reports the metric name, expected, observed, and relative delta', () => {
    const out = compareToBaseline(
      observed({ turnovers: { mean: 6.07 * 1.2 } }),
      baselineEntry(),
      DEFAULT_BASELINE_TOLERANCE
    );
    expect(out.passed).toBe(false);
    const turnover = out.deviations.find((d) => d.metric === 'turnoverMean');
    expect(turnover?.expected).toBe(6.07);
    expect(turnover?.observed).toBeCloseTo(6.07 * 1.2, 6);
    expect(turnover?.relativeDelta).toBeGreaterThan(0.05);
  });

  it('flags every metric that deviates beyond tolerance', () => {
    // Multiple deviations → multiple entries.
    const out = compareToBaseline(
      observed({
        td: { mean: 3, std: 2, p5: 0, p95: 5 },
        casualties: { mean: 1, std: 1 },
        turnovers: { mean: 10 },
      }),
      baselineEntry(),
      DEFAULT_BASELINE_TOLERANCE
    );
    expect(out.passed).toBe(false);
    expect(out.deviations.length).toBeGreaterThanOrEqual(3);
  });

  it('handles outcome rates correctly (homeWinRate / awayWinRate / drawRate)', () => {
    const out = compareToBaseline(
      observed({ outcomes: { home: 200, away: 0, draw: 0, upsetRate: 0 } }),
      baselineEntry(),
      DEFAULT_BASELINE_TOLERANCE
    );
    // home 100% vs expected 38% → big deviation
    expect(out.passed).toBe(false);
    expect(out.deviations.find((d) => d.metric === 'homeWinRate')).toBeDefined();
  });

  it('respects a per-pairing tolerance override', () => {
    const looseEntry = baselineEntry({ tolerance: 0.5 });
    const out = compareToBaseline(
      observed({ td: { mean: 1.64 * 1.4, std: 0.94, p5: 0, p95: 3 } }),
      looseEntry,
      DEFAULT_BASELINE_TOLERANCE // global default 5%
    );
    // 40% deviation but per-entry tolerance is 50% → passes
    expect(out.passed).toBe(true);
  });
});

describe('formatBaselineReport — text output for CI', () => {
  it('prints PASS when no deviations', () => {
    const baseline = fullBaseline();
    const report = formatBaselineReport([
      { entry: baseline.pairings[0], result: compareToBaseline(observed(), baseline.pairings[0], baseline.tolerance) },
    ]);
    expect(report).toContain('PASS');
    expect(report).not.toContain('FAIL');
  });

  it('prints FAIL with each deviation listed', () => {
    const baseline = fullBaseline();
    const result = compareToBaseline(
      observed({ td: { mean: 5, std: 5, p5: 0, p95: 8 } }),
      baseline.pairings[0],
      baseline.tolerance
    );
    const report = formatBaselineReport([{ entry: baseline.pairings[0], result }]);
    expect(report).toContain('FAIL');
    expect(report).toContain('tdMean');
  });
});
