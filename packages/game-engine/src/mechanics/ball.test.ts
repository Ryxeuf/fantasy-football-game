import { describe, it, expect } from 'vitest';
import { setup, makeRNG } from '../index';
import {
  isInOpponentEndzone,
  awardTouchdown,
  checkTouchdowns,
  getRandomDirection,
  dropBall,
} from './ball';
import type { GameState, Player } from '../core/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return a deep-cloned player with overridden fields. */
function withPlayer(state: GameState, id: string, overrides: Partial<Player>): GameState {
  return {
    ...state,
    players: state.players.map(p => (p.id === id ? { ...p, ...overrides } : p)),
  };
}

/** Return the player with the given id from state, or throw. */
function getPlayer(state: GameState, id: string): Player {
  const p = state.players.find(p => p.id === id);
  if (!p) throw new Error(`Player ${id} not found`);
  return p;
}

// ---------------------------------------------------------------------------
// isInOpponentEndzone
// ---------------------------------------------------------------------------

describe('isInOpponentEndzone', () => {
  it('returns true for team A player standing at x = width - 1', () => {
    const state = setup(); // 26 wide  → endzone at x = 25
    const player = getPlayer(state, 'A1');
    const playerAtEndzone = { ...player, pos: { x: state.width - 1, y: 7 } };

    expect(isInOpponentEndzone(state, playerAtEndzone)).toBe(true);
  });

  it('returns false for team A player NOT at x = width - 1', () => {
    const state = setup();
    const player = getPlayer(state, 'A1');
    // x = 11 (starting position) — not the endzone
    const playerNotAtEndzone = { ...player, pos: { x: 11, y: 7 } };

    expect(isInOpponentEndzone(state, playerNotAtEndzone)).toBe(false);
  });

  it('returns false for team A player at x = 0 (own endzone)', () => {
    const state = setup();
    const player = getPlayer(state, 'A1');
    const playerAtOwnEndzone = { ...player, pos: { x: 0, y: 7 } };

    expect(isInOpponentEndzone(state, playerAtOwnEndzone)).toBe(false);
  });

  it('returns true for team B player standing at x = 0', () => {
    const state = setup();
    const player = getPlayer(state, 'B1');
    const playerAtEndzone = { ...player, pos: { x: 0, y: 7 } };

    expect(isInOpponentEndzone(state, playerAtEndzone)).toBe(true);
  });

  it('returns false for team B player NOT at x = 0', () => {
    const state = setup();
    const player = getPlayer(state, 'B1');
    // x = 15 (starting position) — not the endzone
    const playerNotAtEndzone = { ...player, pos: { x: 15, y: 7 } };

    expect(isInOpponentEndzone(state, playerNotAtEndzone)).toBe(false);
  });

  it('returns false for team B player at x = width - 1 (own endzone)', () => {
    const state = setup();
    const player = getPlayer(state, 'B1');
    const playerAtOwnEndzone = { ...player, pos: { x: state.width - 1, y: 7 } };

    expect(isInOpponentEndzone(state, playerAtOwnEndzone)).toBe(false);
  });

  it('respects y-position (only x matters)', () => {
    const state = setup();
    const playerA = { ...getPlayer(state, 'A1'), pos: { x: state.width - 1, y: 0 } };
    const playerB = { ...getPlayer(state, 'B1'), pos: { x: 0, y: 14 } };

    expect(isInOpponentEndzone(state, playerA)).toBe(true);
    expect(isInOpponentEndzone(state, playerB)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// awardTouchdown
// ---------------------------------------------------------------------------

describe('awardTouchdown', () => {
  it('increments score for team A', () => {
    const state = setup();
    const next = awardTouchdown(state, 'A');

    expect(next.score.teamA).toBe(state.score.teamA + 1);
    expect(next.score.teamB).toBe(state.score.teamB);
  });

  it('increments score for team B', () => {
    const state = setup();
    const next = awardTouchdown(state, 'B');

    expect(next.score.teamB).toBe(state.score.teamB + 1);
    expect(next.score.teamA).toBe(state.score.teamA);
  });

  it('can increment score multiple times cumulatively', () => {
    let state = setup();
    state = awardTouchdown(state, 'A');
    state = awardTouchdown(state, 'A');

    expect(state.score.teamA).toBe(2);
    expect(state.score.teamB).toBe(0);
  });

  it('sets gamePhase to post-td', () => {
    const state = setup();
    const next = awardTouchdown(state, 'A');

    expect(next.gamePhase).toBe('post-td');
  });

  it('removes the ball (ball becomes undefined)', () => {
    const state = { ...setup(), ball: { x: 25, y: 7 } };
    const next = awardTouchdown(state, 'A');

    expect(next.ball).toBeUndefined();
  });

  it('sets hasBall=false on all players', () => {
    let state = setup();
    // Give A1 the ball
    state = withPlayer(state, 'A1', { hasBall: true });
    state = withPlayer(state, 'B1', { hasBall: false });

    const next = awardTouchdown(state, 'A');

    expect(next.players.every(p => !p.hasBall)).toBe(true);
  });

  it('increments scorer matchStats.touchdowns when scorer is provided', () => {
    const state = setup();
    const scorer = getPlayer(state, 'A1');
    const next = awardTouchdown(state, 'A', scorer);

    expect(next.matchStats[scorer.id]).toBeDefined();
    expect(next.matchStats[scorer.id].touchdowns).toBe(1);
  });

  it('accumulates scorer matchStats.touchdowns over multiple touchdowns', () => {
    let state = setup();
    const scorer = getPlayer(state, 'A1');

    state = awardTouchdown(state, 'A', scorer);
    state = awardTouchdown(state, 'A', scorer);

    expect(state.matchStats[scorer.id].touchdowns).toBe(2);
  });

  it('does not modify matchStats when no scorer is provided', () => {
    const state = setup();
    const next = awardTouchdown(state, 'A');

    expect(Object.keys(next.matchStats)).toHaveLength(0);
  });

  it('does NOT mutate the original state (immutability)', () => {
    const state = setup();
    const originalScore = { ...state.score };
    const originalPhase = state.gamePhase;
    const originalPlayers = state.players.map(p => ({ ...p }));

    awardTouchdown(state, 'A');

    // Original must be unchanged
    expect(state.score.teamA).toBe(originalScore.teamA);
    expect(state.score.teamB).toBe(originalScore.teamB);
    expect(state.gamePhase).toBe(originalPhase);
    state.players.forEach((p, i) => {
      expect(p.hasBall).toBe(originalPlayers[i].hasBall);
    });
  });

  it('adds a log entry for the touchdown', () => {
    const state = setup();
    const logLengthBefore = state.gameLog.length;
    const next = awardTouchdown(state, 'A');

    expect(next.gameLog.length).toBeGreaterThan(logLengthBefore);
  });
});

// ---------------------------------------------------------------------------
// checkTouchdowns
// ---------------------------------------------------------------------------

describe('checkTouchdowns', () => {
  it('returns unchanged state when no player has the ball', () => {
    const state = setup(); // all players start with hasBall=false

    const next = checkTouchdowns(state);

    expect(next).toBe(state); // exact same reference — no touchdown
  });

  it('returns unchanged state when player has ball but is NOT in endzone', () => {
    let state = setup();
    // A1 has ball at x=11, far from endzone at x=25
    state = withPlayer(state, 'A1', { hasBall: true, pos: { x: 11, y: 7 } });

    const next = checkTouchdowns(state);

    expect(next.score.teamA).toBe(0);
    expect(next.gamePhase).toBe('playing');
  });

  it('returns unchanged state when stunned player with ball is in endzone', () => {
    let state = setup();
    state = withPlayer(state, 'A1', {
      hasBall: true,
      stunned: true,
      pos: { x: state.width - 1, y: 7 },
    });

    const next = checkTouchdowns(state);

    // Stunned player cannot score
    expect(next.gamePhase).toBe('playing');
  });

  it('awards touchdown when team A player has ball in opponent endzone', () => {
    let state = setup();
    state = withPlayer(state, 'A1', { hasBall: true, pos: { x: state.width - 1, y: 7 } });

    const next = checkTouchdowns(state);

    expect(next.score.teamA).toBe(1);
    expect(next.gamePhase).toBe('post-td');
  });

  it('awards touchdown when team B player has ball in opponent endzone', () => {
    let state = setup();
    state = withPlayer(state, 'B1', { hasBall: true, pos: { x: 0, y: 7 } });

    const next = checkTouchdowns(state);

    expect(next.score.teamB).toBe(1);
    expect(next.gamePhase).toBe('post-td');
  });

  it('does not score when team A player is at x=0 (own endzone) with ball', () => {
    let state = setup();
    state = withPlayer(state, 'A1', { hasBall: true, pos: { x: 0, y: 7 } });

    const next = checkTouchdowns(state);

    expect(next.score.teamA).toBe(0);
    expect(next.gamePhase).toBe('playing');
  });

  it('does not score when team B player is at x=width-1 (own endzone) with ball', () => {
    let state = setup();
    state = withPlayer(state, 'B1', { hasBall: true, pos: { x: state.width - 1, y: 7 } });

    const next = checkTouchdowns(state);

    expect(next.score.teamB).toBe(0);
    expect(next.gamePhase).toBe('playing');
  });
});

// ---------------------------------------------------------------------------
// getRandomDirection
// ---------------------------------------------------------------------------

describe('getRandomDirection', () => {
  it('returns {x:0, y:-1} for RNG producing value in [0, 1/8) → direction 1 (North)', () => {
    // value 0.0 → floor(0 * 8) + 1 = 1
    const rng = () => 0.0;
    expect(getRandomDirection(rng)).toEqual({ x: 0, y: -1 });
  });

  it('returns {x:1, y:-1} for direction 2 (North-East)', () => {
    // value just below 2/8 = 0.25 → floor(0.2 * 8) + 1 = 2
    const rng = () => 0.2;
    expect(getRandomDirection(rng)).toEqual({ x: 1, y: -1 });
  });

  it('returns {x:1, y:0} for direction 3 (East)', () => {
    const rng = () => 0.3;
    expect(getRandomDirection(rng)).toEqual({ x: 1, y: 0 });
  });

  it('returns {x:1, y:1} for direction 4 (South-East)', () => {
    const rng = () => 0.4;
    expect(getRandomDirection(rng)).toEqual({ x: 1, y: 1 });
  });

  it('returns {x:0, y:1} for direction 5 (South)', () => {
    const rng = () => 0.5 + 0.01;
    expect(getRandomDirection(rng)).toEqual({ x: 0, y: 1 });
  });

  it('returns {x:-1, y:1} for direction 6 (South-West)', () => {
    const rng = () => 0.7;
    expect(getRandomDirection(rng)).toEqual({ x: -1, y: 1 });
  });

  it('returns {x:-1, y:0} for direction 7 (West)', () => {
    const rng = () => 0.8;
    expect(getRandomDirection(rng)).toEqual({ x: -1, y: 0 });
  });

  it('returns {x:-1, y:-1} for direction 8 (North-West)', () => {
    const rng = () => 0.9;
    expect(getRandomDirection(rng)).toEqual({ x: -1, y: -1 });
  });

  it('returns 8 distinct directions covering all compass points', () => {
    const triggers = [0.0, 0.2, 0.3, 0.4, 0.51, 0.7, 0.8, 0.9];
    const directions = triggers.map(v => getRandomDirection(() => v));
    const unique = new Set(directions.map(d => `${d.x},${d.y}`));

    expect(unique.size).toBe(8);
  });

  it('every returned direction has x and y components each in {-1, 0, 1}', () => {
    const validComponents = new Set([-1, 0, 1]);
    const triggers = [0.0, 0.2, 0.3, 0.4, 0.51, 0.7, 0.8, 0.9];

    triggers.forEach(v => {
      const dir = getRandomDirection(() => v);
      expect(validComponents.has(dir.x)).toBe(true);
      expect(validComponents.has(dir.y)).toBe(true);
    });
  });

  it('is deterministic for the same seed-based RNG', () => {
    const rng1 = makeRNG('direction-seed');
    const rng2 = makeRNG('direction-seed');

    const dir1 = getRandomDirection(rng1);
    const dir2 = getRandomDirection(rng2);

    expect(dir1).toEqual(dir2);
  });

  it('never returns a zero-zero direction (ball must move)', () => {
    // All 8 triggers should yield a non-zero vector
    const triggers = [0.0, 0.2, 0.3, 0.4, 0.51, 0.7, 0.8, 0.9];
    triggers.forEach(v => {
      const { x, y } = getRandomDirection(() => v);
      expect(x !== 0 || y !== 0).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// dropBall
// ---------------------------------------------------------------------------

describe('dropBall', () => {
  it('places ball at the position of the player who had it', () => {
    let state = setup();
    const playerPos = { x: 10, y: 5 };
    state = withPlayer(state, 'A1', { hasBall: true, pos: playerPos });

    const next = dropBall(state);

    expect(next.ball).toEqual(playerPos);
  });

  it('removes hasBall from the player who dropped the ball', () => {
    let state = setup();
    state = withPlayer(state, 'A1', { hasBall: true, pos: { x: 10, y: 5 } });

    const next = dropBall(state);

    const player = getPlayer(next, 'A1');
    expect(player.hasBall).toBe(false);
  });

  it('returns unchanged state reference when no player has the ball', () => {
    const state = setup(); // all hasBall=false by default

    const next = dropBall(state);

    expect(next).toBe(state);
  });

  it('does not affect other players hasBall when dropping', () => {
    let state = setup();
    state = withPlayer(state, 'A1', { hasBall: true, pos: { x: 10, y: 5 } });
    // B1 explicitly false
    state = withPlayer(state, 'B1', { hasBall: false });

    const next = dropBall(state);

    const b1 = getPlayer(next, 'B1');
    expect(b1.hasBall).toBe(false);
  });

  it('does NOT mutate the original state (immutability)', () => {
    let state = setup();
    state = withPlayer(state, 'A1', { hasBall: true, pos: { x: 10, y: 5 } });
    const originalBall = state.ball;
    const originalHasBall = getPlayer(state, 'A1').hasBall;

    dropBall(state);

    // Original must be unchanged
    expect(state.ball).toBe(originalBall);
    expect(getPlayer(state, 'A1').hasBall).toBe(originalHasBall);
  });

  it('handles team B player dropping the ball', () => {
    let state = setup();
    const playerPos = { x: 2, y: 3 };
    state = withPlayer(state, 'B1', { hasBall: true, pos: playerPos });

    const next = dropBall(state);

    expect(next.ball).toEqual(playerPos);
    expect(getPlayer(next, 'B1').hasBall).toBe(false);
  });

  it('ball position is a new object, not a reference to player.pos', () => {
    let state = setup();
    const playerPos = { x: 7, y: 4 };
    state = withPlayer(state, 'A1', { hasBall: true, pos: playerPos });

    const next = dropBall(state);

    // Mutating the source position should not affect ball
    expect(next.ball).toEqual({ x: 7, y: 4 });
    expect(next.ball).not.toBe(getPlayer(state, 'A1').pos);
  });
});
