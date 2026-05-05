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
});
