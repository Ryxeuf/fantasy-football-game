import { describe, it, expect } from 'vitest';
import { setup, applyMove, getLegalMoves } from '../index';
import { GameState, RNG } from '../core/types';
import { canStab, executeStab } from './stab';

function makeTestRNG(values: number[]): RNG {
  let i = 0;
  return () => {
    const val = values[i % values.length];
    i++;
    return val;
  };
}

/**
 * Stabber A1 (Gutter Runner) at (10,7) with "stab" skill.
 * Opponent B1 standing at (11,7) — adjacent.
 * Teammate A2 far away at (5,7).
 * Opponent B2 far away at (20,7) — non-adjacent.
 */
function createStabTestState(): GameState {
  const state = setup();
  state.players = [
    {
      id: 'A1', team: 'A', pos: { x: 10, y: 7 }, name: 'Gutter Runner', number: 1,
      position: 'GutterRunner', ma: 9, st: 2, ag: 2, pa: 4, av: 8,
      skills: ['stab', 'dodge'],
      pm: 9, hasBall: false, state: 'active',
    },
    {
      id: 'A2', team: 'A', pos: { x: 5, y: 7 }, name: 'Skaven Lineman', number: 2,
      position: 'Lineman', ma: 7, st: 3, ag: 3, pa: 4, av: 8, skills: [],
      pm: 7, hasBall: false, state: 'active',
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

describe('Regle: Stab', () => {
  describe('canStab', () => {
    it('allows stab when player has stab skill and target is adjacent standing opponent', () => {
      const state = createStabTestState();
      const stabber = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      expect(canStab(state, stabber, target)).toBe(true);
    });

    it('rejects stab when player does not have stab skill', () => {
      const state = createStabTestState();
      state.players = state.players.map(p =>
        p.id === 'A1' ? { ...p, skills: [] } : p
      );
      const stabber = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      expect(canStab(state, stabber, target)).toBe(false);
    });

    it('rejects stab when target is not adjacent', () => {
      const state = createStabTestState();
      const stabber = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B2')!;
      expect(canStab(state, stabber, target)).toBe(false);
    });

    it('rejects stab when target is a teammate', () => {
      const state = createStabTestState();
      state.players = state.players.map(p =>
        p.id === 'A2' ? { ...p, pos: { x: 9, y: 7 } } : p
      );
      const stabber = state.players.find(p => p.id === 'A1')!;
      const teammate = state.players.find(p => p.id === 'A2')!;
      expect(canStab(state, stabber, teammate)).toBe(false);
    });

    it('rejects stab when target is stunned (already prone)', () => {
      const state = createStabTestState();
      state.players = state.players.map(p =>
        p.id === 'B1' ? { ...p, stunned: true } : p
      );
      const stabber = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      expect(canStab(state, stabber, target)).toBe(false);
    });

    it('rejects stab when target is not active (e.g. knocked out)', () => {
      const state = createStabTestState();
      state.players = state.players.map(p =>
        p.id === 'B1' ? { ...p, state: 'knocked_out' as const } : p
      );
      const stabber = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      expect(canStab(state, stabber, target)).toBe(false);
    });
  });

  describe('executeStab', () => {
    it('records armor dice result in lastDiceResult', () => {
      const state = createStabTestState();
      const stabber = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      // Armor roll (2D6) low → armor holds vs AV 9
      const rng = makeTestRNG([0.0, 0.0]);
      const result = executeStab(state, stabber, target, rng);
      expect(result.lastDiceResult).toBeDefined();
      expect(result.lastDiceResult!.type).toBe('armor');
      expect(result.lastDiceResult!.playerId).toBe('B1');
    });

    it('does NOT knock down target when armor holds', () => {
      const state = createStabTestState();
      const stabber = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      // Armor roll: 2 + 2 = 4 vs AV 9 → holds
      const rng = makeTestRNG([0.0, 0.0]);
      const result = executeStab(state, stabber, target, rng);
      const resultTarget = result.players.find(p => p.id === 'B1')!;
      // Stab doesn't put standing players Prone — target stays standing
      expect(resultTarget.stunned).toBeFalsy();
      expect(resultTarget.state).toBe('active');
    });

    it('performs injury roll when armor is broken', () => {
      const state = createStabTestState();
      // Use a target with low armor (AV 7) so armor breaks
      state.players = state.players.map(p =>
        p.id === 'B1' ? { ...p, av: 7 } : p
      );
      const stabber = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      // Armor: high rolls (6+6=12 >= AV 7) → broken
      // Injury: low rolls → stunned
      const rng = makeTestRNG([0.84, 0.84, 0.0, 0.0]);
      const result = executeStab(state, stabber, target, rng);
      const injuryLogs = result.gameLog.filter(l => l.message.includes('blessure'));
      expect(injuryLogs.length).toBeGreaterThan(0);
    });

    it('ends stabber activation (pm set to 0) after successful stab action', () => {
      const state = createStabTestState();
      const stabber = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      const rng = makeTestRNG([0.0, 0.0]);
      const result = executeStab(state, stabber, target, rng);
      const resultStabber = result.players.find(p => p.id === 'A1')!;
      expect(resultStabber.pm).toBe(0);
    });

    it('does NOT cause turnover on stab (unless ball carrier issue)', () => {
      const state = createStabTestState();
      const stabber = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      const rng = makeTestRNG([0.0, 0.0]);
      const result = executeStab(state, stabber, target, rng);
      expect(result.isTurnover).toBe(false);
    });

    it('applies Mighty Blow bonus on the armor roll when stabber has mighty-blow', () => {
      const state = createStabTestState();
      state.players = state.players.map(p =>
        p.id === 'A1' ? { ...p, skills: ['stab', 'mighty-blow'] } : p
      );
      state.players = state.players.map(p =>
        p.id === 'B1' ? { ...p, av: 9 } : p
      );
      const stabber = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      // Armor roll 2D6 = 8 → without MB fails vs AV 9; with MB -1 → target 8 → broken
      const rng = makeTestRNG([0.5, 0.5]); // each 0.5 → 4, total 8
      const result = executeStab(state, stabber, target, rng);
      // Because target is exactly 8 and armor roll is 8, broken happens if modifier applied
      const armorResult = result.lastDiceResult;
      expect(armorResult).toBeDefined();
      expect(armorResult!.modifiers).toBe(-1);
    });

    it('adds log entries for the stab action', () => {
      const state = createStabTestState();
      const stabber = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      const rng = makeTestRNG([0.0, 0.0]);
      const initialLogLength = state.gameLog.length;
      const result = executeStab(state, stabber, target, rng);
      expect(result.gameLog.length).toBeGreaterThan(initialLogLength);
    });
  });

  describe('Integration: getLegalMoves', () => {
    it('generates STAB moves for players with the stab skill', () => {
      const state = createStabTestState();
      const moves = getLegalMoves(state);
      const stabMoves = moves.filter(m => m.type === 'STAB');
      expect(stabMoves.length).toBeGreaterThan(0);
      const firstStab = stabMoves[0] as { type: 'STAB'; playerId: string; targetId: string };
      expect(firstStab.playerId).toBe('A1');
      expect(firstStab.targetId).toBe('B1');
    });

    it('does not generate STAB moves if player has already acted', () => {
      const state = createStabTestState();
      state.playerActions = { A1: 'STAB' };
      const moves = getLegalMoves(state);
      const stabMoves = moves.filter(m => m.type === 'STAB');
      expect(stabMoves.length).toBe(0);
    });

    it('does not generate STAB moves for non-adjacent opponents', () => {
      const state = createStabTestState();
      const moves = getLegalMoves(state);
      const stabMoves = moves.filter(
        m => m.type === 'STAB' && (m as { targetId: string }).targetId === 'B2'
      );
      expect(stabMoves.length).toBe(0);
    });
  });

  describe('Integration: applyMove', () => {
    it('applies STAB move and records armor result', () => {
      const state = createStabTestState();
      const rng = makeTestRNG([0.0, 0.0]);
      const result = applyMove(state, { type: 'STAB', playerId: 'A1', targetId: 'B1' }, rng);
      expect(result.lastDiceResult).toBeDefined();
      expect(result.lastDiceResult!.type).toBe('armor');
    });

    it('sets player action to STAB after applying move', () => {
      const state = createStabTestState();
      const rng = makeTestRNG([0.0, 0.0]);
      const result = applyMove(state, { type: 'STAB', playerId: 'A1', targetId: 'B1' }, rng);
      expect(result.playerActions['A1']).toBe('STAB');
    });
  });
});
