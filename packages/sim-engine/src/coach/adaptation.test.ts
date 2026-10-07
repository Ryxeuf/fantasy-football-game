import { describe, expect, it } from 'vitest';

import { makeRNG } from '@bb/game-engine';

import { PRO_LEAGUE_TEAM_BY_ID } from '../tactics/race-profiles';
import { DEFAULT_TACTICAL_PROFILE, TACTICAL_PROFILE_PARAMETERS, type TacticalProfile } from '../tactics/tactical-profile';

import {
  EMPTY_COACH_MEMORY,
  STRATEGY_INFLUENCE,
  adaptCoachProfile,
  driveReward,
  isWithinBand,
  updateCoachMemory,
  type CoachMemory,
  type DriveRecord,
} from './adaptation';
import type { CoachStrategyId } from './drive-plan';

function drive(overrides: Partial<DriveRecord> = {}): DriveRecord {
  return {
    team: 'A',
    half: 1,
    strategy: 'cage-build',
    possession: true,
    outcome: 'td',
    turnovers: 0,
    turns: 6,
    ...overrides,
  };
}

describe('driveReward', () => {
  it('récompense un TD, punit un TD encaissé, nuance une mi-temps sans score', () => {
    expect(driveReward(drive({ outcome: 'td' }))).toBe(1);
    expect(driveReward(drive({ outcome: 'conceded', possession: false }))).toBe(-1);
    expect(driveReward(drive({ outcome: 'half-end', possession: true }))).toBeCloseTo(-0.3);
    expect(driveReward(drive({ outcome: 'half-end', possession: false }))).toBeCloseTo(0.5);
  });

  it('retire 0,1 par turnover, plafonné à 0,4, et reste dans [−1, 1]', () => {
    expect(driveReward(drive({ outcome: 'td', turnovers: 2 }))).toBeCloseTo(0.8);
    expect(driveReward(drive({ outcome: 'td', turnovers: 9 }))).toBeCloseTo(0.6);
    expect(driveReward(drive({ outcome: 'conceded', turnovers: 9 }))).toBe(-1);
  });
});

describe('updateCoachMemory', () => {
  it('ouvre une entrée par stratégie et lisse par EMA', () => {
    const m1 = updateCoachMemory(EMPTY_COACH_MEMORY, [drive({ strategy: 'stall', outcome: 'td' })]);
    expect(m1.strategies.stall).toEqual({ ema: 1, samples: 1 });
    const m2 = updateCoachMemory(m1, [drive({ strategy: 'stall', outcome: 'conceded', possession: false })], 0.5);
    expect(m2.strategies.stall).toEqual({ ema: 0, samples: 2 });
    expect(EMPTY_COACH_MEMORY.strategies).toEqual({});
  });
});

