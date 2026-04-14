/**
 * Integration tests for the Instable (Unstable) trait.
 *
 * BB3 Season 3 rule:
 *   A player with the Instable trait cannot declare a Pass, Hand-Off, or
 *   Throw Team-Mate action. This is a prohibition, not a failed roll — no
 *   dice are rolled and no turnover occurs when the action is rejected.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { setup, applyMove, makeRNG, getLegalMoves } from '../index';
import type { GameState, Move, Player } from '../core/types';

function makeTestState(): GameState {
  return {
    ...setup(),
    teamRerolls: { teamA: 2, teamB: 2 },
    rerollUsedThisTurn: false,
  };
}

/** Place A1 with the ball at (5,5), A2 adjacent at (6,5); clear other pitch. */
function setupBallCarrierScenario(
  baseState: GameState,
  carrierHasInstable: boolean,
): GameState {
  return {
    ...baseState,
    currentPlayer: 'A',
    selectedPlayerId: null,
    playerActions: {},
    isTurnover: false,
    ball: undefined,
    players: baseState.players.map((p): Player => {
      if (p.id === 'A1') {
        return {
          ...p,
          pos: { x: 5, y: 5 },
          pm: 6,
          ma: 6,
          ag: 3,
          pa: 3,
          state: 'active',
          stunned: false,
          hasBall: true,
          skills: carrierHasInstable ? ['instable'] : [],
          gfiUsed: 0,
        };
      }
      if (p.id === 'A2') {
        return {
          ...p,
          pos: { x: 6, y: 5 },
          pm: 6,
          ma: 6,
          ag: 3,
          state: 'active',
          stunned: false,
          hasBall: false,
          skills: [],
          gfiUsed: 0,
        };
      }
      if (p.team === 'A') {
        return { ...p, pos: { x: 1, y: 1 }, state: 'active', stunned: false, hasBall: false };
      }
      return { ...p, pos: { x: 24, y: 13 }, state: 'active', stunned: false, hasBall: false };
    }),
  };
}

describe('Regle: Instable (prohibition)', () => {
  let baseState: GameState;

  beforeEach(() => {
    baseState = makeTestState();
  });

  it('a player without instable can declare a PASS action', () => {
    const state = setupBallCarrierScenario(baseState, false);
    const legal = getLegalMoves(state);
    const hasPassMove = legal.some(m => m.type === 'PASS' && m.playerId === 'A1');
    expect(hasPassMove).toBe(true);
  });

  it('a player with instable cannot declare a PASS action (not in legal moves)', () => {
    const state = setupBallCarrierScenario(baseState, true);
    const legal = getLegalMoves(state);
    const hasPassMove = legal.some(m => m.type === 'PASS' && m.playerId === 'A1');
    expect(hasPassMove).toBe(false);
  });

  it('a player with instable cannot declare a HANDOFF action (not in legal moves)', () => {
    const state = setupBallCarrierScenario(baseState, true);
    const legal = getLegalMoves(state);
    const hasHandoffMove = legal.some(m => m.type === 'HANDOFF' && m.playerId === 'A1');
    expect(hasHandoffMove).toBe(false);
  });

  it('a player without instable can declare a HANDOFF to an adjacent teammate', () => {
    const state = setupBallCarrierScenario(baseState, false);
    const legal = getLegalMoves(state);
    const hasHandoffMove = legal.some(
      m => m.type === 'HANDOFF' && m.playerId === 'A1' && m.targetId === 'A2'
    );
    expect(hasHandoffMove).toBe(true);
  });

  it('applyMove on PASS by an instable player rejects the action (state unchanged except log)', () => {
    const state = setupBallCarrierScenario(baseState, true);
    const passMove: Move = { type: 'PASS', playerId: 'A1', targetId: 'A2' };
    const rng = makeRNG('instable-pass-reject');
    const result = applyMove(state, passMove, rng);

    const a1 = result.players.find(p => p.id === 'A1')!;
    const a2 = result.players.find(p => p.id === 'A2')!;
    // Ball remains with the original carrier, no exchange happened
    expect(a1.hasBall).toBe(true);
    expect(a2.hasBall).toBeFalsy();
    // No turnover
    expect(result.isTurnover).toBeFalsy();
  });

  it('instable PASS attempt logs the "Instable" prevention message', () => {
    const state = setupBallCarrierScenario(baseState, true);
    const passMove: Move = { type: 'PASS', playerId: 'A1', targetId: 'A2' };
    const rng = makeRNG('instable-pass-log');
    const result = applyMove(state, passMove, rng);

    const instableLog = result.gameLog.find(l => l.message.includes('Instable'));
    expect(instableLog).toBeDefined();
    expect(instableLog!.playerId).toBe('A1');
  });

  it('instable player can still declare a MOVE action', () => {
    const state = setupBallCarrierScenario(baseState, true);
    const legal = getLegalMoves(state);
    const hasMove = legal.some(m => m.type === 'MOVE' && m.playerId === 'A1');
    expect(hasMove).toBe(true);
  });

  it('instable does not trigger a pass dice roll (prohibition, no roll)', () => {
    const state = setupBallCarrierScenario(baseState, true);
    const passMove: Move = { type: 'PASS', playerId: 'A1', targetId: 'A2' };
    const rng = makeRNG('instable-no-dice');
    const result = applyMove(state, passMove, rng);

    // No pass dice roll should appear
    const passDiceLog = result.gameLog.filter(l => l.message.includes('Jet de passe'));
    expect(passDiceLog).toHaveLength(0);
  });

  it('instable does not consume the player activation on a rejected PASS', () => {
    const state = setupBallCarrierScenario(baseState, true);
    const passMove: Move = { type: 'PASS', playerId: 'A1', targetId: 'A2' };
    const rng = makeRNG('instable-not-consumed');
    const result = applyMove(state, passMove, rng);

    // playerActions should not record a PASS for A1
    expect(result.playerActions['A1']).toBeUndefined();
  });
});
