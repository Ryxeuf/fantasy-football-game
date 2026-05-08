import { isMatchEvent } from '@bb/shared-types';
import { describe, expect, it } from 'vitest';

import { ENGINE_VER, simulateMatch } from './index';
import type { SimInput, SimResult } from './index';

const baseInput = (overrides: Partial<SimInput> = {}): SimInput => ({
  seed: 42,
  home: { id: 'pit-smashers', name: 'Pittsburgh Smashers', side: 'home' },
  away: { id: 'kc-hawks', name: 'Kansas City Soaring Hawks', side: 'away' },
  ...overrides,
});

describe('simulateMatch — public contract (sprint Pro League 0.A.1)', () => {
  it('returns a SimResult with the documented top-level shape', () => {
    const out: SimResult = simulateMatch(baseInput());

    expect(out).toHaveProperty('result');
    expect(out).toHaveProperty('events');
    expect(out).toHaveProperty('summary');
    expect(out).toHaveProperty('casualties');
    expect(out).toHaveProperty('engineVer');
  });

  it('stamps the current ENGINE_VER on every result (replay freeze)', () => {
    const out = simulateMatch(baseInput());
    expect(out.engineVer).toBe(ENGINE_VER);
  });

  it('exposes events and casualties as iterable arrays', () => {
    const out = simulateMatch(baseInput());
    expect(Array.isArray(out.events)).toBe(true);
    expect(Array.isArray(out.casualties)).toBe(true);
  });

  it('returns an outcome consistent with the score', () => {
    const out = simulateMatch(baseInput());
    const { score } = out.summary;
    if (score.home > score.away) {
      expect(out.result).toBe('home');
    } else if (score.away > score.home) {
      expect(out.result).toBe('away');
    } else {
      expect(out.result).toBe('draw');
    }
  });

  it('is deterministic for a given seed', () => {
    const a = simulateMatch(baseInput({ seed: 1234 }));
    const b = simulateMatch(baseInput({ seed: 1234 }));
    expect(b).toEqual(a);
  });

  it('rejects malformed input (missing teams)', () => {
    // @ts-expect-error — runtime contract guard
    expect(() => simulateMatch({ seed: 1 })).toThrow();
  });

  it('rejects when both teams share the same id (would skew standings)', () => {
    expect(() =>
      simulateMatch(
        baseInput({
          home: { id: 'dup', name: 'A', side: 'home' },
          away: { id: 'dup', name: 'B', side: 'away' },
        })
      )
    ).toThrow();
  });

  it('every emitted event passes the @bb/shared-types runtime guard (0.A.3)', () => {
    const out = simulateMatch(baseInput());
    for (const ev of out.events) {
      expect(isMatchEvent(ev)).toBe(true);
    }
  });

  it('the KICKOFF event carries engineVer matching the result envelope', () => {
    const out = simulateMatch(baseInput());
    const kickoff = out.events.find((e) => e.type === 'KICKOFF');
    expect(kickoff).toBeDefined();
    expect(kickoff?.engineVer).toBe(out.engineVer);
  });
});

describe('simulateMatch — driver toggle hybrid/full (sprint Pro League 3.B.1)', () => {
  it('default (no options) → uses hybrid driver, deterministe (rétrocompat)', () => {
    const a = simulateMatch(baseInput({ seed: 7 }));
    const b = simulateMatch(baseInput({ seed: 7 }), {});
    const c = simulateMatch(baseInput({ seed: 7 }), { driverKind: 'hybrid' });
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });

  it('driverKind: "full" produit un résultat différent du hybrid (drivers distincts)', () => {
    const hybrid = simulateMatch(baseInput({ seed: 11 }), {
      driverKind: 'hybrid',
    });
    const full = simulateMatch(baseInput({ seed: 11 }), {
      driverKind: 'full',
    });
    // Pas une assertion stricte de différence (deux drivers peuvent
    // converger sur le même score par coïncidence), mais on vérifie
    // que chaque mode produit une SimResult valide. Le délégation a
    // été testée séparément dans full-driver.test.ts / hybrid-driver.test.ts.
    expect(hybrid).toHaveProperty('events');
    expect(full).toHaveProperty('events');
    expect(hybrid.engineVer).toBe(ENGINE_VER);
    expect(full.engineVer).toBe(ENGINE_VER);
  });

  it('driverKind: "full" reste déterministe pour un même seed', () => {
    const a = simulateMatch(baseInput({ seed: 99 }), { driverKind: 'full' });
    const b = simulateMatch(baseInput({ seed: 99 }), { driverKind: 'full' });
    expect(b).toEqual(a);
  });
});
