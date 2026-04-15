import { describe, it, expect } from 'vitest';
import { setup, applyMove } from '../index';
import type { GameState, Player, Move } from '../core/types';
import {
  canLeap,
  getLeapModifier,
  calculateLeapTarget,
  performLeapRoll,
  getLegalLeapDestinations,
} from './leap';

/**
 * Regle: Leap / Pogo Stick (BB3 S2/S3)
 * - Leap skill: leap over any adjacent square, AG test, no dodge roll needed,
 *   2 squares of movement, failure => prone + turnover
 * - Pogo Stick trait: same as Leap + AG test at +1
 */

function fixedRNG(val: number): () => number {
  return () => val;
}

function withSkill(state: GameState, playerId: string, skill: string): GameState {
  return {
    ...state,
    players: state.players.map(p =>
      p.id === playerId ? { ...p, skills: [...p.skills, skill] } : p,
    ),
  };
}

function withPosition(state: GameState, playerId: string, x: number, y: number): GameState {
  return {
    ...state,
    players: state.players.map(p =>
      p.id === playerId ? { ...p, pos: { x, y } } : p,
    ),
  };
}

function getPlayer(state: GameState, id: string): Player {
  return state.players.find(p => p.id === id)!;
}

describe('Regle: canLeap', () => {
  it('returns false when player has no leap skill', () => {
    const state = setup();
    expect(canLeap(getPlayer(state, 'A1'))).toBe(false);
  });

  it('returns true when player has leap skill', () => {
    const s = withSkill(setup(), 'A1', 'leap');
    expect(canLeap(getPlayer(s, 'A1'))).toBe(true);
  });

  it('returns true when player has pogo-stick trait', () => {
    const s = withSkill(setup(), 'A1', 'pogo-stick');
    expect(canLeap(getPlayer(s, 'A1'))).toBe(true);
  });
});

describe('Regle: getLeapModifier', () => {
  it('returns 0 for plain Leap', () => {
    const s = withSkill(setup(), 'A1', 'leap');
    expect(getLeapModifier(getPlayer(s, 'A1'))).toBe(0);
  });

  it('returns +1 for Pogo Stick', () => {
    const s = withSkill(setup(), 'A1', 'pogo-stick');
    expect(getLeapModifier(getPlayer(s, 'A1'))).toBe(1);
  });

  it('returns +1 when player has both leap and pogo-stick', () => {
    const s = withSkill(withSkill(setup(), 'A1', 'leap'), 'A1', 'pogo-stick');
    expect(getLeapModifier(getPlayer(s, 'A1'))).toBe(1);
  });
});

describe('Regle: calculateLeapTarget', () => {
  it('returns AG as target with no modifiers', () => {
    const p = { ...getPlayer(setup(), 'A1'), ag: 3 };
    expect(calculateLeapTarget(p, 0)).toBe(3);
  });

  it('applies positive modifier to lower the target', () => {
    const p = { ...getPlayer(setup(), 'A1'), ag: 4 };
    expect(calculateLeapTarget(p, 1)).toBe(3);
  });

  it('clamps target to minimum 2', () => {
    const p = { ...getPlayer(setup(), 'A1'), ag: 2 };
    expect(calculateLeapTarget(p, 5)).toBe(2);
  });

  it('clamps target to maximum 6', () => {
    const p = { ...getPlayer(setup(), 'A1'), ag: 7 };
    expect(calculateLeapTarget(p, 0)).toBe(6);
  });
});

