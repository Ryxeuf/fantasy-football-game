import { describe, it, expect } from 'vitest';
import { setup, applyMove, makeRNG, getLegalMoves } from '../index';
import type { GameState, Move } from '../core/types';
import { getSkillEffect } from '../skills/skill-registry';
import { canThrowTeamMate } from './throw-team-mate';

/**
 * Right Stuff (BB2020/BB3 rules):
 * - If this player also has a Strength characteristic of 3 or less,
 *   they can be thrown by a Team-mate with the Throw Team-mate skill.
 * - This is a passive trait — it enables the player to be thrown via TTM.
 * - The ST ≤ 3 condition is mandatory: a player with Right Stuff but ST > 3
 *   cannot be thrown.
 */

function makeTestState(): GameState {
  const state = setup();
  return {
    ...state,
    teamRerolls: { teamA: 2, teamB: 2 },
    rerollUsedThisTurn: false,
  };
}

/**
 * Create a TTM scenario with a thrower (Big Guy, ST 6, TTM skill) and
 * a thrown player (Halfling, configurable ST and skills).
 * Thrower A1 at (10,7), thrown A2 at (11,7) adjacent.
 * Opponent B1 far away at (20,7).
 */
function createRightStuffTestState(
  thrownST: number = 2,
  thrownSkills: string[] = ['right-stuff', 'stunty'],
): GameState {
  const baseState = makeTestState();
  return {
    ...baseState,
    currentPlayer: 'A',
    selectedPlayerId: null,
    playerActions: {},
    isTurnover: false,
    ball: { x: 5, y: 7 },
    players: baseState.players.map(p => {
      if (p.id === 'A1') {
        return {
          ...p,
          pos: { x: 10, y: 7 },
          name: 'Big Guy',
          position: 'Treeman',
          ma: 2, st: 6, ag: 5, pa: 5, av: 10,
          skills: ['throw-team-mate'],
          pm: 2,
          hasBall: false,
          state: 'active' as const,
          stunned: false,
        };
      }
      if (p.id === 'A2') {
        return {
          ...p,
          pos: { x: 11, y: 7 },
          name: 'Halfling',
          position: 'Halfling Hopeful',
          ma: 5, st: thrownST, ag: 3, pa: 6, av: 6,
          skills: thrownSkills,
          pm: 5,
          hasBall: false,
          state: 'active' as const,
          stunned: false,
        };
      }
      // Move all other players far away
      if (p.team === 'A') {
        return { ...p, pos: { x: 1, y: 1 }, state: 'active' as const, stunned: false, hasBall: false };
      }
      return { ...p, pos: { x: 24, y: 13 }, state: 'active' as const, stunned: false, hasBall: false };
    }),
  };
}

