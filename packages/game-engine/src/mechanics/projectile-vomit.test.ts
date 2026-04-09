import { describe, it, expect } from 'vitest';
import { setup, applyMove, getLegalMoves } from '../index';
import { GameState, RNG } from '../core/types';
import {
  canProjectileVomit,
  executeProjectileVomit,
} from './projectile-vomit';

function makeTestRNG(values: number[]): RNG {
  let i = 0;
  return () => {
    const val = values[i % values.length];
    i++;
    return val;
  };
}

/**
 * Create a test state with a vomiter (projectile-vomit skill) and an opponent target.
 * Vomiter A1 (Rotspawn) at (10,7), opponent B1 at (11,7) adjacent.
 * Teammate A2 far away at (5,7).
 */
function createVomitTestState(): GameState {
  const state = setup();
  state.players = [
    {
      id: 'A1', team: 'A', pos: { x: 10, y: 7 }, name: 'Rotspawn', number: 1,
      position: 'Rotspawn', ma: 4, st: 5, ag: 5, pa: 6, av: 9,
      skills: ['projectile-vomit', 'mighty-blow'],
      pm: 4, hasBall: false, state: 'active',
    },
    {
      id: 'A2', team: 'A', pos: { x: 5, y: 7 }, name: 'Rotter', number: 2,
      position: 'Rotter', ma: 5, st: 3, ag: 4, pa: 6, av: 8,
      skills: [],
      pm: 5, hasBall: false, state: 'active',
    },
    {
      id: 'B1', team: 'B', pos: { x: 11, y: 7 }, name: 'Human Lineman', number: 1,
      position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: [],
      pm: 6, hasBall: false, state: 'active',
    },
    {
      id: 'B2', team: 'B', pos: { x: 20, y: 7 }, name: 'Human Blitzer', number: 2,
      position: 'Blitzer', ma: 7, st: 3, ag: 3, pa: 4, av: 9, skills: [],
      pm: 7, hasBall: false, state: 'active',
    },
  ];
  state.ball = { x: 5, y: 7 };
  state.currentPlayer = 'A';
  state.playerActions = {};
  state.teamBlitzCount = {};
  state.teamFoulCount = {};
  state.teamRerolls = { teamA: 3, teamB: 3 };
  return state;
}

