import { describe, it, expect } from 'vitest';
import { rollLastingInjuryType } from './injury';

describe('rollLastingInjuryType', () => {
  // Helper: create RNG that returns a specific D6 result
  // rng() * 6 + 1 => for result R, rng needs to return (R-1)/6
  function rngForD6(result: number) {
    return () => (result - 0.5) / 6; // ensure Math.floor(rng()*6)+1 === result
  }

  it('returns -1ma for D6 roll of 1', () => {
    expect(rollLastingInjuryType(rngForD6(1), 4)).toBe('-1ma');
  });

  it('returns -1av for D6 roll of 2', () => {
    expect(rollLastingInjuryType(rngForD6(2), 4)).toBe('-1av');
  });

  it('returns -1pa for D6 roll of 3 when player has PA', () => {
    expect(rollLastingInjuryType(rngForD6(3), 4)).toBe('-1pa');
  });

  it('returns -1ag for D6 roll of 3 when player has no PA (pa=0)', () => {
    expect(rollLastingInjuryType(rngForD6(3), 0)).toBe('-1ag');
  });

  it('returns -1ag for D6 roll of 4', () => {
    expect(rollLastingInjuryType(rngForD6(4), 4)).toBe('-1ag');
  });

  it('returns -1ag for D6 roll of 5', () => {
    expect(rollLastingInjuryType(rngForD6(5), 4)).toBe('-1ag');
  });

  it('returns -1st for D6 roll of 6', () => {
    expect(rollLastingInjuryType(rngForD6(6), 4)).toBe('-1st');
  });
});
