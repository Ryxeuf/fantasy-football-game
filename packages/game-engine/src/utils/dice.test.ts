import { describe, it, expect } from 'vitest';
import {
  rollD6,
  roll2D6,
  calculateDodgeTarget,
  performDodgeRoll,
  calculateArmorTarget,
  performArmorRoll,
  calculatePickupTarget,
  performPickupRoll,
  blockResultFromRoll,
  rollBlockDice,
  rollBlockDiceMany,
  rollBlockDiceManyWithRolls,
  performBlockRoll,
} from './dice';
import type { Player } from '../core/types';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function mockPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'P1',
    team: 'A',
    pos: { x: 5, y: 7 },
    name: 'Test',
    number: 1,
    position: 'Lineman',
    ma: 6,
    st: 3,
    ag: 3,
    pa: 4,
    av: 8,
    skills: [],
    pm: 6,
    ...overrides,
  };
}

/** Create a deterministic RNG that always returns the given fixed value (0..1 exclusive). */
function fixedRng(value: number): () => number {
  return () => value;
}

/** Create an RNG that returns values from a sequence, cycling at the end. */
function sequenceRng(values: number[]): () => number {
  let index = 0;
  return () => {
    const val = values[index % values.length];
    index++;
    return val;
  };
}

// ---------------------------------------------------------------------------
// rollD6
// ---------------------------------------------------------------------------