describe('Regle: Right Stuff (Poids Plume)', () => {
  describe('Skill Registry', () => {
    it('right-stuff is registered in skill registry', () => {
      const effect = getSkillEffect('right-stuff');
      expect(effect).toBeDefined();
      expect(effect!.slug).toBe('right-stuff');
    });

    it('right-stuff has passive trigger', () => {
      const effect = getSkillEffect('right-stuff');
      expect(effect!.triggers).toContain('passive');
    });

    it('right-stuff canApply returns true for player with the skill', () => {
      const state = createRightStuffTestState();
      const player = state.players.find(p => p.id === 'A2')!;
      const effect = getSkillEffect('right-stuff')!;
      expect(effect.canApply({ player, state })).toBe(true);
    });

    it('right-stuff canApply returns false for player without the skill', () => {
      const state = createRightStuffTestState(2, ['stunty']);
      const player = state.players.find(p => p.id === 'A2')!;
      const effect = getSkillEffect('right-stuff')!;
      expect(effect.canApply({ player, state })).toBe(false);
    });
  });

  describe('ST ≤ 3 enforcement', () => {
    it('allows throw when player has right-stuff and ST ≤ 3', () => {
      const state = createRightStuffTestState(2);
      const thrower = state.players.find(p => p.id === 'A1')!;
      const thrown = state.players.find(p => p.id === 'A2')!;
      expect(canThrowTeamMate(state, thrower, thrown)).toBe(true);
    });

    it('allows throw when player has right-stuff and ST = 3 (boundary)', () => {
      const state = createRightStuffTestState(3);
      const thrower = state.players.find(p => p.id === 'A1')!;
      const thrown = state.players.find(p => p.id === 'A2')!;
      expect(canThrowTeamMate(state, thrower, thrown)).toBe(true);
    });

    it('rejects throw when player has right-stuff but ST = 4', () => {
      const state = createRightStuffTestState(4);
      const thrower = state.players.find(p => p.id === 'A1')!;
      const thrown = state.players.find(p => p.id === 'A2')!;
      expect(canThrowTeamMate(state, thrower, thrown)).toBe(false);
    });

    it('rejects throw when player has right-stuff but ST = 5', () => {
      const state = createRightStuffTestState(5);
      const thrower = state.players.find(p => p.id === 'A1')!;
      const thrown = state.players.find(p => p.id === 'A2')!;
      expect(canThrowTeamMate(state, thrower, thrown)).toBe(false);
    });

    it('rejects throw when player has ST ≤ 3 but no right-stuff skill', () => {
      const state = createRightStuffTestState(2, ['stunty']);
      const thrower = state.players.find(p => p.id === 'A1')!;
      const thrown = state.players.find(p => p.id === 'A2')!;
      expect(canThrowTeamMate(state, thrower, thrown)).toBe(false);
    });
  });

  describe('Legal moves: TTM generation with Right Stuff', () => {
    it('generates TTM moves for right-stuff player with ST ≤ 3', () => {
      const state = createRightStuffTestState(2);
      const moves = getLegalMoves(state);
      const ttmMoves = moves.filter(m => m.type === 'THROW_TEAM_MATE');
      expect(ttmMoves.length).toBeGreaterThan(0);
    });

    it('does not generate TTM moves for right-stuff player with ST > 3', () => {
      const state = createRightStuffTestState(4);
      const moves = getLegalMoves(state);
      const ttmMoves = moves.filter(m => m.type === 'THROW_TEAM_MATE');
      expect(ttmMoves.length).toBe(0);
    });

    it('does not generate TTM moves for player without right-stuff', () => {
      const state = createRightStuffTestState(2, ['stunty']);
      const moves = getLegalMoves(state);
      const ttmMoves = moves.filter(m => m.type === 'THROW_TEAM_MATE');
      expect(ttmMoves.length).toBe(0);
    });
  });

  describe('TTM integration with Right Stuff', () => {
    it('successful TTM throw of right-stuff player with ST ≤ 3', () => {
      const state = createRightStuffTestState(2);
      const move: Move = {
        type: 'THROW_TEAM_MATE',
        playerId: 'A1',
        thrownPlayerId: 'A2',
        targetPos: { x: 15, y: 7 },
      };

      let found = false;
      for (let seed = 0; seed < 100; seed++) {
        const testRng = makeRNG(`rs-ttm-success-${seed}`);
        const result = applyMove(state, move, testRng);

        const thrownAfter = result.players.find(p => p.id === 'A2')!;
        // Player should have moved from original position
        if (!thrownAfter.stunned && thrownAfter.pos.x !== 11) {
          found = true;
          expect(thrownAfter.pos).not.toEqual({ x: 11, y: 7 });
          break;
        }
      }
      expect(found).toBe(true);
    });

    it('TTM move rejected for right-stuff player with ST > 3', () => {
      const state = createRightStuffTestState(4);
      const move: Move = {
        type: 'THROW_TEAM_MATE',
        playerId: 'A1',
        thrownPlayerId: 'A2',
        targetPos: { x: 15, y: 7 },
      };

      const rng = makeRNG('rs-ttm-reject');
      const result = applyMove(state, move, rng);

      // Player should NOT have moved (action rejected)
      const thrownAfter = result.players.find(p => p.id === 'A2')!;
      expect(thrownAfter.pos).toEqual({ x: 11, y: 7 });
    });

    it('TTM move rejected for player without right-stuff', () => {
      const state = createRightStuffTestState(2, ['stunty']);
      const move: Move = {
        type: 'THROW_TEAM_MATE',
        playerId: 'A1',
        thrownPlayerId: 'A2',
        targetPos: { x: 15, y: 7 },
      };

      const rng = makeRNG('rs-ttm-noskill');
      const result = applyMove(state, move, rng);

      // Player should NOT have moved (action rejected)
      const thrownAfter = result.players.find(p => p.id === 'A2')!;
      expect(thrownAfter.pos).toEqual({ x: 11, y: 7 });
    });
  });
});