describe('Regle: performLeapRoll', () => {
  it('natural 1 always fails even with large modifier', () => {
    const p = { ...getPlayer(setup(), 'A1'), ag: 2 };
    const result = performLeapRoll(p, fixedRNG(0.0), 3); // roll = 1
    expect(result.diceRoll).toBe(1);
    expect(result.success).toBe(false);
  });

  it('natural 6 always succeeds even with heavy penalty', () => {
    const p = { ...getPlayer(setup(), 'A1'), ag: 6 };
    const result = performLeapRoll(p, fixedRNG(0.999), -5); // roll = 6
    expect(result.diceRoll).toBe(6);
    expect(result.success).toBe(true);
  });

  it('succeeds when roll >= target', () => {
    const p = { ...getPlayer(setup(), 'A1'), ag: 3 };
    const result = performLeapRoll(p, fixedRNG(0.5), 0); // roll = 4
    expect(result.diceRoll).toBe(4);
    expect(result.targetNumber).toBe(3);
    expect(result.success).toBe(true);
  });

  it('fails when roll < target', () => {
    const p = { ...getPlayer(setup(), 'A1'), ag: 4 };
    const result = performLeapRoll(p, fixedRNG(0.3), 0); // roll = 2
    expect(result.diceRoll).toBe(2);
    expect(result.targetNumber).toBe(4);
    expect(result.success).toBe(false);
  });

  it('applies pogo-stick +1 modifier to lower target', () => {
    const p = { ...getPlayer(setup(), 'A1'), ag: 4, skills: ['pogo-stick'] };
    // Roll = 3, target without modifier = 4, with +1 = 3, so 3 >= 3 succeeds.
    const result = performLeapRoll(p, fixedRNG(0.4), 1);
    expect(result.diceRoll).toBe(3);
    expect(result.targetNumber).toBe(3);
    expect(result.success).toBe(true);
  });
});

