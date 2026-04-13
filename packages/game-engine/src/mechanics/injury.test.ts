/**
 * Tests for the injury system (injury.ts)
 * Covers: rollLastingInjuryType, performInjuryRoll, handleSentOff, handleInjuryByCrowd
 */

import { describe, it, expect } from 'vitest';
import { setup, makeRNG } from '../index';
import { performInjuryRoll, rollLastingInjuryType, handleSentOff, handleInjuryByCrowd } from './injury';
import type { GameState } from '../core/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getPlayer(state: GameState, id: string) {
  return state.players.find(p => p.id === id)!;
}

/**
 * Build a simple RNG that returns a fixed value on every call.
 * d6 formula: Math.floor(rng() * 6) + 1
 *   () => 0.0  → d6 = 1  → 2d6 = 2
 *   () => 0.99 → d6 = 6  → 2d6 = 12
 */
function fixedRNG(value: number) {
  return () => value;
}

/**
 * Build a sequenced RNG: uses values[i] for call i, then repeats the last value.
 */
function sequencedRNG(values: number[]) {
  let i = 0;
  return () => {
    const v = values[Math.min(i, values.length - 1)];
    i++;
    return v;
  };
}

// ─── rollLastingInjuryType ────────────────────────────────────────────────────

describe('rollLastingInjuryType', () => {
  // rng value that yields a specific D6 face: (face - 1) / 6 gives exact floor
  function rngForFace(face: number) {
    return () => (face - 1) / 6;
  }

  it('returns -1ma for D6 roll of 1', () => {
    expect(rollLastingInjuryType(rngForFace(1), 4)).toBe('-1ma');
  });

  it('returns -1av for D6 roll of 2', () => {
    expect(rollLastingInjuryType(rngForFace(2), 4)).toBe('-1av');
  });

  it('returns -1pa for D6 roll of 3 when player has PA (pa > 0)', () => {
    expect(rollLastingInjuryType(rngForFace(3), 4)).toBe('-1pa');
  });

  it('returns -1ag for D6 roll of 3 when player has no PA (pa = 0)', () => {
    expect(rollLastingInjuryType(rngForFace(3), 0)).toBe('-1ag');
  });

  it('returns -1ag for D6 roll of 4', () => {
    expect(rollLastingInjuryType(rngForFace(4), 4)).toBe('-1ag');
  });

  it('returns -1ag for D6 roll of 5', () => {
    expect(rollLastingInjuryType(rngForFace(5), 4)).toBe('-1ag');
  });

  it('returns -1st for D6 roll of 6', () => {
    expect(rollLastingInjuryType(rngForFace(6), 4)).toBe('-1st');
  });
});

// ─── performInjuryRoll ────────────────────────────────────────────────────────

describe('performInjuryRoll', () => {
  it('low roll (2d6 = 2, ≤7) → player stunned on field', () => {
    const state = setup();
    const player = getPlayer(state, 'A1');

    // fixedRNG(0.0) → each d6 = 1 → 2d6 = 2 → Stunned
    const result = performInjuryRoll(state, player, fixedRNG(0.0));

    const updated = getPlayer(result, 'A1');
    expect(updated.stunned).toBe(true);
    expect(updated.state).toBe('stunned');
    // Player stays in players array, not moved to any dugout zone
    expect(result.players.some(p => p.id === 'A1')).toBe(true);
    expect(result.dugouts.teamA.zones.knockedOut.players).not.toContain('A1');
    expect(result.dugouts.teamA.zones.casualty.players).not.toContain('A1');
  });

  it('mid roll (2d6 = 8, 8-9) → player moved to KO zone', () => {
    const state = setup();
    const player = getPlayer(state, 'A1');

    // 0.5 → d6 = floor(0.5*6)+1 = 4 → 4+4 = 8 → KO
    const result = performInjuryRoll(state, player, fixedRNG(0.5));

    expect(result.dugouts.teamA.zones.knockedOut.players).toContain('A1');
    const updated = getPlayer(result, 'A1');
    expect(updated.state).toBe('knocked_out');
    // No casualty
    expect(result.casualtyResults['A1']).toBeUndefined();
  });

  it('high roll (2d6 = 12, ≥10) → player moved to casualty zone', () => {
    const state = setup();
    const player = getPlayer(state, 'A1');

    // fixedRNG(0.99) → each d6 = 6 → 2d6 = 12 → Casualty
    // Third call (casualty D16) also 0.99 → roll=16 → dead
    const result = performInjuryRoll(state, player, fixedRNG(0.99));

    expect(result.dugouts.teamA.zones.casualty.players).toContain('A1');
    expect(result.casualtyResults['A1']).toBeDefined();
    // Not stunned or KO
    expect(result.dugouts.teamA.zones.knockedOut.players).not.toContain('A1');
  });

  it('bonus shifts result from stunned to KO (bonus=6 raises 2 to 8)', () => {
    const state = setup();
    const player = getPlayer(state, 'A1');

    // fixedRNG(0.0) → 1+1=2, but +6 bonus → 8 → KO
    const result = performInjuryRoll(state, player, fixedRNG(0.0), 6);

    expect(result.dugouts.teamA.zones.knockedOut.players).toContain('A1');
    const updated = getPlayer(result, 'A1');
    expect(updated.state).toBe('knocked_out');
  });

  it('causedById tracks casualty stat for the attacker', () => {
    const state = setup();
    const player = getPlayer(state, 'A1');

    // 0.99 → casualty roll (2d6=12), attacker B1 gets credit
    const result = performInjuryRoll(state, player, fixedRNG(0.99), 0, 'B1');

    expect(result.matchStats['B1']).toBeDefined();
    expect(result.matchStats['B1'].casualties).toBe(1);
  });
});

