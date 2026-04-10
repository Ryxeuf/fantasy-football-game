import { describe, it, expect } from 'vitest';
import { setup } from '../core/game-state';
import { applyMove, getLegalMoves } from '../actions/actions';
import { makeRNG } from '../utils/rng';
import { KICKOFF_EVENTS, applyKickoffEvent } from './kickoff-events';
import {
  resolveKickoffPerfectDefence,
  resolveKickoffHighKick,
  resolveKickoffQuickSnap,
  resolveKickoffBlitz,
} from './kickoff-resolution';
import type { GameState, Position } from '../core/types';

/**
 * Helper: creates a game state with players placed on the pitch and a kickoff context.
 * Team A kicks (left half x=1..12), Team B receives (right half x=13..24).
 */
function createKickoffState(overrides?: Partial<GameState>): GameState {
  const base = setup();
  return {
    ...base,
    gamePhase: 'playing' as const,
    half: 1,
    turn: 1,
    kickingTeam: 'A',
    currentPlayer: 'B', // Receiving team plays first
    ball: { x: 18, y: 7 }, // Ball on receiving side
    ...overrides,
  };
}

describe('Regle: Kickoff Event — Perfect Defence', () => {
  it('sets pendingKickoffEvent when applied', () => {
    const state = createKickoffState();
    const event = KICKOFF_EVENTS[4]; // Perfect Defence
    const rng = makeRNG('perfect-defence-test');
    const result = applyKickoffEvent(state, event, rng, 'A');

    expect(result.pendingKickoffEvent).toBeDefined();
    expect(result.pendingKickoffEvent!.type).toBe('perfect-defence');
    expect(result.pendingKickoffEvent!.team).toBe('A'); // kicking team rearranges
  });

  it('resolves: allows kicking team to rearrange players on their half', () => {
    const state = createKickoffState({
      pendingKickoffEvent: { type: 'perfect-defence', team: 'A' },
    });

    // Move team A players to new valid positions on their half
    const newPositions = [
      { playerId: 'A1', position: { x: 5, y: 3 } },
      { playerId: 'A2', position: { x: 8, y: 10 } },
    ];
    const result = resolveKickoffPerfectDefence(state, newPositions);

    expect(result.pendingKickoffEvent).toBeUndefined();
    const a1 = result.players.find(p => p.id === 'A1');
    const a2 = result.players.find(p => p.id === 'A2');
    expect(a1!.pos).toEqual({ x: 5, y: 3 });
    expect(a2!.pos).toEqual({ x: 8, y: 10 });
  });

  it('resolves: rejects positions on the opponent half', () => {
    const state = createKickoffState({
      pendingKickoffEvent: { type: 'perfect-defence', team: 'A' },
    });

    // Try to place team A player on team B half (x >= 13)
    const newPositions = [
      { playerId: 'A1', position: { x: 18, y: 7 } }, // B's half
    ];
    const result = resolveKickoffPerfectDefence(state, newPositions);

    // Should remain unchanged (invalid move)
    expect(result.pendingKickoffEvent).toBeDefined();
    const a1 = result.players.find(p => p.id === 'A1');
    expect(a1!.pos).toEqual(state.players.find(p => p.id === 'A1')!.pos);
  });

  it('resolves: rejects positions out of bounds', () => {
    const state = createKickoffState({
      pendingKickoffEvent: { type: 'perfect-defence', team: 'A' },
    });

    const newPositions = [
      { playerId: 'A1', position: { x: -1, y: 7 } }, // out of bounds
    ];
    const result = resolveKickoffPerfectDefence(state, newPositions);

    // Should remain unchanged
    expect(result.pendingKickoffEvent).toBeDefined();
  });

  it('resolves: rejects overlapping positions', () => {
    const state = createKickoffState({
      pendingKickoffEvent: { type: 'perfect-defence', team: 'A' },
    });

    // Both A players on same position
    const newPositions = [
      { playerId: 'A1', position: { x: 5, y: 5 } },
      { playerId: 'A2', position: { x: 5, y: 5 } },
    ];
    const result = resolveKickoffPerfectDefence(state, newPositions);

    // Should remain unchanged
    expect(result.pendingKickoffEvent).toBeDefined();
  });

  it('resolves: does not move opponent players', () => {
    const state = createKickoffState({
      pendingKickoffEvent: { type: 'perfect-defence', team: 'A' },
    });

    const b1Before = state.players.find(p => p.id === 'B1')!;
    const newPositions = [
      { playerId: 'A1', position: { x: 5, y: 3 } },
    ];
    const result = resolveKickoffPerfectDefence(state, newPositions);

    const b1After = result.players.find(p => p.id === 'B1')!;
    expect(b1After.pos).toEqual(b1Before.pos);
  });
});

