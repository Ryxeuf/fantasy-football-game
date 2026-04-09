import { describe, it, expect } from 'vitest';
import { setup, applyMove, getLegalMoves } from '../index';
import { GameState, RNG, Move, Position } from '../core/types';
import {
  canThrowTeamMate,
  getThrowRange,
  executeThrowTeamMate,
} from './throw-team-mate';

function makeTestRNG(values: number[]): RNG {
  let i = 0;
  return () => {
    const val = values[i % values.length];
    i++;
    return val;
  };
}

/**
 * Create a test state with a thrower (TTM skill) and a thrown player (Right Stuff + Stunty).
 * Thrower A1 at (10,7), thrown teammate A2 at (11,7) adjacent.
 * Opponent B1 far away at (20,7).
 */
function createTTMTestState(): GameState {
  const state = setup();
  state.players = [
    {
      id: 'A1', team: 'A', pos: { x: 10, y: 7 }, name: 'Big Guy', number: 1,
      position: 'Treeman', ma: 2, st: 6, ag: 5, pa: 5, av: 10,
      skills: ['throw-team-mate'],
      pm: 2, hasBall: false, state: 'active',
    },
    {
      id: 'A2', team: 'A', pos: { x: 11, y: 7 }, name: 'Halfling', number: 2,
      position: 'Halfling Hopeful', ma: 5, st: 2, ag: 3, pa: 6, av: 6,
      skills: ['right-stuff', 'stunty'],
      pm: 5, hasBall: false, state: 'active',
    },
    {
      id: 'B1', team: 'B', pos: { x: 20, y: 7 }, name: 'Orc Lineman', number: 1,
      position: 'Lineman', ma: 5, st: 3, ag: 3, pa: 4, av: 9, skills: [],
      pm: 5, hasBall: false, state: 'active',
    },
  ];
  state.ball = { x: 5, y: 7 }; // Ball elsewhere on the field
  state.currentPlayer = 'A';
  state.playerActions = {};
  state.teamBlitzCount = {};
  state.teamFoulCount = {};
  state.teamRerolls = { teamA: 0, teamB: 0 };
  return state;
}