describe('rollD6', () => {
  it('returns 1 when rng returns 0.0', () => {
    expect(rollD6(fixedRng(0.0))).toBe(1);
  });

  it('returns 6 when rng returns 0.99', () => {
    expect(rollD6(fixedRng(0.99))).toBe(6);
  });

  it('returns 4 when rng returns 0.5', () => {
    // Math.floor(0.5 * 6) + 1 = Math.floor(3.0) + 1 = 4
    expect(rollD6(fixedRng(0.5))).toBe(4);
  });

  it('always returns a value between 1 and 6', () => {
    // Test several boundary-adjacent values
    const values = [0.0, 0.1666, 0.3333, 0.5, 0.6666, 0.8333, 0.9999];
    for (const v of values) {
      const result = rollD6(fixedRng(v));
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(6);
    }
  });

  it('returns an integer', () => {
    expect(Number.isInteger(rollD6(fixedRng(0.42)))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// roll2D6
// ---------------------------------------------------------------------------

describe('roll2D6', () => {
  it('returns 2 when both dice roll 1 (rng always 0.0)', () => {
    expect(roll2D6(fixedRng(0.0))).toBe(2);
  });

  it('returns 12 when both dice roll 6 (rng always 0.99)', () => {
    expect(roll2D6(fixedRng(0.99))).toBe(12);
  });

  it('returns 8 when both dice roll 4 (rng 0.5)', () => {
    // rollD6(0.5) = 4, so 4+4 = 8
    expect(roll2D6(fixedRng(0.5))).toBe(8);
  });

  it('returns different values for each die when using a sequence rng', () => {
    // First call → 0.0 → 1, second call → 0.99 → 6, sum = 7
    const rng = sequenceRng([0.0, 0.99]);
    expect(roll2D6(rng)).toBe(7);
  });

  it('always returns a value between 2 and 12', () => {
    const samples = [0.0, 0.25, 0.5, 0.75, 0.99];
    for (const v of samples) {
      const result = roll2D6(fixedRng(v));
      expect(result).toBeGreaterThanOrEqual(2);
      expect(result).toBeLessThanOrEqual(12);
    }
  });

  it('returns an integer', () => {
    expect(Number.isInteger(roll2D6(fixedRng(0.3)))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// calculateDodgeTarget
// ---------------------------------------------------------------------------

describe('calculateDodgeTarget', () => {
  it('returns ag when no modifiers', () => {
    const player = mockPlayer({ ag: 4 });
    expect(calculateDodgeTarget(player)).toBe(4);
  });

  it('subtracts positive modifiers from ag', () => {
    // modifiers = 1 → target = ag - 1 = 3 - 1 = 2
    const player = mockPlayer({ ag: 3 });
    expect(calculateDodgeTarget(player, 1)).toBe(2);
  });

  it('adds negative modifiers (harder dodge)', () => {
    // modifiers = -2 → target = ag - (-2) = 3 + 2 = 5
    const player = mockPlayer({ ag: 3 });
    expect(calculateDodgeTarget(player, -2)).toBe(5);
  });

  it('clamps minimum to 2', () => {
    // ag=3, modifiers=5 → 3-5=-2 → clamped to 2
    const player = mockPlayer({ ag: 3 });
    expect(calculateDodgeTarget(player, 5)).toBe(2);
  });

  it('clamps maximum to 6', () => {
    // ag=1, modifiers=-10 → 1+10=11 → clamped to 6
    const player = mockPlayer({ ag: 1 });
    expect(calculateDodgeTarget(player, -10)).toBe(6);
  });

  it('returns 2 when ag is very high and modifier makes it go below 2', () => {
    const player = mockPlayer({ ag: 6 });
    expect(calculateDodgeTarget(player, 10)).toBe(2);
  });

  it('returns 6 when ag is 6 and no modifiers', () => {
    const player = mockPlayer({ ag: 6 });
    expect(calculateDodgeTarget(player, 0)).toBe(6);
  });

  it('handles zero modifier (default)', () => {
    const player = mockPlayer({ ag: 3 });
    expect(calculateDodgeTarget(player, 0)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// performDodgeRoll
// ---------------------------------------------------------------------------

describe('performDodgeRoll', () => {
  it('returns type dodge', () => {
    const player = mockPlayer();
    const result = performDodgeRoll(player, fixedRng(0.5));
    expect(result.type).toBe('dodge');
  });

  it('includes the player id', () => {
    const player = mockPlayer({ id: 'PLAYER_X' });
    const result = performDodgeRoll(player, fixedRng(0.5));
    expect(result.playerId).toBe('PLAYER_X');
  });

  it('succeeds when diceRoll >= targetNumber', () => {
    // ag=3 → target=3; rng=0.5 → roll=4; 4>=3 → success
    const player = mockPlayer({ ag: 3 });
    const result = performDodgeRoll(player, fixedRng(0.5));
    expect(result.diceRoll).toBe(4);
    expect(result.targetNumber).toBe(3);
    expect(result.success).toBe(true);
  });

  it('fails when diceRoll < targetNumber', () => {
    // ag=6, modifiers=-2 → target=6-(-2)=8 clamped to 6; rng=0.0 → roll=1; 1<6 → fail
    const player = mockPlayer({ ag: 6 });
    const result = performDodgeRoll(player, fixedRng(0.0), -2);
    expect(result.diceRoll).toBe(1);
    expect(result.targetNumber).toBe(6);
    expect(result.success).toBe(false);
  });

  it('succeeds on exact target number', () => {
    // ag=4 → target=4; rng=0.5 → roll=4; 4>=4 → success
    const player = mockPlayer({ ag: 4 });
    const result = performDodgeRoll(player, fixedRng(0.5));
    expect(result.diceRoll).toBe(4);
    expect(result.targetNumber).toBe(4);
    expect(result.success).toBe(true);
  });

  it('records modifiers in result', () => {
    const player = mockPlayer({ ag: 4 });
    const result = performDodgeRoll(player, fixedRng(0.5), -1);
    expect(result.modifiers).toBe(-1);
  });

  it('returns integer diceRoll', () => {
    const player = mockPlayer();
    const result = performDodgeRoll(player, fixedRng(0.33));
    expect(Number.isInteger(result.diceRoll)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// calculateArmorTarget
// ---------------------------------------------------------------------------

describe('calculateArmorTarget', () => {
  it('returns av when no modifiers', () => {
    const player = mockPlayer({ av: 8 });
    expect(calculateArmorTarget(player)).toBe(8);
  });

  it('adds positive modifiers to av', () => {
    // modifiers = 2 → 8 + 2 = 10
    const player = mockPlayer({ av: 8 });
    expect(calculateArmorTarget(player, 2)).toBe(10);
  });

  it('subtracts negative modifiers from av', () => {
    // modifiers = -2 → 8 + (-2) = 6
    const player = mockPlayer({ av: 8 });
    expect(calculateArmorTarget(player, -2)).toBe(6);
  });

  it('clamps maximum to 12', () => {
    // av=10, modifiers=5 → 15 → clamped to 12
    const player = mockPlayer({ av: 10 });
    expect(calculateArmorTarget(player, 5)).toBe(12);
  });

  it('does not clamp the minimum (can go below 2)', () => {
    // av=2, modifiers=-5 → -3 (no minimum clamp in this function)
    const player = mockPlayer({ av: 2 });
    expect(calculateArmorTarget(player, -5)).toBe(-3);
  });

  it('returns 12 when av is already 12 with zero modifier', () => {
    const player = mockPlayer({ av: 12 });
    expect(calculateArmorTarget(player, 0)).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// performArmorRoll
// ---------------------------------------------------------------------------

describe('performArmorRoll', () => {
  it('returns type armor', () => {
    const player = mockPlayer();
    const result = performArmorRoll(player, fixedRng(0.5));
    expect(result.type).toBe('armor');
  });

  it('includes the player id', () => {
    const player = mockPlayer({ id: 'ARMOR_PLAYER' });
    const result = performArmorRoll(player, fixedRng(0.5));
    expect(result.playerId).toBe('ARMOR_PLAYER');
  });

  it('armor HOLDS (success=true) when 2D6 roll < target (armor value)', () => {
    // av=8, target=8; rng=0.0 → both dice=1 → 2D6=2; 2<8 → success=true (armor holds)
    const player = mockPlayer({ av: 8 });
    const result = performArmorRoll(player, fixedRng(0.0));
    expect(result.diceRoll).toBe(2);
    expect(result.targetNumber).toBe(8);
    expect(result.success).toBe(true);
  });

  it('armor BROKEN (success=false) when 2D6 roll >= target (armor value)', () => {
    // av=8, target=8; rng=0.99 → both dice=6 → 2D6=12; 12>=8 → success=false (armor broken)
    const player = mockPlayer({ av: 8 });
    const result = performArmorRoll(player, fixedRng(0.99));
    expect(result.diceRoll).toBe(12);
    expect(result.targetNumber).toBe(8);
    expect(result.success).toBe(false);
  });

  it('armor BROKEN when roll equals target exactly', () => {
    // av=8, target=8; rng sequence → dice sum = 8; 8 >= 8 → success=false
    // Need dice1 + dice2 = 8: dice=4 → rng=0.5 → 4+4=8
    const player = mockPlayer({ av: 8 });
    const result = performArmorRoll(player, fixedRng(0.5));
    expect(result.diceRoll).toBe(8);
    expect(result.targetNumber).toBe(8);
    expect(result.success).toBe(false);
  });

  it('records modifiers in result', () => {
    const player = mockPlayer({ av: 8 });
    const result = performArmorRoll(player, fixedRng(0.5), 2);
    expect(result.modifiers).toBe(2);
  });

  it('uses roll2D6 (diceRoll between 2 and 12)', () => {
    const player = mockPlayer({ av: 8 });
    const result = performArmorRoll(player, fixedRng(0.5));
    expect(result.diceRoll).toBeGreaterThanOrEqual(2);
    expect(result.diceRoll).toBeLessThanOrEqual(12);
  });
});

// ---------------------------------------------------------------------------
// calculatePickupTarget
// ---------------------------------------------------------------------------

describe('calculatePickupTarget', () => {
  it('mirrors dodge formula: returns ag when no modifiers', () => {
    const player = mockPlayer({ ag: 3 });
    expect(calculatePickupTarget(player)).toBe(3);
  });

  it('subtracts positive modifiers', () => {
    const player = mockPlayer({ ag: 4 });
    expect(calculatePickupTarget(player, 1)).toBe(3);
  });

  it('clamps minimum to 2', () => {
    const player = mockPlayer({ ag: 2 });
    expect(calculatePickupTarget(player, 5)).toBe(2);
  });

  it('clamps maximum to 6', () => {
    const player = mockPlayer({ ag: 2 });
    expect(calculatePickupTarget(player, -10)).toBe(6);
  });

  it('produces same result as calculateDodgeTarget for identical inputs', () => {
    const player = mockPlayer({ ag: 4 });
    // Both functions share the same formula
    expect(calculatePickupTarget(player, -1)).toBe(calculateDodgeTarget(player, -1));
  });
});

// ---------------------------------------------------------------------------
// performPickupRoll
// ---------------------------------------------------------------------------

describe('performPickupRoll', () => {
  it('returns type pickup', () => {
    const player = mockPlayer();
    const result = performPickupRoll(player, fixedRng(0.5));
    expect(result.type).toBe('pickup');
  });

  it('includes the player id', () => {
    const player = mockPlayer({ id: 'PICK_P' });
    const result = performPickupRoll(player, fixedRng(0.5));
    expect(result.playerId).toBe('PICK_P');
  });

  it('succeeds when diceRoll >= targetNumber', () => {
    // ag=3, no mods → target=3; rng=0.99 → roll=6; 6>=3 → success
    const player = mockPlayer({ ag: 3 });
    const result = performPickupRoll(player, fixedRng(0.99));
    expect(result.success).toBe(true);
  });

  it('fails when diceRoll < targetNumber', () => {
    // ag=6, mods=-2 → target=6; rng=0.0 → roll=1; 1<6 → fail
    const player = mockPlayer({ ag: 6 });
    const result = performPickupRoll(player, fixedRng(0.0), -2);
    expect(result.diceRoll).toBe(1);
    expect(result.targetNumber).toBe(6);
    expect(result.success).toBe(false);
  });

  it('records modifiers', () => {
    const player = mockPlayer({ ag: 3 });
    const result = performPickupRoll(player, fixedRng(0.5), 1);
    expect(result.modifiers).toBe(1);
  });

  it('uses D6 (diceRoll between 1 and 6)', () => {
    const player = mockPlayer();
    const result = performPickupRoll(player, fixedRng(0.5));
    expect(result.diceRoll).toBeGreaterThanOrEqual(1);
    expect(result.diceRoll).toBeLessThanOrEqual(6);
  });
});

// ---------------------------------------------------------------------------
// blockResultFromRoll
// ---------------------------------------------------------------------------

describe('blockResultFromRoll', () => {
  it('maps 1 → PLAYER_DOWN', () => {
    expect(blockResultFromRoll(1)).toBe('PLAYER_DOWN');
  });

  it('maps 2 → BOTH_DOWN', () => {
    expect(blockResultFromRoll(2)).toBe('BOTH_DOWN');
  });

  it('maps 3 → PUSH_BACK', () => {
    expect(blockResultFromRoll(3)).toBe('PUSH_BACK');
  });

  it('maps 4 → STUMBLE', () => {
    expect(blockResultFromRoll(4)).toBe('STUMBLE');
  });

  it('maps 5 → POW', () => {
    expect(blockResultFromRoll(5)).toBe('POW');
  });

  it('maps 6 → PUSH_BACK', () => {
    expect(blockResultFromRoll(6)).toBe('PUSH_BACK');
  });

  it('maps an unexpected value → PUSH_BACK (default)', () => {
    expect(blockResultFromRoll(0)).toBe('PUSH_BACK');
    expect(blockResultFromRoll(7)).toBe('PUSH_BACK');
    expect(blockResultFromRoll(-1)).toBe('PUSH_BACK');
  });

  it('returns all five valid BlockResult variants across 1-6', () => {
    const allResults = [1, 2, 3, 4, 5, 6].map(blockResultFromRoll);
    const validValues = new Set(['PLAYER_DOWN', 'BOTH_DOWN', 'PUSH_BACK', 'STUMBLE', 'POW']);
    for (const r of allResults) {
      expect(validValues.has(r)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// rollBlockDice
// ---------------------------------------------------------------------------

describe('rollBlockDice', () => {
  it('returns PLAYER_DOWN when rng → roll 1', () => {
    expect(rollBlockDice(fixedRng(0.0))).toBe('PLAYER_DOWN');
  });

  it('returns BOTH_DOWN when rng → roll 2', () => {
    // rng=0.1666... → floor(0.1666*6)=floor(0.9996)=0 + 1 = 1? Let's use precise boundary
    // roll = floor(rng * 6) + 1 = 2 → rng must satisfy floor(rng*6)=1 → rng in [1/6, 2/6)
    expect(rollBlockDice(fixedRng(1 / 6 + 0.001))).toBe('BOTH_DOWN');
  });

  it('returns PUSH_BACK when rng → roll 3', () => {
    expect(rollBlockDice(fixedRng(2 / 6 + 0.001))).toBe('PUSH_BACK');
  });

  it('returns STUMBLE when rng → roll 4', () => {
    expect(rollBlockDice(fixedRng(3 / 6 + 0.001))).toBe('STUMBLE');
  });

  it('returns POW when rng → roll 5', () => {
    expect(rollBlockDice(fixedRng(4 / 6 + 0.001))).toBe('POW');
  });

  it('returns PUSH_BACK when rng → roll 6', () => {
    expect(rollBlockDice(fixedRng(5 / 6 + 0.001))).toBe('PUSH_BACK');
  });

  it('always returns a valid BlockResult', () => {
    const validValues = new Set(['PLAYER_DOWN', 'BOTH_DOWN', 'PUSH_BACK', 'STUMBLE', 'POW']);
    const testValues = [0.0, 0.2, 0.35, 0.5, 0.7, 0.99];
    for (const v of testValues) {
      expect(validValues.has(rollBlockDice(fixedRng(v)))).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// rollBlockDiceMany
// ---------------------------------------------------------------------------

describe('rollBlockDiceMany', () => {
  it('returns an empty array when count is 0', () => {
    expect(rollBlockDiceMany(fixedRng(0.5), 0)).toEqual([]);
  });

  it('returns exactly count results', () => {
    for (const count of [1, 2, 3, 5]) {
      expect(rollBlockDiceMany(fixedRng(0.5), count)).toHaveLength(count);
    }
  });

  it('all results are valid BlockResult values', () => {
    const validValues = new Set(['PLAYER_DOWN', 'BOTH_DOWN', 'PUSH_BACK', 'STUMBLE', 'POW']);
    const results = rollBlockDiceMany(fixedRng(0.5), 10);
    for (const r of results) {
      expect(validValues.has(r)).toBe(true);
    }
  });

  it('produces deterministic output with a fixed rng', () => {
    const rng1 = fixedRng(0.0);
    const rng2 = fixedRng(0.0);
    expect(rollBlockDiceMany(rng1, 3)).toEqual(rollBlockDiceMany(rng2, 3));
  });

  it('returns different results from different rng states (sequence)', () => {
    const rng = sequenceRng([0.0, 0.99, 0.5]);
    const results = rollBlockDiceMany(rng, 3);
    // 0.0 → 1 → PLAYER_DOWN, 0.99 → 6 → PUSH_BACK, 0.5 → 4 → STUMBLE
    expect(results[0]).toBe('PLAYER_DOWN');
    expect(results[1]).toBe('PUSH_BACK');
    expect(results[2]).toBe('STUMBLE');
  });
});

// ---------------------------------------------------------------------------
// rollBlockDiceManyWithRolls
// ---------------------------------------------------------------------------

describe('rollBlockDiceManyWithRolls', () => {
  it('returns an empty array when count is 0', () => {
    expect(rollBlockDiceManyWithRolls(fixedRng(0.5), 0)).toEqual([]);
  });

  it('returns exactly count entries', () => {
    for (const count of [1, 2, 3]) {
      expect(rollBlockDiceManyWithRolls(fixedRng(0.5), count)).toHaveLength(count);
    }
  });

  it('each entry has diceRoll and result properties', () => {
    const results = rollBlockDiceManyWithRolls(fixedRng(0.5), 3);
    for (const entry of results) {
      expect(entry).toHaveProperty('diceRoll');
      expect(entry).toHaveProperty('result');
    }
  });

  it('diceRoll is between 1 and 6 for all entries', () => {
    const results = rollBlockDiceManyWithRolls(fixedRng(0.5), 5);
    for (const entry of results) {
      expect(entry.diceRoll).toBeGreaterThanOrEqual(1);
      expect(entry.diceRoll).toBeLessThanOrEqual(6);
    }
  });

  it('result is consistent with diceRoll (blockResultFromRoll)', () => {
    const rng = sequenceRng([0.0, 0.99, 0.5, 2 / 6 + 0.001, 4 / 6 + 0.001]);
    const results = rollBlockDiceManyWithRolls(rng, 5);
    for (const entry of results) {
      expect(entry.result).toBe(blockResultFromRoll(entry.diceRoll));
    }
  });

  it('all result values are valid BlockResult variants', () => {
    const validValues = new Set(['PLAYER_DOWN', 'BOTH_DOWN', 'PUSH_BACK', 'STUMBLE', 'POW']);
    const results = rollBlockDiceManyWithRolls(fixedRng(0.5), 6);
    for (const entry of results) {
      expect(validValues.has(entry.result)).toBe(true);
    }
  });

  it('produces correct mapping for a known sequence', () => {
    // rng=0.0 → roll=1 → PLAYER_DOWN; rng=0.99 → roll=6 → PUSH_BACK
    const rng = sequenceRng([0.0, 0.99]);
    const results = rollBlockDiceManyWithRolls(rng, 2);
    expect(results[0]).toEqual({ diceRoll: 1, result: 'PLAYER_DOWN' });
    expect(results[1]).toEqual({ diceRoll: 6, result: 'PUSH_BACK' });
  });
});

// ---------------------------------------------------------------------------
// performBlockRoll
// ---------------------------------------------------------------------------

describe('performBlockRoll', () => {
  it('returns type block', () => {
    const attacker = mockPlayer({ id: 'ATK', st: 3 });
    const target = mockPlayer({ id: 'TGT', team: 'B', st: 3 });
    const result = performBlockRoll(attacker, target, fixedRng(0.5), 0, 0);
    expect(result.type).toBe('block');
  });

  it('includes attacker and target ids', () => {
    const attacker = mockPlayer({ id: 'ATK' });
    const target = mockPlayer({ id: 'TGT', team: 'B' });
    const result = performBlockRoll(attacker, target, fixedRng(0.5), 0, 0);
    expect(result.playerId).toBe('ATK');
    expect(result.targetId).toBe('TGT');
  });

  it('diceRoll is between 1 and 6', () => {
    const attacker = mockPlayer({ id: 'ATK' });
    const target = mockPlayer({ id: 'TGT', team: 'B' });
    for (const v of [0.0, 0.5, 0.99]) {
      const result = performBlockRoll(attacker, target, fixedRng(v), 0, 0);
      expect(result.diceRoll).toBeGreaterThanOrEqual(1);
      expect(result.diceRoll).toBeLessThanOrEqual(6);
    }
  });

  it('result is consistent with diceRoll', () => {
    const attacker = mockPlayer({ id: 'ATK' });
    const target = mockPlayer({ id: 'TGT', team: 'B' });
    const result = performBlockRoll(attacker, target, fixedRng(0.0), 0, 0);
    expect(result.result).toBe(blockResultFromRoll(result.diceRoll));
  });

  it('calculates totalStrength as attacker.st + offensiveAssists', () => {
    const attacker = mockPlayer({ id: 'ATK', st: 3 });
    const target = mockPlayer({ id: 'TGT', team: 'B', st: 3 });
    const result = performBlockRoll(attacker, target, fixedRng(0.5), 2, 0);
    expect(result.totalStrength).toBe(5); // 3 + 2
  });

  it('calculates targetStrength as target.st + defensiveAssists', () => {
    const attacker = mockPlayer({ id: 'ATK', st: 3 });
    const target = mockPlayer({ id: 'TGT', team: 'B', st: 4 });
    const result = performBlockRoll(attacker, target, fixedRng(0.5), 0, 1);
    expect(result.targetStrength).toBe(5); // 4 + 1
  });

  it('records offensive and defensive assists', () => {
    const attacker = mockPlayer({ id: 'ATK', st: 3 });
    const target = mockPlayer({ id: 'TGT', team: 'B', st: 3 });
    const result = performBlockRoll(attacker, target, fixedRng(0.5), 2, 1);
    expect(result.offensiveAssists).toBe(2);
    expect(result.defensiveAssists).toBe(1);
  });

  it('no assists: totalStrength equals attacker.st', () => {
    const attacker = mockPlayer({ id: 'ATK', st: 5 });
    const target = mockPlayer({ id: 'TGT', team: 'B', st: 2 });
    const result = performBlockRoll(attacker, target, fixedRng(0.5), 0, 0);
    expect(result.totalStrength).toBe(5);
    expect(result.targetStrength).toBe(2);
  });

  it('returns PLAYER_DOWN result when rng → roll 1', () => {
    const attacker = mockPlayer({ id: 'ATK' });
    const target = mockPlayer({ id: 'TGT', team: 'B' });
    const result = performBlockRoll(attacker, target, fixedRng(0.0), 0, 0);
    expect(result.diceRoll).toBe(1);
    expect(result.result).toBe('PLAYER_DOWN');
  });

  it('returns PUSH_BACK result when rng → roll 6', () => {
    const attacker = mockPlayer({ id: 'ATK' });
    const target = mockPlayer({ id: 'TGT', team: 'B' });
    const result = performBlockRoll(attacker, target, fixedRng(0.99), 0, 0);
    expect(result.diceRoll).toBe(6);
    expect(result.result).toBe('PUSH_BACK');
  });
});
