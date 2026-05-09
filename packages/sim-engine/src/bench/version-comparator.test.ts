/**
 * Tests pour le cross-version comparator (Lot 4.B.1).
 *
 * Couvre :
 *  - compareBaselines : diff par pairing, stats globales (max delta
 *    par metrique, pairings missing).
 *  - formatVersionComparisonReport : rendu text deterministe avec
 *    colonnes alignees.
 */

import { describe, expect, it } from 'vitest';

import type { BenchBaseline, BenchBaselineEntry } from './baseline';
import {
  compareBaselines,
  formatVersionComparisonReport,
} from './version-comparator';

function entry(
  homeId: string,
  awayId: string,
  expectedOverrides: Partial<BenchBaselineEntry['expected']> = {},
): BenchBaselineEntry {
  return {
    homeId,
    awayId,
    runs: 1000,
    seedOffset: 0,
    expected: {
      tdMean: 2.0,
      tdStd: 1.0,
      casualtyMean: 1.5,
      turnoverMean: 4.0,
      homeWinRate: 0.5,
      awayWinRate: 0.4,
      drawRate: 0.1,
      ...expectedOverrides,
    },
  };
}

function baseline(
  engineVer: string,
  pairings: BenchBaselineEntry[],
): BenchBaseline {
  return {
    engineVer,
    snapshotAt: '2026-05-09',
    tolerance: 0.05,
    pairings,
  };
}

describe('compareBaselines — Lot 4.B.1', () => {
  it('retourne un diff vide quand les deux baselines sont identiques', () => {
    const a = baseline('0.16.0', [entry('orcs', 'humans')]);
    const b = baseline('0.16.0', [entry('orcs', 'humans')]);
    const out = compareBaselines(a, b);
    expect(out.pairings).toHaveLength(1);
    expect(out.pairings[0].deltas.tdMean).toBe(0);
    expect(out.summary.maxAbsDeltaByMetric.tdMean).toBe(0);
    expect(out.summary.missingInBase).toEqual([]);
    expect(out.summary.missingInHead).toEqual([]);
  });

  it('calcule les deltas signed (head - base) par pairing', () => {
    const a = baseline('0.15.0', [entry('orcs', 'elves', { tdMean: 2.0 })]);
    const b = baseline('0.16.0', [entry('orcs', 'elves', { tdMean: 2.4 })]);
    const out = compareBaselines(a, b);
    expect(out.pairings[0].deltas.tdMean).toBeCloseTo(0.4, 5);
    expect(out.pairings[0].deltas.tdStd).toBe(0); // pas d'override
    expect(out.summary.maxAbsDeltaByMetric.tdMean).toBeCloseTo(0.4, 5);
  });

  it('signale les pairings present dans head mais absents de base', () => {
    const a = baseline('0.15.0', [entry('orcs', 'elves')]);
    const b = baseline('0.16.0', [
      entry('orcs', 'elves'),
      entry('halflings', 'chaos'),
    ]);
    const out = compareBaselines(a, b);
    expect(out.summary.missingInBase).toEqual([
      { homeId: 'halflings', awayId: 'chaos' },
    ]);
    expect(out.summary.missingInHead).toEqual([]);
  });

  it('signale les pairings present dans base mais absents de head', () => {
    const a = baseline('0.15.0', [
      entry('orcs', 'elves'),
      entry('skaven', 'goblins'),
    ]);
    const b = baseline('0.16.0', [entry('orcs', 'elves')]);
    const out = compareBaselines(a, b);
    expect(out.summary.missingInHead).toEqual([
      { homeId: 'skaven', awayId: 'goblins' },
    ]);
  });

  it('aggrege le max abs delta par metrique a travers tous les pairings', () => {
    const a = baseline('0.15.0', [
      entry('a', 'b', { homeWinRate: 0.5 }),
      entry('c', 'd', { homeWinRate: 0.5 }),
    ]);
    const b = baseline('0.16.0', [
      entry('a', 'b', { homeWinRate: 0.55 }), // +0.05
      entry('c', 'd', { homeWinRate: 0.42 }), // -0.08
    ]);
    const out = compareBaselines(a, b);
    expect(out.summary.maxAbsDeltaByMetric.homeWinRate).toBeCloseTo(0.08, 5);
  });

  it('tolere les deltas negatifs et zero (signed strict)', () => {
    const a = baseline('0.15.0', [entry('a', 'b', { tdMean: 3.0 })]);
    const b = baseline('0.16.0', [entry('a', 'b', { tdMean: 2.7 })]);
    const out = compareBaselines(a, b);
    expect(out.pairings[0].deltas.tdMean).toBeCloseTo(-0.3, 5);
    // Max abs reste positif.
    expect(out.summary.maxAbsDeltaByMetric.tdMean).toBeCloseTo(0.3, 5);
  });

  it('flag pairings avec |delta| au-dessus du threshold (severity warn/critical)', () => {
    const a = baseline('0.15.0', [
      entry('a', 'b', { tdMean: 2.0 }),
      entry('c', 'd', { tdMean: 2.0 }),
      entry('e', 'f', { tdMean: 2.0 }),
    ]);
    const b = baseline('0.16.0', [
      entry('a', 'b', { tdMean: 2.05 }), // +2.5% -> normal
      entry('c', 'd', { tdMean: 2.3 }), // +15% -> warn
      entry('e', 'f', { tdMean: 2.6 }), // +30% -> critical
    ]);
    const out = compareBaselines(a, b, {
      warnThreshold: 0.1,
      criticalThreshold: 0.25,
    });
    const severities = out.pairings.map((p) => p.severity);
    expect(severities).toEqual(['normal', 'warn', 'critical']);
  });
});

describe('formatVersionComparisonReport — Lot 4.B.1', () => {
  it('produit un rapport text avec en-tete des engineVer et un summary', () => {
    const a = baseline('0.15.0', [entry('orcs', 'elves')]);
    const b = baseline('0.16.0', [entry('orcs', 'elves', { tdMean: 2.5 })]);
    const out = compareBaselines(a, b);
    const text = formatVersionComparisonReport(out);
    expect(text).toContain('0.15.0');
    expect(text).toContain('0.16.0');
    expect(text).toContain('orcs vs elves');
    expect(text).toMatch(/tdMean.*\+0\.50/);
  });

  it('signale les pairings missing dans le summary', () => {
    const a = baseline('0.15.0', [entry('a', 'b')]);
    const b = baseline('0.16.0', []);
    const out = compareBaselines(a, b);
    const text = formatVersionComparisonReport(out);
    expect(text).toMatch(/missing in head/i);
    expect(text).toContain('a vs b');
  });
});
