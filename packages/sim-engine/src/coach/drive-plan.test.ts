import { describe, expect, it } from 'vitest';

import { makeRNG } from '@bb/game-engine';
import { baseState, makePlayer } from './test-helpers';

import { DEFAULT_TACTICAL_PROFILE } from '../tactics/tactical-profile';
import { PRO_LEAGUE_TEAM_BY_ID } from '../tactics/race-profiles';

import { COACH_STRATEGIES, buildDriveContext, choosePlan, shouldReplan } from './drive-plan';

function stateWith(carrierTeam: 'A' | 'B' | null, x: number, turn = 1) {
  const a1 = makePlayer({ id: 'A1', team: 'A', pos: { x: carrierTeam === 'A' ? x : 3, y: 7 }, hasBall: carrierTeam === 'A' });
  const b1 = makePlayer({ id: 'B1', team: 'B', pos: { x: carrierTeam === 'B' ? x : 22, y: 7 }, hasBall: carrierTeam === 'B' });
  return baseState([a1, b1], { turn, ball: carrierTeam ? undefined : { x, y: 7 } });
}

describe('plan de drive (lot 3)', () => {
  it('le contexte lit possession, zone rouge et fin de mi-temps', () => {
    const ctx = buildDriveContext(stateWith('A', 22, 6), 'A');
    expect(ctx).toMatchObject({ hasPossession: true, inRedZone: true, pastMidfield: true, lateInHalf: true });
    expect(buildDriveContext(stateWith('A', 22, 6), 'B').hasPossession).toBe(false);
  });

  it('un ballon libre dans notre moitié fait de nous l’attaque', () => {
    expect(buildDriveContext(stateWith(null, 4), 'A').hasPossession).toBe(true);
    expect(buildDriveContext(stateWith(null, 4), 'B').hasPossession).toBe(false);
  });

  it('un coach de bash avec le ballon choisit la cage, sans le ballon un plan de défense', () => {
    const orc = PRO_LEAGUE_TEAM_BY_ID['pit-smashers'];
    if (!orc) throw new Error('profil');
    const counts = new Map<string, number>();
    for (let seed = 0; seed < 30; seed++) {
      const plan = choosePlan(stateWith('A', 8), 'A', orc.tactics, makeRNG(`plan:${seed}`));
      counts.set(plan.strategy, (counts.get(plan.strategy) ?? 0) + 1);
      expect(['cage-build', 'two-turn-score', 'safe-hold', 'breakaway', 'foul-fest']).toContain(plan.strategy);
    }
    expect((counts.get('cage-build') ?? 0)).toBeGreaterThan(10);
    const defence = choosePlan(stateWith('B', 8), 'A', orc.tactics, makeRNG('d'));
    expect(['defensive-screen', 'blitz-train', 'mark-receivers', 'foul-fest']).toContain(defence.strategy);
    expect(defence.context.hasPossession).toBe(false);
  });

  it('« stall » exige de mener (ou la fin de mi-temps sans être mené)', () => {
    const stall = COACH_STRATEGIES.find((s) => s.id === 'stall');
    if (!stall) throw new Error('stall');
    const base = buildDriveContext(stateWith('A', 10, 2), 'A');
    expect(stall.score(base, DEFAULT_TACTICAL_PROFILE)).toBe(0);
    expect(stall.score({ ...base, leading: true }, DEFAULT_TACTICAL_PROFILE)).toBeGreaterThan(0);
    expect(stall.score({ ...base, trailing: true, lateInHalf: true }, DEFAULT_TACTICAL_PROFILE)).toBe(0);
  });

  it('le plan colle : ré-évalué seulement sur changement de possession, de mi-temps ou de fin de mi-temps', () => {
    const plan = choosePlan(stateWith('A', 8), 'A', DEFAULT_TACTICAL_PROFILE, makeRNG('p'));
    expect(shouldReplan(plan, stateWith('A', 12), 'A')).toBe(false);
    expect(shouldReplan(plan, stateWith('B', 12), 'A')).toBe(true);
    expect(shouldReplan(plan, stateWith('A', 12, 7), 'A')).toBe(true);
    expect(shouldReplan(plan, { ...stateWith('A', 12), half: 2 }, 'A')).toBe(true);
  });

  it('le profil déforme le plan : rythme, plancher de risque, relance, agression', () => {
    const cautious = choosePlan(stateWith('A', 8), 'A', { ...DEFAULT_TACTICAL_PROFILE, cageAffinity: 100, riskAppetite: 0, rerollUsage: 0, foulFrequency: 0 }, makeRNG('c'));
    const bold = choosePlan(stateWith('A', 8), 'A', { ...DEFAULT_TACTICAL_PROFILE, cageAffinity: 100, riskAppetite: 100, rerollUsage: 100, foulFrequency: 100 }, makeRNG('b'));
    expect(cautious.riskFloor).toBeGreaterThan(bold.riskFloor);
    expect(cautious.rerollThreshold).toBeGreaterThan(bold.rerollThreshold);
    expect(cautious.foulAppetite).toBeLessThan(bold.foulAppetite);
  });
});
