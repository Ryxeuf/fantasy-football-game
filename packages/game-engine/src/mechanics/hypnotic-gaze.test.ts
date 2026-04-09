import { describe, it, expect } from 'vitest';
import { setup, applyMove, getLegalMoves } from '../index';
import { GameState, RNG } from '../core/types';
import {
  canHypnoticGaze,
  calculateGazeModifiers,
  executeHypnoticGaze,
} from './hypnotic-gaze';
import { getAdjacentOpponents } from './movement';

function makeTestRNG(values: number[]): RNG {
  let i = 0;
  return () => {
    const val = values[i % values.length];
    i++;
    return val;
  };
}

/**
 * Create a test state with a gazer (hypnotic-gaze skill) and an opponent target.
 * Gazer A1 (Vampire) at (10,7), opponent B1 at (11,7) adjacent.
 * Teammate A2 far away at (5,7).
 */
function createGazeTestState(): GameState {
  const state = setup();
  state.players = [
    {
      id: 'A1', team: 'A', pos: { x: 10, y: 7 }, name: 'Vampire Thrall', number: 1,
      position: 'Vampire', ma: 6, st: 4, ag: 2, pa: 4, av: 8,
      skills: ['hypnotic-gaze', 'regeneration'],
      pm: 6, hasBall: false, state: 'active',
    },
    {
      id: 'A2', team: 'A', pos: { x: 5, y: 7 }, name: 'Thrall', number: 2,
      position: 'Thrall', ma: 6, st: 3, ag: 3, pa: 4, av: 7,
      skills: [],
      pm: 6, hasBall: false, state: 'active',
    },
    {
      id: 'B1', team: 'B', pos: { x: 11, y: 7 }, name: 'Orc Lineman', number: 1,
      position: 'Lineman', ma: 5, st: 3, ag: 3, pa: 4, av: 9, skills: [],
      pm: 5, hasBall: false, state: 'active',
    },
    {
      id: 'B2', team: 'B', pos: { x: 20, y: 7 }, name: 'Orc Blitzer', number: 2,
      position: 'Blitzer', ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: [],
      pm: 6, hasBall: false, state: 'active',
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

describe('Regle: Hypnotic Gaze', () => {
  describe('canHypnoticGaze', () => {
    it('allows gaze when gazer has hypnotic-gaze skill and target is adjacent standing opponent', () => {
      const state = createGazeTestState();
      const gazer = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      expect(canHypnoticGaze(state, gazer, target)).toBe(true);
    });

    it('rejects gaze when gazer does not have hypnotic-gaze skill', () => {
      const state = createGazeTestState();
      state.players = state.players.map(p =>
        p.id === 'A1' ? { ...p, skills: [] } : p
      );
      const gazer = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      expect(canHypnoticGaze(state, gazer, target)).toBe(false);
    });

    it('rejects gaze when target is not adjacent', () => {
      const state = createGazeTestState();
      const gazer = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B2')!; // B2 at (20,7), far away
      expect(canHypnoticGaze(state, gazer, target)).toBe(false);
    });

    it('rejects gaze when target is a teammate', () => {
      const state = createGazeTestState();
      // Move A2 adjacent to A1
      state.players = state.players.map(p =>
        p.id === 'A2' ? { ...p, pos: { x: 9, y: 7 } } : p
      );
      const gazer = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'A2')!;
      expect(canHypnoticGaze(state, gazer, target)).toBe(false);
    });

    it('rejects gaze when target is stunned', () => {
      const state = createGazeTestState();
      state.players = state.players.map(p =>
        p.id === 'B1' ? { ...p, stunned: true } : p
      );
      const gazer = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      expect(canHypnoticGaze(state, gazer, target)).toBe(false);
    });

    it('rejects gaze when target is not active (e.g. knocked out)', () => {
      const state = createGazeTestState();
      state.players = state.players.map(p =>
        p.id === 'B1' ? { ...p, state: 'knocked_out' as const } : p
      );
      const gazer = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      expect(canHypnoticGaze(state, gazer, target)).toBe(false);
    });
  });

  describe('calculateGazeModifiers', () => {
    it('returns 0 when no other opponents are in gazer tackle zone', () => {
      const state = createGazeTestState();
      const gazer = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      // Only B1 is adjacent, and B1 is excluded as the target
      expect(calculateGazeModifiers(state, gazer, target)).toBe(0);
    });

    it('returns -1 when one additional opponent is in gazer tackle zone', () => {
      const state = createGazeTestState();
      // Move B2 adjacent to A1 (the gazer)
      state.players = state.players.map(p =>
        p.id === 'B2' ? { ...p, pos: { x: 10, y: 6 } } : p
      );
      const gazer = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      expect(calculateGazeModifiers(state, gazer, target)).toBe(-1);
    });

    it('returns -2 when two additional opponents are in gazer tackle zone', () => {
      const state = createGazeTestState();
      // Add another opponent adjacent
      state.players = state.players.map(p =>
        p.id === 'B2' ? { ...p, pos: { x: 10, y: 6 } } : p
      );
      state.players.push({
        id: 'B3', team: 'B', pos: { x: 9, y: 7 }, name: 'Orc Black Orc', number: 3,
        position: 'Black Orc', ma: 4, st: 4, ag: 4, pa: 5, av: 10, skills: [],
        pm: 4, hasBall: false, state: 'active',
      });
      const gazer = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      expect(calculateGazeModifiers(state, gazer, target)).toBe(-2);
    });

    it('does not count stunned opponents as tackle zone', () => {
      const state = createGazeTestState();
      state.players = state.players.map(p =>
        p.id === 'B2' ? { ...p, pos: { x: 10, y: 6 }, stunned: true } : p
      );
      const gazer = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      expect(calculateGazeModifiers(state, gazer, target)).toBe(0);
    });
  });

  describe('executeHypnoticGaze', () => {
    it('hypnotizes target on successful roll (roll >= target number)', () => {
      const state = createGazeTestState();
      const gazer = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      // AG 2+ → target number 2, roll 2 → success
      // RNG value (0..1): for roll of 2 on d6, need value in [1/6, 2/6) → 0.17
      const rng = makeTestRNG([0.17]);
      const result = executeHypnoticGaze(state, gazer, target, rng);
      expect(result.hypnotizedPlayers).toContain('B1');
    });

    it('hypnotizes target on natural 6 (always succeeds)', () => {
      const state = createGazeTestState();
      const gazer = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      // RNG for roll 6 on d6: value in [5/6, 1) → 0.84
      const rng = makeTestRNG([0.84]);
      const result = executeHypnoticGaze(state, gazer, target, rng);
      expect(result.hypnotizedPlayers).toContain('B1');
    });

    it('fails on natural 1 (always fails)', () => {
      const state = createGazeTestState();
      const gazer = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      // RNG for roll 1 on d6: value in [0, 1/6) → 0.0
      const rng = makeTestRNG([0.0]);
      const result = executeHypnoticGaze(state, gazer, target, rng);
      expect(result.hypnotizedPlayers ?? []).not.toContain('B1');
    });

    it('ends gazer activation on failure (pm set to 0)', () => {
      const state = createGazeTestState();
      const gazer = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      const rng = makeTestRNG([0.0]); // natural 1 → fail
      const result = executeHypnoticGaze(state, gazer, target, rng);
      const resultGazer = result.players.find(p => p.id === 'A1')!;
      expect(resultGazer.pm).toBe(0);
    });

    it('does NOT cause turnover on failure', () => {
      const state = createGazeTestState();
      const gazer = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      const rng = makeTestRNG([0.0]); // natural 1 → fail
      const result = executeHypnoticGaze(state, gazer, target, rng);
      expect(result.isTurnover).toBe(false);
    });

    it('adds log entries for the gaze action', () => {
      const state = createGazeTestState();
      const gazer = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      const rng = makeTestRNG([0.84]); // roll 6 → success
      const initialLogLength = state.gameLog.length;
      const result = executeHypnoticGaze(state, gazer, target, rng);
      expect(result.gameLog.length).toBeGreaterThan(initialLogLength);
    });

    it('records dice result in lastDiceResult', () => {
      const state = createGazeTestState();
      const gazer = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      const rng = makeTestRNG([0.84]); // roll 6
      const result = executeHypnoticGaze(state, gazer, target, rng);
      expect(result.lastDiceResult).toBeDefined();
      expect(result.lastDiceResult!.type).toBe('gaze');
      expect(result.lastDiceResult!.playerId).toBe('A1');
    });

    it('applies tackle zone modifiers to the gaze roll', () => {
      const state = createGazeTestState();
      // Add an extra opponent adjacent to gazer → modifier -1
      state.players = state.players.map(p =>
        p.id === 'B2' ? { ...p, pos: { x: 10, y: 6 } } : p
      );
      const gazer = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      // AG 2, modifier -1 → target number = max(2, min(6, 2 - (-1))) = 3
      // Roll 2 (RNG 0.17) → 2 < 3 → fail
      const rng = makeTestRNG([0.17]);
      const result = executeHypnoticGaze(state, gazer, target, rng);
      expect(result.hypnotizedPlayers ?? []).not.toContain('B1');
    });
  });

  describe('Integration: getLegalMoves', () => {
    it('generates HYPNOTIC_GAZE moves for players with the skill', () => {
      const state = createGazeTestState();
      const moves = getLegalMoves(state);
      const gazeMoves = moves.filter(m => m.type === 'HYPNOTIC_GAZE');
      expect(gazeMoves.length).toBeGreaterThan(0);
      const firstGaze = gazeMoves[0] as { type: 'HYPNOTIC_GAZE'; playerId: string; targetId: string };
      expect(firstGaze.playerId).toBe('A1');
      expect(firstGaze.targetId).toBe('B1');
    });

    it('does not generate HYPNOTIC_GAZE moves if player has already acted', () => {
      const state = createGazeTestState();
      state.playerActions = { A1: 'HYPNOTIC_GAZE' };
      const moves = getLegalMoves(state);
      const gazeMoves = moves.filter(m => m.type === 'HYPNOTIC_GAZE');
      expect(gazeMoves.length).toBe(0);
    });

    it('does not generate HYPNOTIC_GAZE for non-adjacent opponents', () => {
      const state = createGazeTestState();
      const moves = getLegalMoves(state);
      const gazeMoves = moves.filter(
        m => m.type === 'HYPNOTIC_GAZE' && (m as { targetId: string }).targetId === 'B2'
      );
      expect(gazeMoves.length).toBe(0);
    });
  });

  describe('Integration: applyMove', () => {
    it('applies HYPNOTIC_GAZE move and hypnotizes target on success', () => {
      const state = createGazeTestState();
      const rng = makeTestRNG([0.84]); // roll 6 → success
      const result = applyMove(state, { type: 'HYPNOTIC_GAZE', playerId: 'A1', targetId: 'B1' }, rng);
      expect(result.hypnotizedPlayers).toContain('B1');
    });

    it('sets player action to HYPNOTIC_GAZE after applying move', () => {
      const state = createGazeTestState();
      const rng = makeTestRNG([0.84]); // roll 6 → success
      const result = applyMove(state, { type: 'HYPNOTIC_GAZE', playerId: 'A1', targetId: 'B1' }, rng);
      expect(result.playerActions['A1']).toBe('HYPNOTIC_GAZE');
    });
  });

  describe('Tackle zone effect', () => {
    it('hypnotized player does not contribute to tackle zones', () => {
      const state = createGazeTestState();
      // Hypnotize B1
      state.hypnotizedPlayers = ['B1'];
      // Move A2 next to B1 at (11,7)
      state.players = state.players.map(p =>
        p.id === 'A2' ? { ...p, pos: { x: 12, y: 7 } } : p
      );
      // B1 is adjacent to (12,7) but hypnotized → should NOT be in the list
      const opponents = getAdjacentOpponents(state, { x: 12, y: 7 }, 'A');
      expect(opponents.find(p => p.id === 'B1')).toBeUndefined();
    });

    it('non-hypnotized player still contributes to tackle zones', () => {
      const state = createGazeTestState();
      state.hypnotizedPlayers = [];
      // B1 at (11,7) is adjacent to (12,7) and NOT hypnotized
      state.players = state.players.map(p =>
        p.id === 'A2' ? { ...p, pos: { x: 12, y: 7 } } : p
      );
      const opponents = getAdjacentOpponents(state, { x: 12, y: 7 }, 'A');
      expect(opponents.find(p => p.id === 'B1')).toBeDefined();
    });
  });

  describe('End of turn clears hypnotized state', () => {
    it('clears hypnotizedPlayers when turn ends', () => {
      const state = createGazeTestState();
      state.hypnotizedPlayers = ['B1'];
      const rng = makeTestRNG([0.5]);
      const result = applyMove(state, { type: 'END_TURN' }, rng);
      expect(result.hypnotizedPlayers ?? []).toHaveLength(0);
    });
  });
});