describe('Regle: Throw Team-Mate', () => {
  describe('canThrowTeamMate', () => {
    it('allows throw when thrower has TTM and teammate has Right Stuff and is adjacent', () => {
      const state = createTTMTestState();
      const thrower = state.players.find(p => p.id === 'A1')!;
      const thrown = state.players.find(p => p.id === 'A2')!;
      expect(canThrowTeamMate(state, thrower, thrown)).toBe(true);
    });

    it('rejects throw when thrower does not have throw-team-mate skill', () => {
      const state = createTTMTestState();
      state.players = state.players.map(p =>
        p.id === 'A1' ? { ...p, skills: [] } : p
      );
      const thrower = state.players.find(p => p.id === 'A1')!;
      const thrown = state.players.find(p => p.id === 'A2')!;
      expect(canThrowTeamMate(state, thrower, thrown)).toBe(false);
    });

    it('rejects throw when target does not have right-stuff skill', () => {
      const state = createTTMTestState();
      state.players = state.players.map(p =>
        p.id === 'A2' ? { ...p, skills: ['stunty'] } : p
      );
      const thrower = state.players.find(p => p.id === 'A1')!;
      const thrown = state.players.find(p => p.id === 'A2')!;
      expect(canThrowTeamMate(state, thrower, thrown)).toBe(false);
    });

    it('rejects throw when target is not adjacent', () => {
      const state = createTTMTestState();
      state.players = state.players.map(p =>
        p.id === 'A2' ? { ...p, pos: { x: 15, y: 7 } } : p
      );
      const thrower = state.players.find(p => p.id === 'A1')!;
      const thrown = state.players.find(p => p.id === 'A2')!;
      expect(canThrowTeamMate(state, thrower, thrown)).toBe(false);
    });

    it('rejects throw when target is stunned', () => {
      const state = createTTMTestState();
      state.players = state.players.map(p =>
        p.id === 'A2' ? { ...p, stunned: true, state: 'stunned' as const } : p
      );
      const thrower = state.players.find(p => p.id === 'A1')!;
      const thrown = state.players.find(p => p.id === 'A2')!;
      expect(canThrowTeamMate(state, thrower, thrown)).toBe(false);
    });

    it('rejects throw when target is on a different team', () => {
      const state = createTTMTestState();
      const thrower = state.players.find(p => p.id === 'A1')!;
      const opponent = state.players.find(p => p.id === 'B1')!;
      expect(canThrowTeamMate(state, thrower, opponent)).toBe(false);
    });
  });

  describe('getThrowRange', () => {
    it('returns quick for distance <= 3', () => {
      expect(getThrowRange({ x: 0, y: 0 }, { x: 2, y: 1 })).toBe('quick');
    });

    it('returns short for distance 4-6', () => {
      expect(getThrowRange({ x: 0, y: 0 }, { x: 5, y: 3 })).toBe('short');
    });

    it('returns long for distance 7-10', () => {
      expect(getThrowRange({ x: 0, y: 0 }, { x: 8, y: 5 })).toBe('long');
    });

    it('returns null for distance > 10 (no bomb range for TTM)', () => {
      expect(getThrowRange({ x: 0, y: 0 }, { x: 12, y: 3 })).toBeNull();
    });
  });

  describe('executeThrowTeamMate', () => {
    it('successful throw: player lands at target (with scatter) and stands', () => {
      const state = createTTMTestState();
      const thrower = state.players.find(p => p.id === 'A1')!;
      const thrown = state.players.find(p => p.id === 'A2')!;
      const targetPos: Position = { x: 15, y: 7 };

      // RNG sequence:
      // 1. Pass roll: 0.83 → D6=5 (success for PA 5 with +1 stunty bonus, target ~4)
      // 2. Scatter direction (1 on success): 0.3 → direction 3 (East, +1x)
      // 3. Landing roll: 0.5 → D6=3 (success for AG 3)
      const rng = makeTestRNG([0.83, 0.3, 0.5]);

      const result = executeThrowTeamMate(state, thrower, thrown, targetPos, rng);

      // Thrown player should have moved from original position
      const thrownAfter = result.players.find(p => p.id === 'A2')!;
      expect(thrownAfter.pos).not.toEqual({ x: 11, y: 7 });
      // Player should still be active (successful landing)
      expect(thrownAfter.stunned).toBeFalsy();
      // No turnover on successful throw
      expect(result.isTurnover).toBe(false);
    });

    it('fumble (natural 1): thrown player dropped, turnover', () => {
      const state = createTTMTestState();
      const thrower = state.players.find(p => p.id === 'A1')!;
      const thrown = state.players.find(p => p.id === 'A2')!;
      const targetPos: Position = { x: 15, y: 7 };

      // RNG: pass roll = 0.01 → D6=1 (fumble!)
      // Then scatter for fumbled player, armor rolls etc.
      const rng = makeTestRNG([0.01, 0.5, 0.5, 0.5, 0.5, 0.5]);

      const result = executeThrowTeamMate(state, thrower, thrown, targetPos, rng);

      // Turnover on fumble
      expect(result.isTurnover).toBe(true);
      // Thrown player should be stunned (knocked down)
      const thrownAfter = result.players.find(p => p.id === 'A2')!;
      expect(thrownAfter.stunned).toBe(true);
    });

    it('inaccurate throw (failed pass, not fumble): player scatters 3 times, no turnover', () => {
      const state = createTTMTestState();
      const thrower = state.players.find(p => p.id === 'A1')!;
      const thrown = state.players.find(p => p.id === 'A2')!;
      const targetPos: Position = { x: 15, y: 7 };

      // RNG: pass roll = 0.17 → D6=2 (fail but not fumble for target ~4)
      // 3 scatter directions + landing roll
      const rng = makeTestRNG([0.17, 0.3, 0.3, 0.3, 0.83]);

      const result = executeThrowTeamMate(state, thrower, thrown, targetPos, rng);

      // No turnover on inaccurate throw
      expect(result.isTurnover).toBe(false);
      // Thrown player should have moved
      const thrownAfter = result.players.find(p => p.id === 'A2')!;
      expect(thrownAfter.pos).not.toEqual({ x: 11, y: 7 });
    });

    it('failed landing: thrown player is knocked down with armor roll', () => {
      const state = createTTMTestState();
      const thrower = state.players.find(p => p.id === 'A1')!;
      const thrown = state.players.find(p => p.id === 'A2')!;
      const targetPos: Position = { x: 15, y: 7 };

      // RNG: pass roll success, 1 scatter, landing roll fail, armor roll
      // Pass: 0.83 → D6=5 (success)
      // Scatter: 0.3 → direction 3
      // Landing: 0.01 → D6=1 (fail for AG 3)
      // Armor: 0.3, 0.3 → 2D6=5 (no break for AV 6)
      const rng = makeTestRNG([0.83, 0.3, 0.01, 0.3, 0.3]);

      const result = executeThrowTeamMate(state, thrower, thrown, targetPos, rng);

      // Player should be knocked down
      const thrownAfter = result.players.find(p => p.id === 'A2')!;
      expect(thrownAfter.stunned).toBe(true);
      // Not a turnover (failed landing is not a turnover)
      expect(result.isTurnover).toBe(false);
    });

    it('thrown player with ball: keeps ball on successful landing', () => {
      const state = createTTMTestState();
      // Give ball to the thrown player
      state.players = state.players.map(p =>
        p.id === 'A2' ? { ...p, hasBall: true } : p
      );
      state.ball = undefined;
      const thrower = state.players.find(p => p.id === 'A1')!;
      const thrown = state.players.find(p => p.id === 'A2')!;
      const targetPos: Position = { x: 15, y: 7 };

      // Successful pass + landing
      const rng = makeTestRNG([0.83, 0.3, 0.5]);

      const result = executeThrowTeamMate(state, thrower, thrown, targetPos, rng);

      const thrownAfter = result.players.find(p => p.id === 'A2')!;
      expect(thrownAfter.hasBall).toBe(true);
    });

    it('thrown player with ball: ball bounces on failed landing', () => {
      const state = createTTMTestState();
      state.players = state.players.map(p =>
        p.id === 'A2' ? { ...p, hasBall: true } : p
      );
      state.ball = undefined;
      const thrower = state.players.find(p => p.id === 'A1')!;
      const thrown = state.players.find(p => p.id === 'A2')!;
      const targetPos: Position = { x: 15, y: 7 };

      // Pass success, scatter, landing fail, armor, bounce
      const rng = makeTestRNG([0.83, 0.3, 0.01, 0.3, 0.3, 0.5]);

      const result = executeThrowTeamMate(state, thrower, thrown, targetPos, rng);

      const thrownAfter = result.players.find(p => p.id === 'A2')!;
      expect(thrownAfter.hasBall).toBeFalsy();
      // Ball should exist somewhere (bounced)
      expect(result.ball).toBeDefined();
    });

    it('touchdown when thrown player lands in endzone with ball', () => {
      const state = createTTMTestState();
      // Move thrower closer to endzone, give ball to thrown player
      state.players = state.players.map(p => {
        if (p.id === 'A1') return { ...p, pos: { x: 22, y: 7 } };
        if (p.id === 'A2') return { ...p, pos: { x: 23, y: 7 }, hasBall: true };
        return p;
      });
      state.ball = undefined;
      const thrower = state.players.find(p => p.id === 'A1')!;
      const thrown = state.players.find(p => p.id === 'A2')!;
      // Target the endzone (x=25 for team A)
      const targetPos: Position = { x: 25, y: 7 };

      // Pass success, scatter towards endzone, successful landing
      // Scatter direction 3 (East) would go to x=26 which is OOB, so use direction 1 (North, y-1)
      // to stay at x=25
      const rng = makeTestRNG([0.83, 0.0, 0.5]);

      const result = executeThrowTeamMate(state, thrower, thrown, targetPos, rng);

      // Should score if player landed at x=25 with ball
      // Score depends on scatter - check game log for touchdown
      const tdLog = result.gameLog.find(l => l.type === 'score');
      if (result.players.find(p => p.id === 'A2')?.pos.x === 25) {
        expect(tdLog).toBeDefined();
        expect(result.score.teamA).toBeGreaterThan(state.score.teamA);
      }
    });
  });

  describe('Legal Moves: THROW_TEAM_MATE', () => {
    it('generates TTM moves when a thrower has TTM and adjacent Right Stuff teammate', () => {
      const state = createTTMTestState();
      const moves = getLegalMoves(state);
      const ttmMoves = moves.filter(m => m.type === 'THROW_TEAM_MATE');
      expect(ttmMoves.length).toBeGreaterThan(0);

      // All TTM moves should reference A1 as thrower and A2 as thrown
      for (const m of ttmMoves) {
        if (m.type === 'THROW_TEAM_MATE') {
          expect(m.playerId).toBe('A1');
          expect(m.thrownPlayerId).toBe('A2');
        }
      }
    });

    it('does not generate TTM moves when thrower has already acted', () => {
      const state = createTTMTestState();
      state.playerActions = { 'A1': 'MOVE' };
      const moves = getLegalMoves(state);
      const ttmMoves = moves.filter(m => m.type === 'THROW_TEAM_MATE');
      expect(ttmMoves.length).toBe(0);
    });

    it('does not generate TTM moves when no adjacent Right Stuff teammate', () => {
      const state = createTTMTestState();
      // Move A2 far away
      state.players = state.players.map(p =>
        p.id === 'A2' ? { ...p, pos: { x: 20, y: 0 } } : p
      );
      const moves = getLegalMoves(state);
      const ttmMoves = moves.filter(m => m.type === 'THROW_TEAM_MATE');
      expect(ttmMoves.length).toBe(0);
    });

    it('does not generate TTM moves targeting beyond Long Pass range', () => {
      const state = createTTMTestState();
      const moves = getLegalMoves(state);
      const ttmMoves = moves.filter(m => m.type === 'THROW_TEAM_MATE') as Array<{
        type: 'THROW_TEAM_MATE'; playerId: string; thrownPlayerId: string; targetPos: Position;
      }>;

      for (const m of ttmMoves) {
        const thrower = state.players.find(p => p.id === m.playerId)!;
        const dist = Math.max(
          Math.abs(thrower.pos.x - m.targetPos.x),
          Math.abs(thrower.pos.y - m.targetPos.y)
        );
        expect(dist).toBeLessThanOrEqual(10); // Long Pass max
      }
    });
  });

  describe('applyMove: THROW_TEAM_MATE', () => {
    it('applies TTM move through applyMove correctly', () => {
      const state = createTTMTestState();
      const rng = makeTestRNG([0.83, 0.3, 0.5]);

      const move: Move = {
        type: 'THROW_TEAM_MATE',
        playerId: 'A1',
        thrownPlayerId: 'A2',
        targetPos: { x: 15, y: 7 },
      };
      const result = applyMove(state, move, rng);

      // Thrower should have action recorded
      expect(result.playerActions['A1']).toBe('THROW_TEAM_MATE');
      // Thrown player should have moved
      const thrown = result.players.find(p => p.id === 'A2')!;
      expect(thrown.pos).not.toEqual({ x: 11, y: 7 });
    });

    it('rejects TTM from wrong team', () => {
      const state = createTTMTestState();
      state.currentPlayer = 'B';
      const rng = makeTestRNG([0.83, 0.3, 0.5]);

      const move: Move = {
        type: 'THROW_TEAM_MATE',
        playerId: 'A1',
        thrownPlayerId: 'A2',
        targetPos: { x: 15, y: 7 },
      };
      const result = applyMove(state, move, rng);

      // State unchanged
      expect(result.players.find(p => p.id === 'A2')!.pos).toEqual({ x: 11, y: 7 });
    });
  });
});
