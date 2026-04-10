/**
 * Tests for the replay module — extracts replay frames from stored turn payloads.
 * TDD RED phase: these tests define the expected API before implementation.
 */
import { describe, it, expect } from 'vitest';
import {
  buildReplayFrames,
  type ReplayFrame,
  type ReplayTurnPayload,
} from './replay';
import type { GameState } from './types';

/** Minimal GameState factory for tests. */
function makeGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    width: 26,
    height: 15,
    players: [],
    currentPlayer: 'A',
    turn: 1,
    selectedPlayerId: null,
    isTurnover: false,
    apothecaryAvailable: { teamA: true, teamB: true },
    dugouts: {
      teamA: {
        teamId: 'A',
        zones: {
          reserves: { id: 'r', name: 'Reserves', color: '', icon: '', maxCapacity: 16, players: [], position: { x: 0, y: 0, width: 0, height: 0 } },
          stunned: { id: 's', name: 'Stunned', color: '', icon: '', maxCapacity: 16, players: [], position: { x: 0, y: 0, width: 0, height: 0 } },
          knockedOut: { id: 'k', name: 'KO', color: '', icon: '', maxCapacity: 16, players: [], position: { x: 0, y: 0, width: 0, height: 0 } },
          casualty: { id: 'c', name: 'Casualty', color: '', icon: '', maxCapacity: 16, players: [], position: { x: 0, y: 0, width: 0, height: 0 } },
          sentOff: { id: 'so', name: 'Sent Off', color: '', icon: '', maxCapacity: 16, players: [], position: { x: 0, y: 0, width: 0, height: 0 } },
        },
      },
      teamB: {
        teamId: 'B',
        zones: {
          reserves: { id: 'r', name: 'Reserves', color: '', icon: '', maxCapacity: 16, players: [], position: { x: 0, y: 0, width: 0, height: 0 } },
          stunned: { id: 's', name: 'Stunned', color: '', icon: '', maxCapacity: 16, players: [], position: { x: 0, y: 0, width: 0, height: 0 } },
          knockedOut: { id: 'k', name: 'KO', color: '', icon: '', maxCapacity: 16, players: [], position: { x: 0, y: 0, width: 0, height: 0 } },
          casualty: { id: 'c', name: 'Casualty', color: '', icon: '', maxCapacity: 16, players: [], position: { x: 0, y: 0, width: 0, height: 0 } },
          sentOff: { id: 'so', name: 'Sent Off', color: '', icon: '', maxCapacity: 16, players: [], position: { x: 0, y: 0, width: 0, height: 0 } },
        },
      },
    },
    pendingBlock: undefined,
    pendingPushChoice: undefined,
    pendingFollowUpChoice: undefined,
    playerActions: {},
    teamBlitzCount: {},
    teamFoulCount: {},
    gamePhase: 'playing',
    half: 1,
    score: { teamA: 0, teamB: 0 },
    teamNames: { teamA: 'Team A', teamB: 'Team B' },
    teamRerolls: { teamA: 3, teamB: 3 },
    rerollUsedThisTurn: false,
    matchStats: {},
    casualtyResults: {},
    lastingInjuryDetails: {},
    gameLog: [],
    usedStarPlayerRules: {},
    bribesRemaining: { teamA: 0, teamB: 0 },
    turnTimerSeconds: 0,
    ...overrides,
  };
}

function makeTurnPayload(
  type: string,
  gameState: GameState,
  move?: Record<string, unknown>,
  timestamp?: string,
): ReplayTurnPayload {
  return {
    type,
    gameState,
    move,
    timestamp: timestamp ?? new Date().toISOString(),
  };
}

describe('Replay: buildReplayFrames', () => {
  it('returns empty array for empty turns', () => {
    const frames = buildReplayFrames([]);
    expect(frames).toEqual([]);
  });

  it('extracts frames from gameplay-move turns', () => {
    const gs1 = makeGameState({ turn: 1, score: { teamA: 0, teamB: 0 } });
    const gs2 = makeGameState({ turn: 2, score: { teamA: 1, teamB: 0 } });

    const turns: ReplayTurnPayload[] = [
      makeTurnPayload('start', gs1),
      makeTurnPayload('gameplay-move', gs2, { type: 'MOVE', playerId: 'p1', to: { x: 5, y: 5 } }),
    ];

    const frames = buildReplayFrames(turns);

    expect(frames.length).toBe(2);
    expect(frames[0].index).toBe(0);
    expect(frames[0].gameState.turn).toBe(1);
    expect(frames[0].moveType).toBeUndefined();
    expect(frames[1].index).toBe(1);
    expect(frames[1].gameState.turn).toBe(2);
    expect(frames[1].moveType).toBe('MOVE');
  });

  it('skips turns without gameState', () => {
    const gs1 = makeGameState({ turn: 1 });
    const gs2 = makeGameState({ turn: 3 });

    const turns: ReplayTurnPayload[] = [
      makeTurnPayload('start', gs1),
      { type: 'accept', timestamp: new Date().toISOString() } as unknown as ReplayTurnPayload,
      makeTurnPayload('gameplay-move', gs2, { type: 'END_TURN' }),
    ];

    const frames = buildReplayFrames(turns);

    expect(frames.length).toBe(2);
    expect(frames[0].gameState.turn).toBe(1);
    expect(frames[1].gameState.turn).toBe(3);
  });

  it('preserves frame order matching turn order', () => {
    const states = Array.from({ length: 5 }, (_, i) =>
      makeGameState({ turn: i + 1 }),
    );

    const turns: ReplayTurnPayload[] = states.map((gs, i) =>
      makeTurnPayload(i === 0 ? 'start' : 'gameplay-move', gs),
    );

    const frames = buildReplayFrames(turns);

    expect(frames.length).toBe(5);
    frames.forEach((f, i) => {
      expect(f.index).toBe(i);
      expect(f.gameState.turn).toBe(i + 1);
    });
  });

  it('extracts moveType from move payload', () => {
    const gs1 = makeGameState({ turn: 1 });
    const gs2 = makeGameState({ turn: 1 });
    const gs3 = makeGameState({ turn: 2 });

    const turns: ReplayTurnPayload[] = [
      makeTurnPayload('start', gs1),
      makeTurnPayload('gameplay-move', gs2, { type: 'BLOCK', playerId: 'p1', targetId: 'p2' }),
      makeTurnPayload('gameplay-move', gs3, { type: 'END_TURN' }),
    ];

    const frames = buildReplayFrames(turns);

    expect(frames[1].moveType).toBe('BLOCK');
    expect(frames[2].moveType).toBe('END_TURN');
  });

  it('includes timestamp on each frame', () => {
    const ts = '2026-04-10T12:00:00.000Z';
    const gs = makeGameState();
    const turns: ReplayTurnPayload[] = [
      makeTurnPayload('start', gs, undefined, ts),
    ];

    const frames = buildReplayFrames(turns);

    expect(frames[0].timestamp).toBe(ts);
  });

  it('handles string-encoded gameState (JSON)', () => {
    const gs = makeGameState({ turn: 5 });
    const turns: ReplayTurnPayload[] = [
      {
        type: 'start',
        gameState: JSON.stringify(gs) as unknown as GameState,
        timestamp: new Date().toISOString(),
      },
    ];

    const frames = buildReplayFrames(turns);

    expect(frames.length).toBe(1);
    expect(frames[0].gameState.turn).toBe(5);
  });
});
