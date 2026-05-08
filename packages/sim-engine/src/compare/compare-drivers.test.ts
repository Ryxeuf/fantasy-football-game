/**
 * Tests pour le comparator hybrid vs full driver (Lot 3.B.2).
 *
 * Couvre :
 *  - `compareDriversOnce` : exécute les deux drivers avec le même seed
 *    et retourne les deltas absolus (score, turnover, casualties, …).
 *  - `aggregateComparisons` : mean / p50 / p95 / max sur N runs +
 *    ratio de matchs "divergents" (deltaScore > 0).
 *
 * Toutes les assertions sont déterministes : on injecte des
 * `simulateMatch` mockés pour eviter le coût d'un sim réel et garder
 * la suite < 50ms.
 */

import { describe, expect, it } from 'vitest';

import { aggregateComparisons, compareDriversOnce } from './compare-drivers';
import type { ComparisonRun } from './compare-drivers';
import type { SimInput, SimResult } from '../types';

function makeResult(
  score: { home: number; away: number },
  turnoverCount = 4,
  touchdownCount = score.home + score.away,
  casualties: number = 0,
): SimResult {
  return {
    result: score.home > score.away ? 'home' : score.home < score.away ? 'away' : 'draw',
    events: [],
    casualties: Array.from({ length: casualties }, (_, i) => ({
      playerId: `p${i}`,
      team: 'home',
      outcome: 'badly_hurt',
    })),
    engineVer: '0.16.0',
    summary: {
      outcome: score.home > score.away ? 'home' : score.home < score.away ? 'away' : 'draw',
      score,
      turnoverCount,
      touchdownCount,
      nuffleCount: 0,
      underdogBoostCount: 0,
      durationMs: 50,
      momentum: [],
    },
  } as SimResult;
}

const fakeInput: SimInput = {
  seed: 42,
  home: { id: 'A', side: 'home' } as SimInput['home'],
  away: { id: 'B', side: 'away' } as SimInput['away'],
} as SimInput;

describe('compareDriversOnce — Lot 3.B.2', () => {
  it('exécute hybrid + full avec le même input/seed et retourne les deltas absolus', () => {
    const hybrid = makeResult({ home: 2, away: 1 }, 3, 3, 1);
    const full = makeResult({ home: 3, away: 1 }, 5, 4, 2);

    const calls: Array<'hybrid' | 'full'> = [];
    const out = compareDriversOnce(fakeInput, {
      simulate: (input, opts) => {
        expect(input).toBe(fakeInput);
        calls.push(opts!.driverKind!);
        return opts!.driverKind === 'full' ? full : hybrid;
      },
    });

    expect(calls).toEqual(['hybrid', 'full']);
    expect(out.hybrid).toBe(hybrid);
    expect(out.full).toBe(full);
    expect(out.deltas.scoreHome).toBe(1);
    expect(out.deltas.scoreAway).toBe(0);
    expect(out.deltas.scoreTotal).toBe(1);
    expect(out.deltas.turnoverCount).toBe(2);
    expect(out.deltas.touchdownCount).toBe(1);
    expect(out.deltas.casualtyCount).toBe(1);
    expect(out.deltas.outcomeChanged).toBe(false); // home wins both
  });

  it('flag outcomeChanged quand un driver inverse le résultat', () => {
    const hybrid = makeResult({ home: 1, away: 2 });
    const full = makeResult({ home: 2, away: 1 });
    const out = compareDriversOnce(fakeInput, {
      simulate: (_input, opts) => (opts!.driverKind === 'full' ? full : hybrid),
    });
    expect(out.deltas.outcomeChanged).toBe(true);
  });

  it('deltas absolus quel que soit le sens (full plus haut OU plus bas)', () => {
    const hybrid = makeResult({ home: 5, away: 0 });
    const full = makeResult({ home: 1, away: 0 });
    const out = compareDriversOnce(fakeInput, {
      simulate: (_input, opts) => (opts!.driverKind === 'full' ? full : hybrid),
    });
    expect(out.deltas.scoreHome).toBe(4);
  });
});

