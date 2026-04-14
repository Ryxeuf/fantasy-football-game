import { describe, it, expect } from 'vitest';
import { setup, applyMove, getLegalMoves } from '../index';
import { GameState, RNG } from '../core/types';
import { canChainsaw, executeChainsaw } from './chainsaw';

function makeTestRNG(values: number[]): RNG {
  let i = 0;
  return () => {
    const val = values[i % values.length];
    i++;
    return val;
  };
}

/**
 * Joueur Chainsaw A1 at (10,7) with "chainsaw" + "secret-weapon" skills.
 * Opponent B1 standing at (11,7) — adjacent.
 * Teammate A2 far away at (5,7).
 * Opponent B2 far away at (20,7) — non-adjacent.
 */
function createChainsawTestState(): GameState {
  const state = setup();
  state.players = [
    {
      id: 'A1', team: 'A', pos: { x: 10, y: 7 }, name: 'Goblin Looney', number: 1,
      position: 'Looney', ma: 6, st: 3, ag: 3, pa: 4, av: 7,
      skills: ['chainsaw', 'secret-weapon'],
      pm: 6, hasBall: false, state: 'active',
    },
    {
      id: 'A2', team: 'A', pos: { x: 5, y: 7 }, name: 'Goblin Lineman', number: 2,
      position: 'Lineman', ma: 6, st: 2, ag: 3, pa: 4, av: 7, skills: [],
      pm: 6, hasBall: false, state: 'active',
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

describe('Regle: Chainsaw', () => {
  describe('canChainsaw', () => {
    it('allows chainsaw when player has chainsaw skill and target is adjacent standing opponent', () => {
      const state = createChainsawTestState();
      const attacker = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      expect(canChainsaw(state, attacker, target)).toBe(true);
    });

    it('rejects chainsaw when player does not have chainsaw skill', () => {
      const state = createChainsawTestState();
      state.players = state.players.map(p =>
        p.id === 'A1' ? { ...p, skills: [] } : p
      );
      const attacker = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      expect(canChainsaw(state, attacker, target)).toBe(false);
    });

    it('rejects chainsaw when target is not adjacent', () => {
      const state = createChainsawTestState();
      const attacker = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B2')!;
      expect(canChainsaw(state, attacker, target)).toBe(false);
    });

    it('rejects chainsaw when target is a teammate', () => {
      const state = createChainsawTestState();
      state.players = state.players.map(p =>
        p.id === 'A2' ? { ...p, pos: { x: 9, y: 7 } } : p
      );
      const attacker = state.players.find(p => p.id === 'A1')!;
      const teammate = state.players.find(p => p.id === 'A2')!;
      expect(canChainsaw(state, attacker, teammate)).toBe(false);
    });

    it('rejects chainsaw when target is stunned (already prone)', () => {
      const state = createChainsawTestState();
      state.players = state.players.map(p =>
        p.id === 'B1' ? { ...p, stunned: true } : p
      );
      const attacker = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      expect(canChainsaw(state, attacker, target)).toBe(false);
    });

    it('rejects chainsaw when target is not active (e.g. knocked out)', () => {
      const state = createChainsawTestState();
      state.players = state.players.map(p =>
        p.id === 'B1' ? { ...p, state: 'knocked_out' as const } : p
      );
      const attacker = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      expect(canChainsaw(state, attacker, target)).toBe(false);
    });
  });

  describe('executeChainsaw', () => {
    it('records armor dice result in lastDiceResult with +3 modifier (−3 on target number)', () => {
      const state = createChainsawTestState();
      const attacker = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      // Dice: 3 + 3 = 6 raw; with +3 → 9 vs AV 9 → break
      // rng values: (3-1)/6=0.333 → returns 3
      const rng = makeTestRNG([0.34, 0.34, 0.0, 0.0]);
      const result = executeChainsaw(state, attacker, target, rng);
      expect(result.lastDiceResult).toBeDefined();
      expect(result.lastDiceResult!.type).toBe('armor');
      expect(result.lastDiceResult!.modifiers).toBe(-3);
    });

    it('does NOT knock down target when armor holds (even with +3)', () => {
      const state = createChainsawTestState();
      const attacker = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      // Dice: 1+2=3 raw (not double 1); +3 → 6 vs AV 9 → holds
      const rng = makeTestRNG([0.05, 0.25]);
      const result = executeChainsaw(state, attacker, target, rng);
      const resultTarget = result.players.find(p => p.id === 'B1')!;
      expect(resultTarget.stunned).toBeFalsy();
      expect(resultTarget.state).toBe('active');
    });

    it('performs injury roll when armor is broken (with +3 modifier)', () => {
      const state = createChainsawTestState();
      const attacker = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      // Dice: 6+6=12 raw; +3 → 15 ≥ AV 9 → break. Injury rolls low → stunned.
      const rng = makeTestRNG([0.99, 0.99, 0.0, 0.0]);
      const result = executeChainsaw(state, attacker, target, rng);
      const injuryLogs = result.gameLog.filter(l => l.message.toLowerCase().includes('blessure'));
      expect(injuryLogs.length).toBeGreaterThan(0);
    });

    it('does NOT apply Mighty Blow on armor roll (chainsaw rules)', () => {
      const state = createChainsawTestState();
      state.players = state.players.map(p =>
        p.id === 'A1' ? { ...p, skills: ['chainsaw', 'secret-weapon', 'mighty-blow'] } : p,
      );
      const attacker = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      const rng = makeTestRNG([0.34, 0.34]);
      const result = executeChainsaw(state, attacker, target, rng);
      // Modifier should remain −3 (only chainsaw), not −4 (chainsaw+MB).
      expect(result.lastDiceResult!.modifiers).toBe(-3);
    });

    it('ends attacker activation (pm = 0) after chainsaw attack', () => {
      const state = createChainsawTestState();
      const attacker = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      const rng = makeTestRNG([0.0, 0.0]);
      const result = executeChainsaw(state, attacker, target, rng);
      const resultAttacker = result.players.find(p => p.id === 'A1')!;
      expect(resultAttacker.pm).toBe(0);
    });

    it('does NOT cause turnover on normal chainsaw hit', () => {
      const state = createChainsawTestState();
      const attacker = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      // Not a double 1; armor holds.
      const rng = makeTestRNG([0.05, 0.25]);
      const result = executeChainsaw(state, attacker, target, rng);
      expect(result.isTurnover).toBe(false);
    });

    it('on natural double 1: chainsaw hits the user (armor roll on attacker)', () => {
      const state = createChainsawTestState();
      const attacker = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      // Both dice = 1 (natural double 1). Self-armor roll then rolls low → armor holds.
      const rng = makeTestRNG([0.0, 0.0, 0.05, 0.05]);
      const result = executeChainsaw(state, attacker, target, rng);
      // Self armor roll is the last DiceResult and applies to attacker A1.
      expect(result.lastDiceResult).toBeDefined();
      expect(result.lastDiceResult!.type).toBe('armor');
      expect(result.lastDiceResult!.playerId).toBe('A1');
    });

    it('on natural double 1 causes a turnover', () => {
      const state = createChainsawTestState();
      const attacker = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      const rng = makeTestRNG([0.0, 0.0, 0.0, 0.0]);
      const result = executeChainsaw(state, attacker, target, rng);
      expect(result.isTurnover).toBe(true);
    });

    it('on natural double 1 with broken self-armor, performs injury roll on attacker', () => {
      const state = createChainsawTestState();
      // Reduce attacker's AV so self-armor breaks easily.
      state.players = state.players.map(p =>
        p.id === 'A1' ? { ...p, av: 7 } : p,
      );
      const attacker = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      // Double 1 (attack), then self-armor 6+6=12 +3 → break, injury low → stunned.
      const rng = makeTestRNG([0.0, 0.0, 0.99, 0.99, 0.0, 0.0]);
      const result = executeChainsaw(state, attacker, target, rng);
      const injuryLogs = result.gameLog.filter(
        l => l.message.toLowerCase().includes('blessure') && l.playerId === 'A1',
      );
      expect(injuryLogs.length).toBeGreaterThan(0);
    });

    it('adds log entries for the chainsaw action', () => {
      const state = createChainsawTestState();
      const attacker = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      const rng = makeTestRNG([0.0, 0.0]);
      const initialLogLength = state.gameLog.length;
      const result = executeChainsaw(state, attacker, target, rng);
      expect(result.gameLog.length).toBeGreaterThan(initialLogLength);
    });
  });

  describe('Integration: getLegalMoves', () => {
    it('generates CHAINSAW moves for players with the chainsaw skill', () => {
      const state = createChainsawTestState();
      const moves = getLegalMoves(state);
      const chainsawMoves = moves.filter(m => m.type === 'CHAINSAW');
      expect(chainsawMoves.length).toBeGreaterThan(0);
      const firstChainsaw = chainsawMoves[0] as { type: 'CHAINSAW'; playerId: string; targetId: string };
      expect(firstChainsaw.playerId).toBe('A1');
      expect(firstChainsaw.targetId).toBe('B1');
    });

    it('does not generate CHAINSAW moves if player has already acted', () => {
      const state = createChainsawTestState();
      state.playerActions = { A1: 'CHAINSAW' };
      const moves = getLegalMoves(state);
      const chainsawMoves = moves.filter(m => m.type === 'CHAINSAW');
      expect(chainsawMoves.length).toBe(0);
    });

    it('does not generate CHAINSAW moves for non-adjacent opponents', () => {
      const state = createChainsawTestState();
      const moves = getLegalMoves(state);
      const chainsawMoves = moves.filter(
        m => m.type === 'CHAINSAW' && (m as { targetId: string }).targetId === 'B2',
      );
      expect(chainsawMoves.length).toBe(0);
    });
  });

  describe('Integration: applyMove', () => {
    it('applies CHAINSAW move and records armor result', () => {
      const state = createChainsawTestState();
      const rng = makeTestRNG([0.34, 0.34]);
      const result = applyMove(state, { type: 'CHAINSAW', playerId: 'A1', targetId: 'B1' }, rng);
      expect(result.lastDiceResult).toBeDefined();
      expect(result.lastDiceResult!.type).toBe('armor');
    });

    it('sets player action to CHAINSAW after applying move', () => {
      const state = createChainsawTestState();
      const rng = makeTestRNG([0.34, 0.34]);
      const result = applyMove(state, { type: 'CHAINSAW', playerId: 'A1', targetId: 'B1' }, rng);
      expect(result.playerActions['A1']).toBe('CHAINSAW');
    });
  });
});