describe('Regle: Kickoff Event — High Kick', () => {
  it('sets pendingKickoffEvent when applied', () => {
    const state = createKickoffState();
    const event = KICKOFF_EVENTS[5]; // High Kick
    const rng = makeRNG('high-kick-test');
    const result = applyKickoffEvent(state, event, rng, 'A');

    expect(result.pendingKickoffEvent).toBeDefined();
    expect(result.pendingKickoffEvent!.type).toBe('high-kick');
    expect(result.pendingKickoffEvent!.team).toBe('B'); // receiving team
  });

  it('resolves: moves chosen player under the ball', () => {
    const ballPos = { x: 18, y: 7 };
    const state = createKickoffState({
      ball: ballPos,
      pendingKickoffEvent: { type: 'high-kick', team: 'B', ballPosition: ballPos },
    });

    // B2 is far from opponents, can be moved under ball
    const result = resolveKickoffHighKick(state, 'B2');

    expect(result.pendingKickoffEvent).toBeUndefined();
    const b2 = result.players.find(p => p.id === 'B2')!;
    expect(b2.pos).toEqual(ballPos);
  });

  it('resolves: skipping (null playerId) clears pending state', () => {
    const ballPos = { x: 18, y: 7 };
    const state = createKickoffState({
      ball: ballPos,
      pendingKickoffEvent: { type: 'high-kick', team: 'B', ballPosition: ballPos },
    });

    const result = resolveKickoffHighKick(state, null);

    expect(result.pendingKickoffEvent).toBeUndefined();
    // No player should have moved
    for (const p of result.players) {
      const orig = state.players.find(o => o.id === p.id)!;
      expect(p.pos).toEqual(orig.pos);
    }
  });

  it('resolves: rejects player in enemy tackle zone', () => {
    // Place B1 adjacent to A1 so B1 is in a tackle zone
    const state = createKickoffState({
      ball: { x: 20, y: 7 },
      pendingKickoffEvent: { type: 'high-kick', team: 'B', ballPosition: { x: 20, y: 7 } },
      players: [
        ...setup().players.map(p => {
          if (p.id === 'A1') return { ...p, pos: { x: 14, y: 7 } };
          if (p.id === 'B1') return { ...p, pos: { x: 15, y: 7 } }; // adjacent to A1
          return p;
        }),
      ],
    });

    const result = resolveKickoffHighKick(state, 'B1');

    // B1 is in a tackle zone, so it should be rejected
    expect(result.pendingKickoffEvent).toBeDefined();
  });

  it('resolves: rejects player from wrong team', () => {
    const ballPos = { x: 18, y: 7 };
    const state = createKickoffState({
      ball: ballPos,
      pendingKickoffEvent: { type: 'high-kick', team: 'B', ballPosition: ballPos },
    });

    // Trying to select an A team player should be rejected
    const result = resolveKickoffHighKick(state, 'A1');

    expect(result.pendingKickoffEvent).toBeDefined();
  });
});