// ─── handleSentOff ────────────────────────────────────────────────────────────

describe('handleSentOff', () => {
  it('moves player to sentOff dugout zone', () => {
    const state = setup();
    const player = getPlayer(state, 'A1');

    const result = handleSentOff(state, player);

    expect(result.dugouts.teamA.zones.sentOff.players).toContain('A1');
    // Player no longer in any active position
    const updated = getPlayer(result, 'A1');
    expect(updated.state).toBe('sent_off');
  });

  it('creates a log entry for the expulsion', () => {
    const state = setup();
    const player = getPlayer(state, 'A1');

    const result = handleSentOff(state, player);

    const logsBefore = state.gameLog.length;
    expect(result.gameLog.length).toBeGreaterThan(logsBefore);
    const sentOffLog = result.gameLog.find(l =>
      l.playerId === 'A1' &&
      (l.message.includes('exclu') || l.message.toLowerCase().includes('sent') || l.message.toLowerCase().includes('off'))
    );
    expect(sentOffLog).toBeDefined();
  });
});

// ─── handleInjuryByCrowd ──────────────────────────────────────────────────────

describe('handleInjuryByCrowd', () => {
  it('low roll (2d6 ≤9) → player moved to KO zone (Stunned promoted to KO)', () => {
    const state = setup();
    const player = getPlayer(state, 'A1');

    // fixedRNG(0.0) → each d6 = 1 → 2d6 = 2 → normally Stunned, but crowd promotes to KO
    const result = handleInjuryByCrowd(state, player, fixedRNG(0.0));

    expect(result.dugouts.teamA.zones.knockedOut.players).toContain('A1');
    const updated = getPlayer(result, 'A1');
    expect(updated.state).toBe('knocked_out');
    // Not in casualty
    expect(result.dugouts.teamA.zones.casualty.players).not.toContain('A1');
  });

  it('high roll (2d6 ≥10) → player moved to casualty zone', () => {
    const state = setup();
    const player = getPlayer(state, 'A1');

    // fixedRNG(0.99) → each d6 = 6 → 2d6 = 12 → Casualty
    const result = handleInjuryByCrowd(state, player, fixedRNG(0.99));

    expect(result.dugouts.teamA.zones.casualty.players).toContain('A1');
    expect(result.casualtyResults['A1']).toBeDefined();
    // Not in KO
    expect(result.dugouts.teamA.zones.knockedOut.players).not.toContain('A1');
  });

  it('a roll of exactly 9 (≤9) is KO, not Casualty', () => {
    const state = setup();
    const player = getPlayer(state, 'A1');

    // Need 2d6 = 9: e.g. 4+5 or 5+4. Use sequenced: 0.5 → 4, then 0.666 → 5
    // floor(0.5*6)+1 = 4, floor(0.666*6)+1 = 5 → total 9
    const rng = sequencedRNG([0.5, 0.666]);
    const result = handleInjuryByCrowd(state, player, rng);

    expect(result.dugouts.teamA.zones.knockedOut.players).toContain('A1');
    expect(result.dugouts.teamA.zones.casualty.players).not.toContain('A1');
  });
});