describe('adaptCoachProfile', () => {
  const anchor = PRO_LEAGUE_TEAM_BY_ID['pit-smashers'].tactics;

  it('ne bouge pas sur une stratégie vue moins de minSamples fois, hormis le rappel vers l ancre', () => {
    const out = adaptCoachProfile({
      profile: anchor,
      anchor,
      memory: EMPTY_COACH_MEMORY,
      drives: [drive({ strategy: 'stall' })],
    });
    expect(out.changes).toEqual([]);
    expect(out.profile).toEqual(anchor);
    expect(out.memory.strategies.stall?.samples).toBe(1);
  });

  it('renforce les paramètres d une stratégie qui rapporte, avec une raison lisible', () => {
    const memory: CoachMemory = { strategies: { stall: { ema: 0.8, samples: 4 } } };
    const out = adaptCoachProfile({
      profile: anchor,
      anchor,
      memory,
      drives: [drive({ strategy: 'stall', outcome: 'td' })],
    });
    const stall = out.changes.find((c) => c.parameter === 'stallTendency');
    expect(stall).toBeDefined();
    expect(stall!.after).toBe(stall!.before + 2);
    expect(stall!.reason).toContain('« stall » rapporte sur 5 drives');
    expect(stall!.reason).toContain('stallTendency +2');
    const patience = out.changes.find((c) => c.parameter === 'patience');
    expect(patience?.after).toBe(patience!.before + 2);
  });

  it('relâche les paramètres d une stratégie qui coûte', () => {
    const memory: CoachMemory = { strategies: { breakaway: { ema: -0.9, samples: 5 } } };
    const out = adaptCoachProfile({
      profile: anchor,
      anchor,
      memory,
      drives: [drive({ strategy: 'breakaway', outcome: 'conceded' })],
    });
    const gfi = out.changes.find((c) => c.parameter === 'gfiTolerance');
    expect(gfi).toBeDefined();
    expect(gfi!.after).toBeLessThan(gfi!.before);
    expect(gfi!.reason).toContain('coûte');
  });

  it('rappelle vers l ancre un paramètre sans signal', () => {
    const profile: TacticalProfile = { ...anchor, bashIndex: anchor.bashIndex - 10 };
    const out = adaptCoachProfile({ profile, anchor, memory: EMPTY_COACH_MEMORY, drives: [] });
    const bash = out.changes.find((c) => c.parameter === 'bashIndex');
    expect(bash?.after).toBe(anchor.bashIndex - 9);
    expect(bash?.reason).toContain("rappel vers l'ancre");
    expect(out.changes).toHaveLength(1);
  });

  it('reste borné à ancre ± bande sur trois saisons simulées, quoi qu il arrive', () => {
    const rng = makeRNG('adaptation-3-seasons');
    const strategies = Object.keys(STRATEGY_INFLUENCE) as CoachStrategyId[];
    let profile = anchor;
    let memory = EMPTY_COACH_MEMORY;
    let totalChanges = 0;
    for (let match = 0; match < 3 * 17; match++) {
      const drives: DriveRecord[] = [];
      const n = 3 + Math.floor(rng() * 4);
      for (let i = 0; i < n; i++) {
        const outcome = rng() < 0.6 ? 'td' : rng() < 0.5 ? 'conceded' : 'half-end';
        drives.push(
          drive({
            strategy: strategies[Math.floor(rng() * strategies.length)],
            outcome,
            possession: rng() < 0.5,
            turnovers: Math.floor(rng() * 3),
          }),
        );
      }
      const out = adaptCoachProfile({ profile, anchor, memory, drives });
      profile = out.profile;
      memory = out.memory;
      totalChanges += out.changes.length;
      expect(isWithinBand(profile, anchor, 15)).toBe(true);
      for (const p of TACTICAL_PROFILE_PARAMETERS) {
        expect(Number.isInteger(profile[p])).toBe(true);
        expect(profile[p]).toBeGreaterThanOrEqual(0);
        expect(profile[p]).toBeLessThanOrEqual(100);
      }
      for (const c of out.changes) expect(c.reason.length).toBeGreaterThan(10);
    }
    expect(totalChanges).toBeGreaterThan(0);
    expect(isWithinBand({ ...anchor, pace: anchor.pace + 16 }, anchor, 15)).toBe(false);
  });

  it('respecte un pas, une bande et un rappel personnalisés', () => {
    const memory: CoachMemory = { strategies: { 'blitz-train': { ema: 1, samples: 10 } } };
    const out = adaptCoachProfile({
      profile: DEFAULT_TACTICAL_PROFILE,
      anchor: DEFAULT_TACTICAL_PROFILE,
      memory,
      drives: [drive({ strategy: 'blitz-train' })],
      options: { learningRate: 5, band: 3, recall: 0 },
    });
    expect(out.profile.blitzPriority).toBe(53);
    expect(out.profile.bashIndex).toBe(53);
    expect(out.changes.filter((c) => c.reason.includes('rappel'))).toEqual([]);
  });
});
