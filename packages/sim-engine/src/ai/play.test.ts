import { describe, expect, it } from 'vitest';

import { createRng } from '../rng/seeded';
import {
  DEFAULT_TACTICAL_PROFILE,
  parseTacticalProfile,
} from '../tactics/tactical-profile';

import {
  STRATEGIES,
  PATTERNS,
  aiPlay,
  chooseStrategy,
  evaluateSituation,
  type DriveSnapshot,
} from './index';

const baseSnap = (overrides: Partial<DriveSnapshot> = {}): DriveSnapshot => ({
  hasPossession: true,
  ballYardline: 12,
  turn: 3,
  half: 1,
  scoreSelf: 0,
  scoreOpp: 0,
  ...overrides,
});

describe('Behavior tree catalogue — sprint Pro League 0.B.1', () => {
  it('declares the 6 strategies named in the sprint table', () => {
    const ids = STRATEGIES.map((s) => s.id);
    expect(ids).toEqual([
      'cage-build',
      'breakaway',
      'defensive-screen',
      'blitz-train',
      'stall',
      'foul-fest',
    ]);
  });

  it('declares the 5 patterns named in the sprint table', () => {
    const ids = PATTERNS.map((p) => p.id);
    expect(ids).toEqual([
      'cage-formation',
      'line-grind',
      'pass-route-deep',
      'wedge',
      'screen',
    ]);
  });

  it('every strategy declares at least one pattern', () => {
    for (const s of STRATEGIES) {
      expect(s.patterns.length).toBeGreaterThan(0);
    }
  });

  it('every pattern declares at least one moment weight', () => {
    for (const p of PATTERNS) {
      expect(Object.keys(p.weights).length).toBeGreaterThan(0);
    }
  });
});

describe('evaluateSituation — Pass 1', () => {
  it('flags red-zone when ballYardline >= 22 (FIELD_YARDS - 4)', () => {
    expect(evaluateSituation(baseSnap({ ballYardline: 22 })).inRedZone).toBe(true);
    expect(evaluateSituation(baseSnap({ ballYardline: 21 })).inRedZone).toBe(false);
  });

  it('flags pastMidfield when yardline >= 13', () => {
    expect(evaluateSituation(baseSnap({ ballYardline: 13 })).pastMidfield).toBe(true);
    expect(evaluateSituation(baseSnap({ ballYardline: 12 })).pastMidfield).toBe(false);
  });

  it('flags lateInHalf when turn >= 6', () => {
    expect(evaluateSituation(baseSnap({ turn: 6 })).lateInHalf).toBe(true);
    expect(evaluateSituation(baseSnap({ turn: 5 })).lateInHalf).toBe(false);
  });

  it('flags leading / trailing on score', () => {
    expect(evaluateSituation(baseSnap({ scoreSelf: 1, scoreOpp: 0 })).leading).toBe(true);
    expect(evaluateSituation(baseSnap({ scoreSelf: 0, scoreOpp: 1 })).trailing).toBe(true);
    expect(evaluateSituation(baseSnap({})).leading).toBe(false);
  });
});

describe('chooseStrategy — Pass 2', () => {
  it('picks foul-fest preferentially for high foulFrequency profiles', () => {
    const profile = parseTacticalProfile({ foulFrequency: 95, riskAppetite: 0 });
    const rng = createRng(1);
    const ctx = evaluateSituation(baseSnap());
    expect(chooseStrategy(rng, ctx, profile)).toBe('foul-fest');
  });

  it('picks breakaway for high breakawayInstinct + trailing late-game', () => {
    const profile = parseTacticalProfile({
      breakawayInstinct: 95,
      passingFrequency: 90,
      riskAppetite: 0,
    });
    const ctx = evaluateSituation(baseSnap({ scoreSelf: 0, scoreOpp: 1, turn: 7 }));
    const rng = createRng(1);
    expect(chooseStrategy(rng, ctx, profile)).toBe('breakaway');
  });

  it('picks defensive-screen when team has no possession and high screenAffinity', () => {
    const profile = parseTacticalProfile({ screenAffinity: 95, riskAppetite: 0 });
    const ctx = evaluateSituation(baseSnap({ hasPossession: false }));
    const rng = createRng(1);
    expect(chooseStrategy(rng, ctx, profile)).toBe('defensive-screen');
  });

  it('picks stall for late-half + leading + high stallTendency', () => {
    const profile = parseTacticalProfile({ stallTendency: 90, riskAppetite: 0 });
    const ctx = evaluateSituation(baseSnap({ turn: 7, scoreSelf: 1, scoreOpp: 0 }));
    const rng = createRng(1);
    expect(chooseStrategy(rng, ctx, profile)).toBe('stall');
  });

  it('determinism : same seed + same input produces same strategy', () => {
    const profile = DEFAULT_TACTICAL_PROFILE;
    const ctx = evaluateSituation(baseSnap());
    const a = chooseStrategy(createRng(99), ctx, profile);
    const b = chooseStrategy(createRng(99), ctx, profile);
    expect(b).toBe(a);
  });
});

describe('aiPlay — full 3-pass orchestration', () => {
  it('returns a strategy / pattern / moment triple for any seed', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const out = aiPlay(createRng(seed), baseSnap(), DEFAULT_TACTICAL_PROFILE);
      expect(out.strategy).toBeDefined();
      expect(out.pattern).toBeDefined();
      // moment may be `null` (skip / yards-only turn) which is valid.
    }
  });

  it('determinism : same seed + same input reproduces the triple', () => {
    const a = aiPlay(createRng(123), baseSnap(), DEFAULT_TACTICAL_PROFILE);
    const b = aiPlay(createRng(123), baseSnap(), DEFAULT_TACTICAL_PROFILE);
    expect(b).toEqual(a);
  });

  it('cage-build profile (high bash + cageAffinity) lands on a cage-friendly pattern', () => {
    const profile = parseTacticalProfile({
      bashIndex: 90,
      cageAffinity: 90,
      riskAppetite: 0,
      foulFrequency: 0,
      stallTendency: 0,
      breakawayInstinct: 0,
      passingFrequency: 0,
    });
    let cageHits = 0;
    for (let seed = 0; seed < 30; seed += 1) {
      const out = aiPlay(createRng(seed), baseSnap(), profile);
      if (out.strategy === 'cage-build') cageHits += 1;
    }
    // With T=0 (riskAppetite=0) the choice is deterministic per seed but
    // sensitive to seed because some seeds put us not-in-possession ;
    // we run with possession ON so the cage-build strategy should win
    // every seed.
    expect(cageHits).toBeGreaterThanOrEqual(25);
  });

  it('high foulFrequency profile produces fouls more often than a low-foul profile', () => {
    const foulers = parseTacticalProfile({
      foulFrequency: 100,
      bashIndex: 80,
      riskAppetite: 100,
    });
    const passers = parseTacticalProfile({
      foulFrequency: 0,
      bashIndex: 30,
      passingFrequency: 95,
      breakawayInstinct: 90,
      riskAppetite: 100,
    });
    let foulHits = 0;
    let passerFouls = 0;
    for (let seed = 0; seed < 200; seed += 1) {
      const a = aiPlay(createRng(seed), baseSnap(), foulers);
      const b = aiPlay(createRng(seed + 5000), baseSnap(), passers);
      if (a.moment === 'foul') foulHits += 1;
      if (b.moment === 'foul') passerFouls += 1;
    }
    expect(foulHits).toBeGreaterThan(passerFouls);
  });
});