describe('Regle: Projectile Vomit', () => {
  describe('canProjectileVomit', () => {
    it('allows vomit when player has projectile-vomit skill and target is adjacent standing opponent', () => {
      const state = createVomitTestState();
      const vomiter = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      expect(canProjectileVomit(state, vomiter, target)).toBe(true);
    });

    it('rejects vomit when player does not have projectile-vomit skill', () => {
      const state = createVomitTestState();
      state.players = state.players.map(p =>
        p.id === 'A1' ? { ...p, skills: [] } : p
      );
      const vomiter = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      expect(canProjectileVomit(state, vomiter, target)).toBe(false);
    });

    it('rejects vomit when target is not adjacent', () => {
      const state = createVomitTestState();
      const vomiter = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B2')!; // B2 at (20,7), far away
      expect(canProjectileVomit(state, vomiter, target)).toBe(false);
    });

    it('rejects vomit when target is a teammate', () => {
      const state = createVomitTestState();
      state.players = state.players.map(p =>
        p.id === 'A2' ? { ...p, pos: { x: 9, y: 7 } } : p
      );
      const vomiter = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'A2')!;
      expect(canProjectileVomit(state, vomiter, target)).toBe(false);
    });

    it('rejects vomit when target is stunned', () => {
      const state = createVomitTestState();
      state.players = state.players.map(p =>
        p.id === 'B1' ? { ...p, stunned: true } : p
      );
      const vomiter = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      expect(canProjectileVomit(state, vomiter, target)).toBe(false);
    });

    it('rejects vomit when target is not active (e.g. knocked out)', () => {
      const state = createVomitTestState();
      state.players = state.players.map(p =>
        p.id === 'B1' ? { ...p, state: 'knocked_out' as const } : p
      );
      const vomiter = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      expect(canProjectileVomit(state, vomiter, target)).toBe(false);
    });
  });

  describe('executeProjectileVomit', () => {
    it('knocks down target on successful roll (roll >= 2)', () => {
      const state = createVomitTestState();
      const vomiter = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      // RNG value for roll of 2 on D6: value in [1/6, 2/6) → 0.17
      // Then armor roll (2D6): we need high rolls so armor holds → 0.0 + 0.0 = roll 2, armor 9 → holds
      const rng = makeTestRNG([0.17, 0.0, 0.0]);
      const result = executeProjectileVomit(state, vomiter, target, rng);
      // Target should be knocked down (stunned at minimum)
      const resultTarget = result.players.find(p => p.id === 'B1')!;
      expect(resultTarget.stunned).toBe(true);
    });

    it('fails on natural 1 (always misses)', () => {
      const state = createVomitTestState();
      const vomiter = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      // RNG value for roll of 1 on D6: value in [0, 1/6) → 0.0
      const rng = makeTestRNG([0.0]);
      const result = executeProjectileVomit(state, vomiter, target, rng);
      // Target should NOT be knocked down
      const resultTarget = result.players.find(p => p.id === 'B1')!;
      expect(resultTarget.stunned).toBeUndefined();
    });

    it('ends vomiter activation on failure (pm set to 0)', () => {
      const state = createVomitTestState();
      const vomiter = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      const rng = makeTestRNG([0.0]); // natural 1 → fail
      const result = executeProjectileVomit(state, vomiter, target, rng);
      const resultVomiter = result.players.find(p => p.id === 'A1')!;
      expect(resultVomiter.pm).toBe(0);
    });

    it('does NOT cause turnover on failure', () => {
      const state = createVomitTestState();
      const vomiter = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      const rng = makeTestRNG([0.0]); // natural 1 → fail
      const result = executeProjectileVomit(state, vomiter, target, rng);
      expect(result.isTurnover).toBe(false);
    });

    it('adds log entries for the vomit action', () => {
      const state = createVomitTestState();
      const vomiter = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      const rng = makeTestRNG([0.84]); // roll 6 → success, then armor rolls
      const initialLogLength = state.gameLog.length;
      const result = executeProjectileVomit(state, vomiter, target, rng);
      expect(result.gameLog.length).toBeGreaterThan(initialLogLength);
    });

    it('records dice result in lastDiceResult', () => {
      const state = createVomitTestState();
      const vomiter = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      const rng = makeTestRNG([0.0]); // roll 1 → fail
      const result = executeProjectileVomit(state, vomiter, target, rng);
      expect(result.lastDiceResult).toBeDefined();
      expect(result.lastDiceResult!.type).toBe('vomit');
      expect(result.lastDiceResult!.playerId).toBe('A1');
    });

    it('performs armor roll when vomit succeeds', () => {
      const state = createVomitTestState();
      const vomiter = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      // Roll 6 for vomit (success), then armor roll 2D6
      // Low armor rolls (2) vs AV 9 → armor holds → stunned only
      const rng = makeTestRNG([0.84, 0.0, 0.0]);
      const result = executeProjectileVomit(state, vomiter, target, rng);
      const resultTarget = result.players.find(p => p.id === 'B1')!;
      expect(resultTarget.stunned).toBe(true);
    });

    it('performs injury roll when armor is broken', () => {
      const state = createVomitTestState();
      // Use a target with low armor (AV 7) so armor breaks easily
      state.players = state.players.map(p =>
        p.id === 'B1' ? { ...p, av: 7 } : p
      );
      const vomiter = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      // Roll 6 for vomit (success)
      // Armor roll: need 2D6 >= 7 (AV with mighty blow -1 = 6).
      // RNG 0.84 → roll 6, 0.84 → roll 6: total 12 >= 6 → armor broken
      // Injury roll: 2D6 with low rolls → stunned (2-7)
      const rng = makeTestRNG([0.84, 0.84, 0.84, 0.0, 0.0]);
      const result = executeProjectileVomit(state, vomiter, target, rng);
      // With armor broken, injury roll happens → check logs for injury
      const injuryLogs = result.gameLog.filter(l => l.message.includes('blessure'));
      expect(injuryLogs.length).toBeGreaterThan(0);
    });

    it('bounces ball if knocked down target had the ball', () => {
      const state = createVomitTestState();
      // Give ball to B1
      state.players = state.players.map(p =>
        p.id === 'B1' ? { ...p, hasBall: true } : p
      );
      state.ball = { x: 11, y: 7 }; // B1's position
      const vomiter = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      // Roll 6 for vomit (success), armor holds (low rolls)
      const rng = makeTestRNG([0.84, 0.0, 0.0, 0.5]);
      const result = executeProjectileVomit(state, vomiter, target, rng);
      // Ball should have bounced or target lost it
      const resultTarget = result.players.find(p => p.id === 'B1')!;
      expect(resultTarget.hasBall).toBeFalsy();
    });
  });

  describe('Integration: getLegalMoves', () => {
    it('generates PROJECTILE_VOMIT moves for players with the skill', () => {
      const state = createVomitTestState();
      const moves = getLegalMoves(state);
      const vomitMoves = moves.filter(m => m.type === 'PROJECTILE_VOMIT');
      expect(vomitMoves.length).toBeGreaterThan(0);
      const firstVomit = vomitMoves[0] as { type: 'PROJECTILE_VOMIT'; playerId: string; targetId: string };
      expect(firstVomit.playerId).toBe('A1');
      expect(firstVomit.targetId).toBe('B1');
    });

    it('does not generate PROJECTILE_VOMIT moves if player has already acted', () => {
      const state = createVomitTestState();
      state.playerActions = { A1: 'PROJECTILE_VOMIT' };
      const moves = getLegalMoves(state);
      const vomitMoves = moves.filter(m => m.type === 'PROJECTILE_VOMIT');
      expect(vomitMoves.length).toBe(0);
    });

    it('does not generate PROJECTILE_VOMIT for non-adjacent opponents', () => {
      const state = createVomitTestState();
      const moves = getLegalMoves(state);
      const vomitMoves = moves.filter(
        m => m.type === 'PROJECTILE_VOMIT' && (m as { targetId: string }).targetId === 'B2'
      );
      expect(vomitMoves.length).toBe(0);
    });
  });

  describe('Integration: applyMove', () => {
    it('applies PROJECTILE_VOMIT move and knocks down target on success', () => {
      const state = createVomitTestState();
      // Roll 6 → success, then low armor rolls → stunned
      const rng = makeTestRNG([0.84, 0.0, 0.0]);
      const result = applyMove(state, { type: 'PROJECTILE_VOMIT', playerId: 'A1', targetId: 'B1' }, rng);
      const resultTarget = result.players.find(p => p.id === 'B1')!;
      expect(resultTarget.stunned).toBe(true);
    });

    it('sets player action to PROJECTILE_VOMIT after applying move', () => {
      const state = createVomitTestState();
      const rng = makeTestRNG([0.84, 0.0, 0.0]);
      const result = applyMove(state, { type: 'PROJECTILE_VOMIT', playerId: 'A1', targetId: 'B1' }, rng);
      expect(result.playerActions['A1']).toBe('PROJECTILE_VOMIT');
    });
  });
});
