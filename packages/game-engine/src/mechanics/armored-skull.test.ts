/**
 * Regle: Armored Skull (Armure Blindee) - BB3 Season 2/3
 *
 * Tests for the Armored Skull trait: -1 modifier applied to any Injury roll
 * made against this player. Reduces the chance of KO and Casualty results.
 *
 * Primary users: Dwarf Deathroller, Slayerpult star players.
 */

import { describe, it, expect } from 'vitest';
import { setup } from '../index';
import { performInjuryRoll } from './injury';
import type { GameState, Player } from '../core/types';

function getPlayer(state: GameState, id: string): Player {
  return state.players.find(p => p.id === id)!;
}

function fixedRNG(value: number) {
  return () => value;
}

function sequencedRNG(values: number[]) {
  let i = 0;
  return () => {
    const v = values[Math.min(i, values.length - 1)];
    i++;
    return v;
  };
}

function giveSkill(state: GameState, playerId: string, skill: string): GameState {
  return {
    ...state,
    players: state.players.map(p =>
      p.id === playerId ? { ...p, skills: [...p.skills, skill] } : p
    ),
  };
}

describe('Regle: Armored Skull', () => {
  describe('performInjuryRoll with armored-skull', () => {
    it('applies -1 modifier that demotes a KO roll (8) to a Stunned result (7)', () => {
      const base = setup();
      const state = giveSkill(base, 'A1', 'armored-skull');
      const player = getPlayer(state, 'A1');

      // Without armored-skull: 4+4 = 8 → KO
      // With armored-skull: 8 - 1 = 7 → Stunned
      const result = performInjuryRoll(state, player, fixedRNG(0.5));

      const updated = getPlayer(result, 'A1');
      expect(updated.stunned).toBe(true);
      expect(updated.state).toBe('stunned');
      expect(result.dugouts.teamA.zones.knockedOut.players).not.toContain('A1');
      expect(result.dugouts.teamA.zones.casualty.players).not.toContain('A1');
    });

    it('applies -1 modifier that demotes a Casualty roll (10) to a KO result (9)', () => {
      const base = setup();
      const state = giveSkill(base, 'A1', 'armored-skull');
      const player = getPlayer(state, 'A1');

      // Need 2d6 = 10: e.g. 5+5. 0.666... → face 5
      // With armored-skull: 10 - 1 = 9 → KO
      const result = performInjuryRoll(state, player, sequencedRNG([0.7, 0.7]));

      expect(result.dugouts.teamA.zones.knockedOut.players).toContain('A1');
      expect(result.dugouts.teamA.zones.casualty.players).not.toContain('A1');
    });

    it('does not prevent a high Casualty roll (12 - 1 = 11 still casualty)', () => {
      const base = setup();
      const state = giveSkill(base, 'A1', 'armored-skull');
      const player = getPlayer(state, 'A1');

      // 2d6 = 12, -1 = 11, still ≥10 → Casualty
      const result = performInjuryRoll(state, player, fixedRNG(0.99));

      expect(result.dugouts.teamA.zones.casualty.players).toContain('A1');
    });

    it('does not apply to players without armored-skull', () => {
      const state = setup();
      const player = getPlayer(state, 'A1');

      // 4+4 = 8 → KO (no armored-skull malus)
      const result = performInjuryRoll(state, player, fixedRNG(0.5));

      expect(result.dugouts.teamA.zones.knockedOut.players).toContain('A1');
      expect(getPlayer(result, 'A1').state).toBe('knocked_out');
    });

    it('stacks with external injury bonus (Mighty Blow +1 cancels armored-skull -1)', () => {
      const base = setup();
      const state = giveSkill(base, 'A1', 'armored-skull');
      const player = getPlayer(state, 'A1');

      // 4+4 = 8, +1 (mighty blow) -1 (armored skull) = 8 → KO
      const result = performInjuryRoll(state, player, fixedRNG(0.5), 1);

      expect(result.dugouts.teamA.zones.knockedOut.players).toContain('A1');
    });

    it('logs the injury roll including the armored-skull modifier', () => {
      const base = setup();
      const state = giveSkill(base, 'A1', 'armored-skull');
      const player = getPlayer(state, 'A1');

      const result = performInjuryRoll(state, player, fixedRNG(0.5));

      const injuryLog = result.gameLog.find(l => l.type === 'dice' && l.message.includes('blessure'));
      expect(injuryLog).toBeDefined();
      // Final roll after modifier should be 7, not 8
      expect(injuryLog?.message).toContain('7');
    });
  });
});