describe('Regle: Kickoff Event — Quick Snap', () => {
  it('sets pendingKickoffEvent when applied', () => {
    const state = createKickoffState();
    const event = KICKOFF_EVENTS[9]; // Quick Snap
    const rng = makeRNG('quick-snap-test');
    const result = applyKickoffEvent(state, event, rng, 'A');

    expect(result.pendingKickoffEvent).toBeDefined();
    expect(result.pendingKickoffEvent!.type).toBe('quick-snap');
    expect(result.pendingKickoffEvent!.team).toBe('B'); // receiving team
  });

  it('resolves: moves receiving team players 1 square each', () => {
    const state = createKickoffState({
      pendingKickoffEvent: { type: 'quick-snap', team: 'B' },
    });

    const b1 = state.players.find(p => p.id === 'B1')!;
    const b2 = state.players.find(p => p.id === 'B2')!;

    const moves = [
      { playerId: 'B1', to: { x: b1.pos.x + 1, y: b1.pos.y } },
      { playerId: 'B2', to: { x: b2.pos.x, y: b2.pos.y + 1 } },
    ];
    const result = resolveKickoffQuickSnap(state, moves);

    expect(result.pendingKickoffEvent).toBeUndefined();
    expect(result.players.find(p => p.id === 'B1')!.pos).toEqual(moves[0].to);
    expect(result.players.find(p => p.id === 'B2')!.pos).toEqual(moves[1].to);
  });

  it('resolves: rejects moves > 1 square', () => {
    const state = createKickoffState({
      pendingKickoffEvent: { type: 'quick-snap', team: 'B' },
    });

    const b1 = state.players.find(p => p.id === 'B1')!;
    const moves = [
      { playerId: 'B1', to: { x: b1.pos.x + 2, y: b1.pos.y } }, // 2 squares
    ];
    const result = resolveKickoffQuickSnap(state, moves);

    // Should remain unchanged
    expect(result.pendingKickoffEvent).toBeDefined();
  });

  it('resolves: rejects moves out of bounds', () => {
    const state = createKickoffState({
      pendingKickoffEvent: { type: 'quick-snap', team: 'B' },
      players: setup().players.map(p => {
        if (p.id === 'B1') return { ...p, pos: { x: 25, y: 7 } }; // edge of board
        return p;
      }),
    });

    const moves = [
      { playerId: 'B1', to: { x: 26, y: 7 } }, // out of bounds
    ];
    const result = resolveKickoffQuickSnap(state, moves);

    expect(result.pendingKickoffEvent).toBeDefined();
  });

  it('resolves: rejects moves into occupied squares', () => {
    const state = createKickoffState({
      pendingKickoffEvent: { type: 'quick-snap', team: 'B' },
      players: setup().players.map(p => {
        if (p.id === 'B1') return { ...p, pos: { x: 16, y: 7 } };
        if (p.id === 'B2') return { ...p, pos: { x: 17, y: 7 } };
        return p;
      }),
    });

    // B1 tries to move into B2's square
    const moves = [
      { playerId: 'B1', to: { x: 17, y: 7 } },
    ];
    const result = resolveKickoffQuickSnap(state, moves);

    expect(result.pendingKickoffEvent).toBeDefined();
  });

  it('resolves: empty moves array clears pending state', () => {
    const state = createKickoffState({
      pendingKickoffEvent: { type: 'quick-snap', team: 'B' },
    });

    const result = resolveKickoffQuickSnap(state, []);

    expect(result.pendingKickoffEvent).toBeUndefined();
  });

  it('resolves: rejects wrong team player moves', () => {
    const state = createKickoffState({
      pendingKickoffEvent: { type: 'quick-snap', team: 'B' },
    });

    const a1 = state.players.find(p => p.id === 'A1')!;
    const moves = [
      { playerId: 'A1', to: { x: a1.pos.x + 1, y: a1.pos.y } },
    ];
    const result = resolveKickoffQuickSnap(state, moves);

    expect(result.pendingKickoffEvent).toBeDefined();
  });
});

describe('Regle: Kickoff Event — Blitz', () => {
  it('sets pendingKickoffEvent when applied', () => {
    const state = createKickoffState();
    const event = KICKOFF_EVENTS[10]; // Blitz
    const rng = makeRNG('blitz-test');
    const result = applyKickoffEvent(state, event, rng, 'A');

    expect(result.pendingKickoffEvent).toBeDefined();
    expect(result.pendingKickoffEvent!.type).toBe('blitz');
    expect(result.pendingKickoffEvent!.team).toBe('A'); // kicking team gets the blitz
  });

  it('resolves: activates kicking team turn with restrictions', () => {
    const state = createKickoffState({
      pendingKickoffEvent: { type: 'blitz', team: 'A' },
      currentPlayer: 'B', // receiving team was set as current
    });

    const result = resolveKickoffBlitz(state);

    expect(result.pendingKickoffEvent).toBeUndefined();
    expect(result.kickoffBlitzTurn).toBe(true);
    expect(result.currentPlayer).toBe('A'); // kicking team now plays
  });

  it('resolves: logs the blitz activation', () => {
    const state = createKickoffState({
      pendingKickoffEvent: { type: 'blitz', team: 'A' },
    });

    const result = resolveKickoffBlitz(state);

    const blitzLogs = result.gameLog.filter(l =>
      l.message.toLowerCase().includes('blitz')
    );
    expect(blitzLogs.length).toBeGreaterThan(0);
  });
});

