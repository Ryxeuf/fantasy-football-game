import { describe, expect, it } from 'vitest';

import {
  computeVivacityMetrics,
  giniCoefficient,
  mean,
  quantile,
  simResultToSample,
  stdDev,
  variance,
  type VivacitySample,
} from './metrics';

describe('Pure statistics helpers — sprint Pro League 0.D.3', () => {
  it('mean of an empty array is 0', () => {
    expect(mean([])).toBe(0);
  });

  it('mean computes the arithmetic mean', () => {
    expect(mean([1, 2, 3, 4, 5])).toBeCloseTo(3, 10);
    expect(mean([0, 0, 0])).toBe(0);
  });

  it('variance of a single value is 0', () => {
    expect(variance([42])).toBe(0);
  });

  it('variance of [1, 2, 3, 4, 5] is 2.5 (population variance)', () => {
    // pop var = sum((x - mean)^2) / n with mean=3 → (4+1+0+1+4)/5 = 2
    expect(variance([1, 2, 3, 4, 5])).toBeCloseTo(2, 10);
  });

  it('stdDev = sqrt(variance)', () => {
    expect(stdDev([1, 2, 3, 4, 5])).toBeCloseTo(Math.sqrt(2), 10);
  });

  it('quantile : p=0 returns min, p=1 returns max, p=0.5 returns median (linear)', () => {
    expect(quantile([1, 2, 3, 4, 5], 0)).toBe(1);
    expect(quantile([1, 2, 3, 4, 5], 1)).toBe(5);
    expect(quantile([1, 2, 3, 4, 5], 0.5)).toBeCloseTo(3, 10);
  });

  it('quantile : p=0.05 / 0.95 on a sorted array', () => {
    const xs = Array.from({ length: 101 }, (_, i) => i); // 0..100
    expect(quantile(xs, 0.05)).toBeCloseTo(5, 10);
    expect(quantile(xs, 0.95)).toBeCloseTo(95, 10);
  });

  it('quantile : empty array returns 0', () => {
    expect(quantile([], 0.5)).toBe(0);
  });
});