describe('aggregateComparisons — Lot 3.B.2', () => {
  function makeRun(deltaScore: number, outcomeChanged = false): ComparisonRun {
    return {
      hybrid: makeResult({ home: 1, away: 1 }),
      full: makeResult({ home: 1, away: 1 }),
      deltas: {
        scoreHome: deltaScore,
        scoreAway: 0,
        scoreTotal: deltaScore,
        turnoverCount: 0,
        touchdownCount: deltaScore,
        casualtyCount: 0,
        outcomeChanged,
      },
    };
  }

  it('mean / p50 / p95 / max sur scoreTotal pour 100 runs avec distribution connue', () => {
    // 90 runs delta=0, 9 runs delta=1, 1 run delta=10 (long-tail)
    const runs: ComparisonRun[] = [
      ...Array.from({ length: 90 }, () => makeRun(0)),
      ...Array.from({ length: 9 }, () => makeRun(1)),
      makeRun(10),
    ];
    const agg = aggregateComparisons(runs);

    expect(agg.matches).toBe(100);
    expect(agg.scoreTotal.mean).toBeCloseTo((9 + 10) / 100, 5);
    expect(agg.scoreTotal.p50).toBe(0);
    // p95 sur 100 echantillons trie = index 95 (0-based 94 ou 95 selon
    // convention) — ici clairement >=1 et <10 selon implémentation.
    expect(agg.scoreTotal.p95).toBeGreaterThanOrEqual(1);
    expect(agg.scoreTotal.max).toBe(10);
  });

  it('divergedPct = ratio de runs avec scoreTotal>0 OU outcomeChanged', () => {
    const runs = [
      makeRun(0),
      makeRun(0),
      makeRun(1), // diverged via score
      makeRun(0, true), // diverged via outcome
    ];
    const agg = aggregateComparisons(runs);
    expect(agg.divergedPct).toBeCloseTo(0.5, 5);
  });

  it('outcomeFlippedCount compte uniquement les outcomeChanged', () => {
    const runs = [
      makeRun(2), // score diff but no outcome flip
      makeRun(0, true),
      makeRun(1, true),
    ];
    const agg = aggregateComparisons(runs);
    expect(agg.outcomeFlippedCount).toBe(2);
  });

  it('lance sur runs vide retourne stats à 0 (pas NaN)', () => {
    const agg = aggregateComparisons([]);
    expect(agg.matches).toBe(0);
    expect(agg.scoreTotal.mean).toBe(0);
    expect(agg.scoreTotal.p50).toBe(0);
    expect(agg.scoreTotal.p95).toBe(0);
    expect(agg.scoreTotal.max).toBe(0);
    expect(agg.divergedPct).toBe(0);
    expect(agg.outcomeFlippedCount).toBe(0);
  });

  it('agrège également turnover, touchdown et casualty', () => {
    const runs: ComparisonRun[] = [
      {
        hybrid: makeResult({ home: 0, away: 0 }),
        full: makeResult({ home: 0, away: 0 }),
        deltas: {
          scoreHome: 0,
          scoreAway: 0,
          scoreTotal: 0,
          turnoverCount: 2,
          touchdownCount: 1,
          casualtyCount: 3,
          outcomeChanged: false,
        },
      },
      {
        hybrid: makeResult({ home: 0, away: 0 }),
        full: makeResult({ home: 0, away: 0 }),
        deltas: {
          scoreHome: 0,
          scoreAway: 0,
          scoreTotal: 0,
          turnoverCount: 4,
          touchdownCount: 0,
          casualtyCount: 1,
          outcomeChanged: false,
        },
      },
    ];
    const agg = aggregateComparisons(runs);
    expect(agg.turnoverCount.mean).toBe(3);
    expect(agg.turnoverCount.max).toBe(4);
    expect(agg.touchdownCount.max).toBe(1);
    expect(agg.casualtyCount.max).toBe(3);
  });
});