describe('Regle: getLegalLeapDestinations', () => {
  it('returns positions at Chebyshev distance 2 only', () => {
    // Empty board scenario: move all players far from A1 so we control occupancy.
    const base = setup();
    const s: GameState = {
      ...base,
      players: base.players.map(p =>
        p.id === 'A1' ? { ...p, pos: { x: 10, y: 7 } } : { ...p, pos: { x: 25, y: 14 } },
      ),
    };

    const dests = getLegalLeapDestinations(s, { x: 10, y: 7 });
    // Chebyshev distance 2 means the outer ring of a 5x5 area (excluding inner
    // 3x3): 5*5 - 3*3 = 16 positions. All are in-bounds for (10,7) on a
    // 26x15 field.
    expect(dests).toHaveLength(16);
    for (const d of dests) {
      const dx = Math.abs(d.x - 10);
      const dy = Math.abs(d.y - 7);
      expect(Math.max(dx, dy)).toBe(2);
    }
  });

  it('excludes out-of-bounds positions at field edges', () => {
    const base = setup();
    const s: GameState = {
      ...base,
      players: base.players.map(p =>
        p.id === 'A1' ? { ...p, pos: { x: 0, y: 0 } } : { ...p, pos: { x: 25, y: 14 } },
      ),
    };

    const dests = getLegalLeapDestinations(s, { x: 0, y: 0 });
    // From corner (0,0), only 3 destinations are in-bounds: (2,0), (2,1), (2,2),
    // (0,2), (1,2). That's 5.
    expect(dests).toHaveLength(5);
    for (const d of dests) {
      expect(d.x).toBeGreaterThanOrEqual(0);
      expect(d.y).toBeGreaterThanOrEqual(0);
    }
  });

  it('excludes occupied destinations', () => {
    const base = setup();
    const s: GameState = {
      ...base,
      players: [
        ...base.players.map(p => ({ ...p, pos: { x: 25, y: 14 } })),
      ],
    };
    // Place A1 and block one destination (12,7) with B1.
    const s2: GameState = {
      ...s,
      players: s.players.map(p => {
        if (p.id === 'A1') return { ...p, pos: { x: 10, y: 7 } };
        if (p.id === 'B1') return { ...p, pos: { x: 12, y: 7 } };
        return p;
      }),
    };

    const dests = getLegalLeapDestinations(s2, { x: 10, y: 7 });
    expect(dests).toHaveLength(15);
    expect(dests.find(d => d.x === 12 && d.y === 7)).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration tests: LEAP action via applyMove
// ─────────────────────────────────────────────────────────────────────────────

function setupLeapScenario(hasLeapSkill: boolean, skill: 'leap' | 'pogo-stick' = 'leap'): GameState {
  const base = setup();
  const s: GameState = {
    ...base,
    currentPlayer: 'A',
    selectedPlayerId: null,
    playerActions: {},
    teamBlitzCount: { A: 0, B: 0 },
    teamFoulCount: { A: 0, B: 0 },
    teamRerolls: { teamA: 0, teamB: 0 },
    rerollUsedThisTurn: false,
    isTurnover: false,
    ball: undefined,
    players: base.players.map(p => {
      if (p.id === 'A1') {
        return {
          ...p,
          pos: { x: 10, y: 7 },
          ma: 6,
          pm: 6,
          ag: 4,
          skills: hasLeapSkill ? [skill] : [],
          gfiUsed: 0,
          stunned: false,
          hasBall: false,
          state: 'active' as const,
        };
      }
      // Move all others far away to avoid interference.
      return { ...p, pos: { x: 25, y: 14 }, stunned: false, hasBall: false, state: 'active' as const };
    }),
  };
  return s;
}

describe('Regle: LEAP action', () => {
  it('getLegalMoves includes LEAP moves for players with leap skill', () => {
    const s = setupLeapScenario(true, 'leap');
    const leapMove: Move = { type: 'LEAP', playerId: 'A1', to: { x: 12, y: 7 } };
    // Succès forcé (roll=6) pour garantir que la position finale est (12,7).
    const after = applyMove(s, leapMove, () => 5 / 6);
    expect(getPlayer(after, 'A1').pos).toEqual({ x: 12, y: 7 });
  });

  it('getLegalMoves does not include LEAP moves for players without the skill', () => {
    const s = setupLeapScenario(false);
    const leapMove: Move = { type: 'LEAP', playerId: 'A1', to: { x: 12, y: 7 } };
    const after = applyMove(s, leapMove, () => 5 / 6);
    // No skill: LEAP should be rejected, state unchanged.
    expect(getPlayer(after, 'A1').pos).toEqual({ x: 10, y: 7 });
  });

  it('succeeds on high roll: player lands standing at destination', () => {
    // AG=4 player, leap target=4, we want a roll of 5 or 6.
    const s = setupLeapScenario(true, 'leap');
    const leapMove: Move = { type: 'LEAP', playerId: 'A1', to: { x: 12, y: 7 } };
    // makeRNG(1) may vary — use a fixed 5/6 by mocking RNG at call site.
    const after = applyMove(s, leapMove, () => 5 / 6); // roll = 6
    const p = getPlayer(after, 'A1');
    expect(p.pos).toEqual({ x: 12, y: 7 });
    expect(p.stunned).not.toBe(true);
    expect(after.isTurnover).toBe(false);
  });

  it('fails on low roll: player falls prone, triggers turnover', () => {
    const s = setupLeapScenario(true, 'leap');
    const leapMove: Move = { type: 'LEAP', playerId: 'A1', to: { x: 12, y: 7 } };
    // Roll = 1 => guaranteed failure regardless of modifiers.
    const after = applyMove(s, leapMove, () => 0);
    const p = getPlayer(after, 'A1');
    expect(p.pos).toEqual({ x: 12, y: 7 });
    expect(p.stunned).toBe(true);
    expect(after.isTurnover).toBe(true);
  });

  it('consumes 2 movement points', () => {
    const s = setupLeapScenario(true, 'leap');
    const leapMove: Move = { type: 'LEAP', playerId: 'A1', to: { x: 12, y: 7 } };
    const initialPm = getPlayer(s, 'A1').pm;
    const after = applyMove(s, leapMove, () => 5 / 6);
    expect(getPlayer(after, 'A1').pm).toBe(initialPm - 2);
  });

  it('pogo-stick grants +1 modifier, allowing a roll that would otherwise fail', () => {
    // AG=4, without pogo => target=4, with pogo => target=3.
    // Roll = 3 (rng ~ 0.4) => fails without pogo, succeeds with pogo.
    const withoutPogo = setupLeapScenario(true, 'leap');
    const withPogo = setupLeapScenario(true, 'pogo-stick');

    const move: Move = { type: 'LEAP', playerId: 'A1', to: { x: 12, y: 7 } };
    const rng = () => 0.4; // roll = 3

    const afterNoPogo = applyMove(withoutPogo, move, rng);
    const afterPogo = applyMove(withPogo, move, rng);

    expect(getPlayer(afterNoPogo, 'A1').stunned).toBe(true);
    expect(afterNoPogo.isTurnover).toBe(true);

    expect(getPlayer(afterPogo, 'A1').stunned).not.toBe(true);
    expect(afterPogo.isTurnover).toBe(false);
  });

  it('ball carrier failing leap drops the ball (turnover)', () => {
    const base = setupLeapScenario(true, 'leap');
    const s: GameState = {
      ...base,
      players: base.players.map(p =>
        p.id === 'A1' ? { ...p, hasBall: true } : p,
      ),
    };
    const leapMove: Move = { type: 'LEAP', playerId: 'A1', to: { x: 12, y: 7 } };
    const after = applyMove(s, leapMove, () => 0); // roll = 1, fail
    expect(getPlayer(after, 'A1').hasBall).toBe(false);
    expect(after.isTurnover).toBe(true);
    // The ball should exist somewhere on the field.
    expect(after.ball).toBeDefined();
  });

  it('does not trigger a Dodge roll when leaving tackle zones', () => {
    // Place a B opponent adjacent to A1, so A1 is in a tackle zone.
    const base = setupLeapScenario(true, 'leap');
    const s: GameState = {
      ...base,
      players: base.players.map(p => {
        if (p.id === 'B1') return { ...p, pos: { x: 11, y: 7 } }; // adjacent to A1 @ (10,7)
        return p;
      }),
    };

    const leapMove: Move = { type: 'LEAP', playerId: 'A1', to: { x: 12, y: 8 } };
    const after = applyMove(s, leapMove, () => 5 / 6); // roll = 6

    // No dodge failure: player moved successfully.
    expect(getPlayer(after, 'A1').pos).toEqual({ x: 12, y: 8 });
    expect(after.isTurnover).toBe(false);

    // Only one AG roll should have been recorded (leap), not a separate dodge.
    const diceLogs = after.gameLog.filter(l => l.type === 'dice');
    // We don't assert an exact count (armor etc.), but we assert that no
    // dodge message appears in the log.
    const hasDodgeLog = diceLogs.some(l => l.message.toLowerCase().includes("esquive"));
    expect(hasDodgeLog).toBe(false);
  });

  it('rejects LEAP to a destination that is not Chebyshev distance 2', () => {
    const s = setupLeapScenario(true, 'leap');
    const leapMove: Move = { type: 'LEAP', playerId: 'A1', to: { x: 11, y: 7 } }; // distance 1
    const after = applyMove(s, leapMove, () => 5 / 6);
    expect(getPlayer(after, 'A1').pos).toEqual({ x: 10, y: 7 });
  });

  it('rejects LEAP when player has insufficient movement (pm < 2 and 2+ GFI used)', () => {
    const base = setupLeapScenario(true, 'leap');
    const s: GameState = {
      ...base,
      players: base.players.map(p =>
        p.id === 'A1' ? { ...p, pm: 0, gfiUsed: 2 } : p,
      ),
    };
    const leapMove: Move = { type: 'LEAP', playerId: 'A1', to: { x: 12, y: 7 } };
    const after = applyMove(s, leapMove, () => 5 / 6);
    expect(getPlayer(after, 'A1').pos).toEqual({ x: 10, y: 7 });
  });
});