describe('giniCoefficient — MVP distribution sanity', () => {
  it('a perfectly uniform distribution has Gini ~0', () => {
    const out = giniCoefficient([5, 5, 5, 5, 5, 5]);
    expect(out).toBeLessThan(0.01);
  });

  it('a one-player-wins-all distribution has Gini approaching 1', () => {
    const out = giniCoefficient([0, 0, 0, 0, 0, 100]);
    expect(out).toBeGreaterThan(0.7);
    expect(out).toBeLessThanOrEqual(1);
  });

  it('a moderately unequal distribution sits in (0, 1)', () => {
    const out = giniCoefficient([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(out).toBeGreaterThan(0);
    expect(out).toBeLessThan(1);
  });

  it('empty / all-zero arrays return 0', () => {
    expect(giniCoefficient([])).toBe(0);
    expect(giniCoefficient([0, 0, 0])).toBe(0);
  });

  it('single value returns 0 (no inequality with one player)', () => {
    expect(giniCoefficient([42])).toBe(0);
  });
});

describe('computeVivacityMetrics — sprint targets', () => {
  const sample = (overrides: Partial<VivacitySample> = {}): VivacitySample => ({
    totalTd: 3,
    outcome: 'home',
    casualties: 1,
    turnovers: 4,
    ...overrides,
  });

  it('returns zero counts on an empty sample list', () => {
    const out = computeVivacityMetrics([]);
    expect(out.matches).toBe(0);
    expect(out.td.mean).toBe(0);
    expect(out.outcomes.home).toBe(0);
  });

  it('aggregates basic counts and rates', () => {
    const samples: VivacitySample[] = [
      sample({ totalTd: 2, outcome: 'home', casualties: 0, turnovers: 3 }),
      sample({ totalTd: 4, outcome: 'away', casualties: 2, turnovers: 5 }),
      sample({ totalTd: 0, outcome: 'draw', casualties: 1, turnovers: 6 }),
      sample({ totalTd: 6, outcome: 'home', casualties: 4, turnovers: 4 }),
    ];
    const out = computeVivacityMetrics(samples);
    expect(out.matches).toBe(4);
    expect(out.td.mean).toBeCloseTo((2 + 4 + 0 + 6) / 4, 10);
    expect(out.outcomes.home).toBe(2);
    expect(out.outcomes.away).toBe(1);
    expect(out.outcomes.draw).toBe(1);
  });

  it('flags fat-tail matches : >= 5 TD or >= 4 casualties', () => {
    const samples: VivacitySample[] = [
      sample({ totalTd: 6, casualties: 0 }), // high scoring
      sample({ totalTd: 1, casualties: 5 }), // bloodbath
      sample({ totalTd: 7, casualties: 4 }), // both
      sample({ totalTd: 1, casualties: 1 }), // neither
    ];
    const out = computeVivacityMetrics(samples);
    expect(out.fatTails.highScoring).toBe(2 / 4); // 50%
    expect(out.fatTails.bloodbath).toBe(2 / 4); // 50%
  });

  it('upset rate counts matches where the underdog actually wins (draws are not upsets)', () => {
    const samples: VivacitySample[] = [
      sample({ outcome: 'home', favorite: 'home' }), // favorite wins, not upset
      sample({ outcome: 'away', favorite: 'home' }), // underdog wins, upset
      sample({ outcome: 'draw', favorite: 'home' }), // draw — not an upset
      sample({ outcome: 'home', favorite: 'home' }), // favorite wins, not upset
    ];
    const out = computeVivacityMetrics(samples);
    // Only the away win against home favorite counts. Draw is excluded.
    expect(out.outcomes.upsetRate).toBeCloseTo(1 / 4, 10);
  });

  it('upsetRate is 0 when no favorite is annotated on any match', () => {
    const samples: VivacitySample[] = [
      sample({ outcome: 'home' }),
      sample({ outcome: 'away' }),
    ];
    expect(computeVivacityMetrics(samples).outcomes.upsetRate).toBe(0);
  });

  it('meetsTargets reflects sprint thresholds (std dev TD >= 1.4, upset rate 12-18%)', () => {
    // Construct synthetic samples with explicit TDs to control std dev.
    const samples: VivacitySample[] = [];
    // Pad with high-variance TDs : alternating 0 and 6 → mean=3, std=3.
    for (let i = 0; i < 20; i += 1) {
      samples.push(sample({ totalTd: i % 2 === 0 ? 0 : 6 }));
    }
    // Add 3 favorite-home upsets out of 20 (15% upset rate).
    for (let i = 0; i < 17; i += 1) samples[i] = { ...samples[i], favorite: 'home', outcome: 'home' };
    for (let i = 17; i < 20; i += 1) samples[i] = { ...samples[i], favorite: 'home', outcome: 'away' };
    const out = computeVivacityMetrics(samples);
    expect(out.meetsTargets.stdDevTd).toBe(true);
    expect(out.meetsTargets.upsetRate).toBe(true);
  });

  it('meetsTargets.stdDevTd is false when variance is too low', () => {
    const samples: VivacitySample[] = Array.from({ length: 10 }, () => sample({ totalTd: 3 }));
    const out = computeVivacityMetrics(samples);
    expect(out.meetsTargets.stdDevTd).toBe(false);
  });
});

describe('simResultToSample — convenience wrapper', () => {
  it('extracts totalTd / outcome / casualties / turnovers from a SimResult-like input', () => {
    const fakeResult = {
      result: 'home' as const,
      events: [],
      summary: {
        outcome: 'home' as const,
        score: { home: 2, away: 1 },
        turnoverCount: 5,
        touchdownCount: 3,
        nuffleCount: 0,
        underdogBoostCount: 0,
        durationMs: 0,
        momentum: [],
      },
      casualties: [{ playerId: 'a' }, { playerId: 'b' }],
      engineVer: '0.1.0',
    };
    const sample = simResultToSample(fakeResult, 'home');
    expect(sample.totalTd).toBe(3);
    expect(sample.outcome).toBe('home');
    expect(sample.casualties).toBe(2);
    expect(sample.turnovers).toBe(5);
    expect(sample.favorite).toBe('home');
  });
});