describe('Regle: Kickoff Events — Integration with applyMove', () => {
  it('applyMove resolves perfect defence via KICKOFF_PERFECT_DEFENCE', () => {
    const state = createKickoffState({
      pendingKickoffEvent: { type: 'perfect-defence', team: 'A' },
    });
    const rng = makeRNG('integration-pd');

    const result = applyMove(state, {
      type: 'KICKOFF_PERFECT_DEFENCE',
      positions: [
        { playerId: 'A1', position: { x: 6, y: 3 } },
        { playerId: 'A2', position: { x: 8, y: 10 } },
      ],
    }, rng);

    expect(result.pendingKickoffEvent).toBeUndefined();
    expect(result.players.find(p => p.id === 'A1')!.pos).toEqual({ x: 6, y: 3 });
  });

  it('applyMove resolves high kick via KICKOFF_HIGH_KICK', () => {
    const ballPos = { x: 18, y: 7 };
    const state = createKickoffState({
      ball: ballPos,
      pendingKickoffEvent: { type: 'high-kick', team: 'B', ballPosition: ballPos },
    });
    const rng = makeRNG('integration-hk');

    const result = applyMove(state, {
      type: 'KICKOFF_HIGH_KICK',
      playerId: 'B2',
    }, rng);

    expect(result.pendingKickoffEvent).toBeUndefined();
    expect(result.players.find(p => p.id === 'B2')!.pos).toEqual(ballPos);
  });

  it('applyMove resolves quick snap via KICKOFF_QUICK_SNAP', () => {
    const state = createKickoffState({
      pendingKickoffEvent: { type: 'quick-snap', team: 'B' },
    });
    const rng = makeRNG('integration-qs');
    const b1 = state.players.find(p => p.id === 'B1')!;

    // Move B1 one square up (y-1) to avoid collision with B2
    const result = applyMove(state, {
      type: 'KICKOFF_QUICK_SNAP',
      moves: [{ playerId: 'B1', to: { x: b1.pos.x, y: b1.pos.y - 1 } }],
    }, rng);

    expect(result.pendingKickoffEvent).toBeUndefined();
  });

  it('applyMove resolves blitz via KICKOFF_BLITZ_RESOLVE', () => {
    const state = createKickoffState({
      pendingKickoffEvent: { type: 'blitz', team: 'A' },
    });
    const rng = makeRNG('integration-blitz');

    const result = applyMove(state, {
      type: 'KICKOFF_BLITZ_RESOLVE',
    }, rng);

    expect(result.pendingKickoffEvent).toBeUndefined();
    expect(result.kickoffBlitzTurn).toBe(true);
    expect(result.currentPlayer).toBe('A');
  });

  it('blocks normal moves when pendingKickoffEvent is set', () => {
    const state = createKickoffState({
      pendingKickoffEvent: { type: 'quick-snap', team: 'B' },
    });
    const rng = makeRNG('block-test');

    // Try a regular MOVE — should be blocked
    const result = applyMove(state, {
      type: 'MOVE',
      playerId: 'B1',
      to: { x: 16, y: 7 },
    }, rng);

    // State should be unchanged
    expect(result.pendingKickoffEvent).toBeDefined();
  });

  it('blocks PASS and HANDOFF during kickoff blitz turn', () => {
    const state = createKickoffState({
      kickoffBlitzTurn: true,
      currentPlayer: 'A',
      players: setup().players.map(p => {
        if (p.id === 'A1') return { ...p, hasBall: true, pos: { x: 11, y: 7 } };
        return p;
      }),
    });
    const rng = makeRNG('blitz-pass-block');

    // Try a PASS — should be blocked during blitz kickoff turn
    const passResult = applyMove(state, {
      type: 'PASS',
      playerId: 'A1',
      targetId: 'A2',
    }, rng);

    // State should be unchanged (same reference since PASS was blocked)
    expect(passResult).toBe(state);

    // Try a HANDOFF — should also be blocked
    const handoffResult = applyMove(state, {
      type: 'HANDOFF',
      playerId: 'A1',
      targetId: 'A2',
    }, rng);

    expect(handoffResult).toBe(state);
  });

  it('END_TURN during blitz turn restores receiving team control', () => {
    const state = createKickoffState({
      kickoffBlitzTurn: true,
      currentPlayer: 'A',
      kickingTeam: 'A',
    });
    const rng = makeRNG('blitz-end');

    const result = applyMove(state, { type: 'END_TURN' }, rng);

    expect(result.kickoffBlitzTurn).toBeUndefined();
    expect(result.currentPlayer).toBe('B'); // receiving team takes over
  });

  it('getLegalMoves returns kickoff moves when pendingKickoffEvent is set', () => {
    const state = createKickoffState({
      pendingKickoffEvent: { type: 'quick-snap', team: 'B' },
    });

    const moves = getLegalMoves(state);
    expect(moves.length).toBe(1);
    expect(moves[0].type).toBe('KICKOFF_QUICK_SNAP');
  });

  it('getLegalMoves excludes PASS/HANDOFF during blitz turn', () => {
    const state = createKickoffState({
      kickoffBlitzTurn: true,
      currentPlayer: 'A',
      players: setup().players.map(p => {
        if (p.id === 'A1') return { ...p, hasBall: true, pos: { x: 11, y: 7 } };
        return p;
      }),
    });

    const moves = getLegalMoves(state);
    const passMoves = moves.filter(m => m.type === 'PASS');
    const handoffMoves = moves.filter(m => m.type === 'HANDOFF');
    expect(passMoves.length).toBe(0);
    expect(handoffMoves.length).toBe(0);
  });
});
