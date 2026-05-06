import { describe, expect, it } from 'vitest';

import {
  FUMBBL_REFERENCE,
  FUMBBL_TOLERANCE,
  getFumbblRaceStats,
  getFumbblRaceStatsOrThrow,
  isWithinFumbblTolerance,
  parseFumbblReference,
} from './fumbbl-reference';

describe('FUMBBL reference dataset — sprint Pro League 0.D.2', () => {
  it('exposes a versioned snapshot identifier and a non-empty source', () => {
    expect(FUMBBL_REFERENCE.version.length).toBeGreaterThan(0);
    expect(FUMBBL_REFERENCE.source.length).toBeGreaterThan(0);
    expect(FUMBBL_REFERENCE.snapshotAt.length).toBeGreaterThan(0);
    expect(FUMBBL_REFERENCE.sampleSize).toBeGreaterThan(0);
  });

  it('declares stats for the 16 Pro League race identities (lot 0.B.3)', () => {
    const required = [
      'Orc',
      'Dark Elf',
      'Wood Elf',
      'Lizardmen',
      'Skaven',
      'Amazon',
      'Norse',
      'Undead',
      'Dwarf',
      'Pro Elf',
      'Tomb Kings',
      'Halfling',
      'Beastmen',
      'Ogre',
    ];
    for (const race of required) {
      expect(FUMBBL_REFERENCE.races[race]).toBeDefined();
    }
  });

  it('every race winrate sits in (0, 1)', () => {
    for (const stats of Object.values(FUMBBL_REFERENCE.races)) {
      expect(stats.winrate).toBeGreaterThan(0);
      expect(stats.winrate).toBeLessThan(1);
    }
  });

  it('every race casualty / TD / drive duration is non-negative and capped sanely', () => {
    for (const stats of Object.values(FUMBBL_REFERENCE.races)) {
      expect(stats.casualtyRate).toBeGreaterThanOrEqual(0);
      expect(stats.casualtyRate).toBeLessThanOrEqual(10);
      expect(stats.tdAverage).toBeGreaterThanOrEqual(0);
      expect(stats.tdAverage).toBeLessThanOrEqual(10);
      expect(stats.driveDurationTurns).toBeGreaterThanOrEqual(1);
      expect(stats.driveDurationTurns).toBeLessThanOrEqual(8);
    }
  });

  it('Halflings and Ogres have the expected weak-roster signature', () => {
    expect(FUMBBL_REFERENCE.races.Halfling.winrate).toBeLessThan(0.45);
    expect(FUMBBL_REFERENCE.races.Ogre.winrate).toBeLessThan(0.45);
  });

  it('Wood Elves and Dark Elves have above-average passing TDs', () => {
    expect(FUMBBL_REFERENCE.races['Wood Elf'].tdAverage).toBeGreaterThan(2);
    expect(FUMBBL_REFERENCE.races['Dark Elf'].tdAverage).toBeGreaterThan(2);
  });
});

describe('parseFumbblReference — Zod validation', () => {
  it('accepts the bundled snapshot', () => {
    expect(() => parseFumbblReference(FUMBBL_REFERENCE)).not.toThrow();
  });

  it('rejects a winrate outside [0, 1]', () => {
    const bad = {
      ...FUMBBL_REFERENCE,
      races: { Orc: { ...FUMBBL_REFERENCE.races.Orc, winrate: 1.5 } },
    };
    expect(() => parseFumbblReference(bad)).toThrow();
  });

  it('rejects unknown extra keys (strict schema)', () => {
    const bad = {
      ...FUMBBL_REFERENCE,
      races: { Orc: { ...FUMBBL_REFERENCE.races.Orc, foo: 'bar' } },
    };
    expect(() => parseFumbblReference(bad)).toThrow();
  });

  it('rejects negative casualty rate', () => {
    const bad = {
      ...FUMBBL_REFERENCE,
      races: { Orc: { ...FUMBBL_REFERENCE.races.Orc, casualtyRate: -0.1 } },
    };
    expect(() => parseFumbblReference(bad)).toThrow();
  });
});

describe('Lookup helpers', () => {
  it('getFumbblRaceStats returns stats for a known race', () => {
    expect(getFumbblRaceStats('Orc')?.winrate).toBeGreaterThan(0);
  });

  it('getFumbblRaceStats returns undefined for an unknown race', () => {
    expect(getFumbblRaceStats('Vampire Lord')).toBeUndefined();
  });

  it('getFumbblRaceStatsOrThrow throws on an unknown race', () => {
    expect(() => getFumbblRaceStatsOrThrow('Vampire Lord')).toThrow();
  });
});

describe('isWithinFumbblTolerance — CI regression gate (lot 0.D.4)', () => {
  it('default tolerance is 10% (sprint target)', () => {
    expect(FUMBBL_TOLERANCE).toBe(0.1);
  });

  it('returns true when observed is within ±10% of reference', () => {
    // Stay strictly inside 10% to avoid floating-point boundary drift.
    expect(isWithinFumbblTolerance(0.54, 0.5)).toBe(true);
    expect(isWithinFumbblTolerance(0.46, 0.5)).toBe(true);
  });

  it('returns false when deviation exceeds 10%', () => {
    expect(isWithinFumbblTolerance(0.56, 0.5)).toBe(false);
    expect(isWithinFumbblTolerance(0.44, 0.5)).toBe(false);
  });

  it('handles zero reference by requiring absolute deviation under tolerance', () => {
    expect(isWithinFumbblTolerance(0.05, 0)).toBe(true);
    expect(isWithinFumbblTolerance(0.5, 0)).toBe(false);
  });

  it('respects a custom tolerance argument', () => {
    expect(isWithinFumbblTolerance(0.65, 0.5, 0.5)).toBe(true);
    expect(isWithinFumbblTolerance(0.65, 0.5, 0.05)).toBe(false);
  });
});
