import { describe, expect, it } from 'vitest';

import {
  DEFAULT_TACTICAL_PROFILE,
  TACTICAL_PROFILE_PARAMETERS,
  parseTacticalProfile,
  safeParseTacticalProfile,
  tacticalProfileSchema,
  type TacticalProfile,
} from './tactical-profile';

describe('TacticalProfile schema — sprint Pro League 0.B.2', () => {
  it('declares the 15 parameters listed in the sprint table', () => {
    const declared = new Set(TACTICAL_PROFILE_PARAMETERS);
    for (const required of [
      'bashIndex',
      'passingFrequency',
      'riskAppetite',
      'cageAffinity',
      'blitzPriority',
      'rerollUsage',
      'pace',
      'foulFrequency',
      'stallTendency',
      'kickReturn',
      'screenAffinity',
      'breakawayInstinct',
      'pressingDefense',
      'patience',
      'gfiTolerance',
    ] as const) {
      expect(declared).toContain(required);
    }
    // Sanity bounds : at least 15 (sprint says ~15) ; cap to keep schema lean.
    expect(declared.size).toBeGreaterThanOrEqual(15);
    expect(declared.size).toBeLessThanOrEqual(20);
  });

  it('every parameter sits in the [0, 100] range in the default profile', () => {
    for (const key of TACTICAL_PROFILE_PARAMETERS) {
      const v = DEFAULT_TACTICAL_PROFILE[key];
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('default profile is a valid input (round-trip)', () => {
    const parsed = parseTacticalProfile(DEFAULT_TACTICAL_PROFILE);
    expect(parsed).toEqual(DEFAULT_TACTICAL_PROFILE);
  });

  it('accepts a partial profile and fills missing keys with defaults', () => {
    const partial = { bashIndex: 85, passingFrequency: 20 };
    const parsed = parseTacticalProfile(partial);
    expect(parsed.bashIndex).toBe(85);
    expect(parsed.passingFrequency).toBe(20);
    // Untouched parameters fall back to default.
    expect(parsed.riskAppetite).toBe(DEFAULT_TACTICAL_PROFILE.riskAppetite);
  });

  it('rejects out-of-range values', () => {
    expect(() => parseTacticalProfile({ bashIndex: 150 })).toThrow();
    expect(() => parseTacticalProfile({ passingFrequency: -1 })).toThrow();
  });

  it('rejects non-integer values', () => {
    expect(() => parseTacticalProfile({ bashIndex: 50.5 })).toThrow();
  });

  it('rejects unknown extra keys (strict schema)', () => {
    expect(() => parseTacticalProfile({ bashIndex: 50, foo: 'bar' })).toThrow();
  });

  it('rejects null, primitives, and arrays', () => {
    expect(() => parseTacticalProfile(null as unknown as object)).toThrow();
    expect(() => parseTacticalProfile('not an object' as unknown as object)).toThrow();
    expect(() => parseTacticalProfile([1, 2, 3] as unknown as object)).toThrow();
  });

  it('safeParseTacticalProfile returns success/error envelope without throwing', () => {
    const ok = safeParseTacticalProfile({ bashIndex: 80 });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.bashIndex).toBe(80);
    }

    const ko = safeParseTacticalProfile({ bashIndex: 999 });
    expect(ko.success).toBe(false);
    if (!ko.success) {
      expect(ko.error).toBeDefined();
    }
  });

  it('Zod schema is exported for downstream apps/server validation', () => {
    expect(tacticalProfileSchema).toBeDefined();
    // Type-level check: extracted from the schema.
    const parsed: TacticalProfile = parseTacticalProfile({});
    expect(parsed).toEqual(DEFAULT_TACTICAL_PROFILE);
  });

  it('the schema is JSON-serialisable round-trip (storage on ProTeam.tactics)', () => {
    const orig = parseTacticalProfile({ bashIndex: 85, passingFrequency: 20, foulFrequency: 70 });
    const json = JSON.stringify(orig);
    const restored = parseTacticalProfile(JSON.parse(json));
    expect(restored).toEqual(orig);
  });
});
