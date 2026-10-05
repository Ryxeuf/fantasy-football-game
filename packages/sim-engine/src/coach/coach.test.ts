import { describe, expect, it } from 'vitest';

import { applyMove, getLegalMoves, makeRNG } from '@bb/game-engine';
import type { GameState, Move } from '@bb/game-engine';

import { DEFAULT_TACTICAL_PROFILE } from '../tactics/tactical-profile';

import { createCoach } from './coach';
import { baseState, makePlayer } from './test-helpers';

function sameMove(a: Move, b: Move): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function roster(team: 'A' | 'B', xs: number[]): ReturnType<typeof makePlayer>[] {
  return xs.map((x, i) => makePlayer({ id: `${team}${i + 1}`, team, pos: { x, y: 4 + i }, name: `${team}${i + 1}` }));
}

describe('coach (lot 3)', () => {
  it('ne rend que des coups légaux et finit son tour par END_TURN', () => {
    const a = roster('A', [8, 9, 8, 9, 8]);
    a[0] = { ...a[0], hasBall: true };
    const b = roster('B', [16, 17, 16, 17, 16]);
    let state: GameState = baseState([...a, ...b]);
    const coach = createCoach({ seed: 7, home: { profile: DEFAULT_TACTICAL_PROFILE }, away: {} });
    const rng = makeRNG('coach-test');
    let steps = 0;
    while (state.currentPlayer === 'A' && steps < 200) {
      const move = coach.nextMove(state);
      expect(move).not.toBeNull();
      const legal = getLegalMoves(state);
      expect(legal.some((m) => sameMove(m, move as Move))).toBe(true);
      const next = applyMove(state, move as Move, rng);
      coach.onApplied(state, move as Move, next);
      state = next;
      steps++;
    }
    expect(state.currentPlayer).toBe('B');
    expect(steps).toBeLessThan(200);
    expect(coach.planFor('A')?.context.hasPossession).toBe(true);
  });

  it('résout un choix en attente avant tout autre coup', () => {
    const a1 = makePlayer({ id: 'A1', team: 'A', pos: { x: 5, y: 7 } });
    const b1 = makePlayer({ id: 'B1', team: 'B', pos: { x: 6, y: 7 } });
    const state: GameState = {
      ...baseState([a1, b1]),
      pendingBlock: { attackerId: 'A1', targetId: 'B1', options: ['POW', 'PUSH_BACK'], chooser: 'attacker' } as GameState['pendingBlock'],
    };
    const coach = createCoach({ seed: 1, home: {}, away: {} });
    const move = coach.nextMove(state);
    expect(move?.type).toBe('BLOCK_CHOOSE');
    expect((move as { result?: string }).result).toBe('POW');
  });

  it('est déterministe pour une même graine', () => {
    const a = roster('A', [8, 9, 8, 9]);
    a[1] = { ...a[1], hasBall: true };
    const b = roster('B', [14, 15, 14, 15]);
    const state = baseState([...a, ...b]);
    const first = createCoach({ seed: 42, home: {}, away: {} }).nextMove(state);
    const second = createCoach({ seed: 42, home: {}, away: {} }).nextMove(state);
    expect(first).toEqual(second);
  });

  it('expose un instantané de momentum après un touchdown', () => {
    const carrier = makePlayer({ id: 'A1', team: 'A', pos: { x: 24, y: 7 }, hasBall: true });
    const state = baseState([carrier, makePlayer({ id: 'B1', team: 'B', pos: { x: 3, y: 3 } })]);
    const coach = createCoach({ seed: 3, home: {}, away: {} });
    const move = coach.nextMove(state) as Move;
    expect(move).toEqual({ type: 'MOVE', playerId: 'A1', to: { x: 25, y: expect.any(Number) } });
    const next = applyMove(state, move, makeRNG('td'));
    coach.onApplied(state, move, next);
    expect(next.score.teamA).toBe(1);
    expect(coach.momentumSnapshot().find((m) => m.playerId === 'A1')?.touchdowns).toBe(1);
  });
});

describe('coach — rapport de drives et forme (lot 4)', () => {
  it('le full driver rend un rapport : chaque équipe a des drives, un TD clôt un drive des deux côtés', async () => {
    const { simulateMatch } = await import('../simulate-match');
    const { PRO_LEAGUE_TEAM_BY_ID } = await import('../tactics/race-profiles');
    const { buildEngineSimInput } = await import('../driver/engine-roster-fixture');
    const input = buildEngineSimInput(PRO_LEAGUE_TEAM_BY_ID['pit-smashers'], PRO_LEAGUE_TEAM_BY_ID['kc-soaring-hawks'], 11);
    const result = simulateMatch(input, { driverKind: 'full' });
    const report = result.coachReport;
    expect(report).toBeDefined();
    const drives = report!.drives;
    expect(drives.some((d) => d.team === 'A')).toBe(true);
    expect(drives.some((d) => d.team === 'B')).toBe(true);
    const tds = result.summary.score.home + result.summary.score.away;
    expect(drives.filter((d) => d.outcome === 'td')).toHaveLength(tds);
    expect(drives.filter((d) => d.outcome === 'conceded')).toHaveLength(tds);
    for (const d of drives) {
      expect(d.turns).toBeGreaterThan(0);
      expect(d.turnovers).toBeGreaterThanOrEqual(0);
      expect([1, 2]).toContain(d.half);
    }
    expect(drives.filter((d) => d.half === 1).length).toBeGreaterThan(0);
    expect(drives.filter((d) => d.half === 2).length).toBeGreaterThan(0);
    // Le journal fige les profils des deux coachs.
    expect(result.journal?.profiles?.home).toEqual(PRO_LEAGUE_TEAM_BY_ID['pit-smashers'].tactics);
    expect(result.journal?.profiles?.away).toEqual(PRO_LEAGUE_TEAM_BY_ID['kc-soaring-hawks'].tactics);
  });

  it('formPenalty : la méforme recule les actions à dés, la forme les avance, le neutre ne change rien', async () => {
    const { formPenalty } = await import('./coach');
    expect(formPenalty(2, undefined)).toBe(0);
    expect(formPenalty(2, 50)).toBe(0);
    expect(formPenalty(0, 10)).toBe(0);
    expect(formPenalty(2, 10)).toBeGreaterThan(0);
    expect(formPenalty(2, 90)).toBeLessThan(0);
    expect(formPenalty(3, 10)).toBeGreaterThan(formPenalty(2, 10));
  });

  it('la forme change le match à graine constante, sans changer sa structure', async () => {
    const { simulateMatch } = await import('../simulate-match');
    const { PRO_LEAGUE_TEAM_BY_ID } = await import('../tactics/race-profiles');
    const { buildEngineSimInput } = await import('../driver/engine-roster-fixture');
    const base = buildEngineSimInput(PRO_LEAGUE_TEAM_BY_ID['pit-smashers'], PRO_LEAGUE_TEAM_BY_ID['kc-soaring-hawks'], 5);
    const cold = {
      ...base,
      home: { ...base.home, roster: base.home.roster!.map((p) => ({ ...p, form: 5 })) },
    };
    const a = simulateMatch(base, { driverKind: 'full' });
    const b = simulateMatch(cold, { driverKind: 'full' });
    expect(simulateMatch(cold, { driverKind: 'full' }).journal!.steps.length).toBe(b.journal!.steps.length);
    expect(a.journal!.steps.length).not.toBe(b.journal!.steps.length);
  });
});
