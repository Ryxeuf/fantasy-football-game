/**
 * Tests pour `clearAllPendingStates` (audit 2026-05-19 bug B1).
 *
 * Verifie qu'aucun pendingX ne survit aux transitions de drive
 * (halftime, post-touchdown).
 */

import { describe, it, expect } from 'vitest';

import { clearAllPendingStates, handlePostTouchdown, setup } from './game-state';
import type { GameState, TeamId } from './types';
import { makeRNG } from '../utils/rng';

function stateWithAllPendings(): GameState {
  const base = setup();
  return {
    ...base,
    pendingApothecary: {
      playerId: 'A1',
      injuryType: 'casualty',
      casualtyOutcome: 'badly_hurt',
      hasRegeneration: false,
      fallbackToRegeneration: false,
    } as GameState['pendingApothecary'],
    pendingKickoffEvent: { type: 'riot' } as GameState['pendingKickoffEvent'],
    pendingBlock: { attackerId: 'A1', targetId: 'B1' } as GameState['pendingBlock'],
    pendingDumpOff: { passerId: 'A1' } as GameState['pendingDumpOff'],
    pendingPushChoice: { attackerId: 'A1', targetId: 'B1', options: [] } as GameState['pendingPushChoice'],
    pendingFollowUpChoice: { attackerId: 'A1', targetPos: { x: 0, y: 0 } } as GameState['pendingFollowUpChoice'],
    pendingReroll: { context: 'dodge', playerId: 'A1' } as GameState['pendingReroll'],
    pendingMultipleBlock: { attackerId: 'A1' } as GameState['pendingMultipleBlock'],
    pendingFrenzyBlock: { attackerId: 'A1', targetId: 'B1' } as GameState['pendingFrenzyBlock'],
    pendingOnTheBall: { playerId: 'A1' } as GameState['pendingOnTheBall'],
  };
}

describe('clearAllPendingStates', () => {
  it('retourne un nouveau state (immuable)', () => {
    const state = stateWithAllPendings();
    const cleared = clearAllPendingStates(state);
    expect(cleared).not.toBe(state);
  });

  it('clear les 10 champs pendingX', () => {
    const state = stateWithAllPendings();
    const cleared = clearAllPendingStates(state);
    expect(cleared.pendingApothecary).toBeUndefined();
    expect(cleared.pendingKickoffEvent).toBeUndefined();
    expect(cleared.pendingBlock).toBeUndefined();
    expect(cleared.pendingDumpOff).toBeUndefined();
    expect(cleared.pendingPushChoice).toBeUndefined();
    expect(cleared.pendingFollowUpChoice).toBeUndefined();
    expect(cleared.pendingReroll).toBeUndefined();
    expect(cleared.pendingMultipleBlock).toBeUndefined();
    expect(cleared.pendingFrenzyBlock).toBeUndefined();
    expect(cleared.pendingOnTheBall).toBeUndefined();
  });

  it('ne mute pas le state initial', () => {
    const state = stateWithAllPendings();
    const snapshot = JSON.stringify(state);
    clearAllPendingStates(state);
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it('preserve les autres champs', () => {
    const state = stateWithAllPendings();
    const cleared = clearAllPendingStates(state);
    expect(cleared.score).toEqual(state.score);
    expect(cleared.players).toBe(state.players);
    expect(cleared.turn).toBe(state.turn);
    expect(cleared.half).toBe(state.half);
  });
});

describe('handlePostTouchdown clear les pendingX (audit bug B1)', () => {
  it('clear pendingPushChoice apres TD', () => {
    const state = stateWithAllPendings();
    // Force un log de score pour faire choisir scoringTeam = 'A'
    const stateWithScoreLog: GameState = {
      ...state,
      currentPlayer: 'A' as TeamId,
      gameLog: [
        ...state.gameLog,
        {
          id: 'td-1',
          timestamp: Date.now(),
          type: 'score',
          team: 'A' as TeamId,
          details: 'Touchdown',
        },
      ],
    };
    const after = handlePostTouchdown(stateWithScoreLog, makeRNG('post-td-clear'));

    expect(after.pendingApothecary).toBeUndefined();
    expect(after.pendingPushChoice).toBeUndefined();
    expect(after.pendingFollowUpChoice).toBeUndefined();
    expect(after.pendingReroll).toBeUndefined();
    expect(after.pendingBlock).toBeUndefined();
    expect(after.pendingMultipleBlock).toBeUndefined();
    expect(after.pendingFrenzyBlock).toBeUndefined();
    expect(after.pendingDumpOff).toBeUndefined();
    expect(after.pendingOnTheBall).toBeUndefined();
    expect(after.pendingKickoffEvent).toBeUndefined();
  });
});
