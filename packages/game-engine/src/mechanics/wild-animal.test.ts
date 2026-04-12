import { describe, it, expect, beforeEach } from 'vitest';
import { setup, applyMove, makeRNG } from '../index';
import type { GameState, Move } from '../core/types';
import { getSkillEffect } from '../skills/skill-registry';

/**
 * Wild Animal (BB3 Season 2/3 rules):
 * - At the start of this player's activation, roll a D6
 * - Add +2 to the result if this player is attempting a Block or Blitz action
 * - On a total of 1-3: the player can't perform any action, activation ends immediately
 *   -> Block/Blitz: only fails on natural 1 (1+2=3 <= 3)
 *   -> Other actions: fails on natural 1-3 (no modifier)
 * - This is NOT a turnover
 * - The check only happens once per activation (first action attempt)
 */

function makeTestState(): GameState {
  const state = setup();
  return {
    ...state,
    teamRerolls: { teamA: 2, teamB: 2 },
    rerollUsedThisTurn: false,
  };
}

/**
 * A1 at (5,5) with optional wild-animal.
 * B1 placed at (6,5) if adjacentTarget, else far away (20,10).
 * Other players moved out of the way to avoid tackle zone interference.
 */
function setupWildAnimalScenario(
  baseState: GameState,
  hasWildAnimal: boolean,
  adjacentTarget: boolean = false
): GameState {
  return {
    ...baseState,
    currentPlayer: 'A',
    selectedPlayerId: null,
    playerActions: {},
    isTurnover: false,
    players: baseState.players.map(p => {
      if (p.id === 'A1') {
        return {
          ...p,
          pos: { x: 5, y: 5 },
          pm: 6,
          ma: 6,
          st: 5,
          state: 'active' as const,
          stunned: false,
          skills: hasWildAnimal ? ['wild-animal'] : [],
          gfiUsed: 0,
        };
      }
      if (p.id === 'B1') {
        return {
          ...p,
          pos: adjacentTarget ? { x: 6, y: 5 } : { x: 20, y: 10 },
          pm: 8,
          st: 3,
          state: 'active' as const,
          stunned: false,
          skills: [],
        };
      }
      // Move other players far away
      if (p.team === 'A') {
        return { ...p, pos: { x: 1, y: 1 }, state: 'active' as const, stunned: false };
      }
      return { ...p, pos: { x: 24, y: 13 }, state: 'active' as const, stunned: false };
    }),
  };
}

const MOVE_LEFT: Move = { type: 'MOVE', playerId: 'A1', to: { x: 4, y: 5 } };
const BLOCK_B1: Move = { type: 'BLOCK', playerId: 'A1', targetId: 'B1' };

describe('Regle: Wild Animal (Fureur Debridee)', () => {
  describe('Skill Registry', () => {
    it('wild-animal is registered in skill registry', () => {
      const effect = getSkillEffect('wild-animal');
      expect(effect).toBeDefined();
      expect(effect!.slug).toBe('wild-animal');
    });

    it('wild-animal has on-activation trigger', () => {
      const effect = getSkillEffect('wild-animal');
      expect(effect!.triggers).toContain('on-activation');
    });
  });

  describe('Wild Animal activation check on MOVE (no Block/Blitz modifier)', () => {
    let baseState: GameState;

    beforeEach(() => {
      baseState = makeTestState();
    });

    it('player without wild-animal can move normally (no activation roll)', () => {
      const state = setupWildAnimalScenario(baseState, false);
      const rng = makeRNG('no-wild-animal-move');
      const result = applyMove(state, MOVE_LEFT, rng);

      const a1 = result.players.find(p => p.id === 'A1')!;
      expect(a1.pos).toEqual({ x: 4, y: 5 });

      const wildAnimalLogs = result.gameLog.filter(l =>
        l.message.includes('Fureur')
      );
      expect(wildAnimalLogs).toHaveLength(0);
    });

    it('wild-animal roll of 4+ allows normal movement', () => {
      const state = setupWildAnimalScenario(baseState, true);

      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`wa-move-pass-${seed}`);
        const result = applyMove(state, MOVE_LEFT, rng);

        const passLog = result.gameLog.find(l =>
          l.message.includes('Fureur') && l.message.includes('✓')
        );
        if (passLog) {
          found = true;
          const a1 = result.players.find(p => p.id === 'A1')!;
          expect(a1.pos).toEqual({ x: 4, y: 5 });
          break;
        }
      }
      expect(found).toBe(true);
    });

    it('wild-animal roll of 1-3 prevents movement (player stays in place)', () => {
      const state = setupWildAnimalScenario(baseState, true);

      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`wa-move-fail-${seed}`);
        const result = applyMove(state, MOVE_LEFT, rng);

        const failLog = result.gameLog.find(l =>
          l.message.includes('Fureur') && l.message.includes('✗')
        );
        if (failLog) {
          found = true;
          const a1 = result.players.find(p => p.id === 'A1')!;
          expect(a1.pos).toEqual({ x: 5, y: 5 });
          break;
        }
      }
      expect(found).toBe(true);
    });

    it('wild-animal failure on MOVE is NOT a turnover', () => {
      const state = setupWildAnimalScenario(baseState, true);

      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`wa-move-no-to-${seed}`);
        const result = applyMove(state, MOVE_LEFT, rng);

        const failLog = result.gameLog.find(l =>
          l.message.includes('Fureur') && l.message.includes('✗')
        );
        if (failLog) {
          found = true;
          expect(result.isTurnover).toBe(false);
          break;
        }
      }
      expect(found).toBe(true);
    });

    it('wild-animal failure marks player as having acted with 0 PM', () => {
      const state = setupWildAnimalScenario(baseState, true);

      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`wa-move-acted-${seed}`);
        const result = applyMove(state, MOVE_LEFT, rng);

        const failLog = result.gameLog.find(l =>
          l.message.includes('Fureur') && l.message.includes('✗')
        );
        if (failLog) {
          found = true;
          expect(result.playerActions['A1']).toBeDefined();
          const a1 = result.players.find(p => p.id === 'A1')!;
          expect(a1.pm).toBe(0);
          break;
        }
      }
      expect(found).toBe(true);
    });

    it('wild-animal failure logs rage message', () => {
      const state = setupWildAnimalScenario(baseState, true);

      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`wa-move-log-${seed}`);
        const result = applyMove(state, MOVE_LEFT, rng);

        const failLog = result.gameLog.find(l =>
          l.message.includes('Fureur') && l.message.includes('✗')
        );
        if (failLog) {
          found = true;
          const rageLog = result.gameLog.find(l =>
            l.message.includes('est pris de fureur') && l.message.includes('ne peut pas agir')
          );
          expect(rageLog).toBeDefined();
          break;
        }
      }
      expect(found).toBe(true);
    });
  });

  describe('Wild Animal activation check on BLOCK (+2 modifier)', () => {
    let baseState: GameState;

    beforeEach(() => {
      baseState = makeTestState();
    });

    it('wild-animal roll of 2+ allows block to proceed (2+2=4 passes)', () => {
      const state = setupWildAnimalScenario(baseState, true, true);

      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`wa-block-pass-${seed}`);
        const result = applyMove(state, BLOCK_B1, rng);

        const passLog = result.gameLog.find(l =>
          l.message.includes('Fureur') && l.message.includes('✓')
        );
        if (passLog) {
          found = true;
          // Block should have been attempted
          const hasBlock = result.gameLog.some(l =>
            l.message.includes('Blocage')
          ) || result.pendingBlock !== undefined;
          expect(hasBlock).toBe(true);
          break;
        }
      }
      expect(found).toBe(true);
    });

    it('wild-animal roll of 1 prevents block (1+2=3 fails)', () => {
      const state = setupWildAnimalScenario(baseState, true, true);

      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`wa-block-fail-${seed}`);
        const result = applyMove(state, BLOCK_B1, rng);

        const failLog = result.gameLog.find(l =>
          l.message.includes('Fureur') && l.message.includes('✗')
        );
        if (failLog) {
          found = true;
          // No block dice should have been rolled
          const blockLogs = result.gameLog.filter(l =>
            l.message.includes('Blocage')
          );
          expect(blockLogs).toHaveLength(0);
          expect(result.isTurnover).toBe(false);
          break;
        }
      }
      expect(found).toBe(true);
    });
  });

  describe('Check happens only once per activation', () => {
    it('wild-animal check not repeated on subsequent moves', () => {
      const baseState = makeTestState();
      const state = setupWildAnimalScenario(baseState, true);

      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`wa-once-${seed}`);
        const result = applyMove(state, MOVE_LEFT, rng);

        const passLog = result.gameLog.find(l =>
          l.message.includes('Fureur') && l.message.includes('✓')
        );
        if (passLog) {
          // First move succeeded, now do a second move
          const MOVE_AGAIN: Move = { type: 'MOVE', playerId: 'A1', to: { x: 3, y: 5 } };
          const rng2 = makeRNG(`wa-once-2-${seed}`);
          const result2 = applyMove(result, MOVE_AGAIN, rng2);

          // Should only have 1 wild-animal check log total
          const wildAnimalLogs = result2.gameLog.filter(l =>
            l.message.includes('Fureur')
          );
          expect(wildAnimalLogs).toHaveLength(1);
          found = true;
          break;
        }
      }
      expect(found).toBe(true);
    });
  });

  describe('Statistical distribution', () => {
    it('wild-animal on MOVE fails approximately 50% of the time (1-3 out of 6)', () => {
      const baseState = makeTestState();
      const state = setupWildAnimalScenario(baseState, true);

      let passes = 0;
      let fails = 0;
      for (let seed = 0; seed < 500; seed++) {
        const rng = makeRNG(`wa-move-stats-${seed}`);
        const result = applyMove(state, MOVE_LEFT, rng);

        if (result.gameLog.find(l =>
          l.message.includes('Fureur') && l.message.includes('✓')
        )) passes++;
        if (result.gameLog.find(l =>
          l.message.includes('Fureur') && l.message.includes('✗')
        )) fails++;
      }

      const total = passes + fails;
      expect(total).toBeGreaterThan(0);
      // Wild Animal on non-Block/Blitz fails on 1-3 out of 6 = 50%
      const failRate = fails / total;
      expect(failRate).toBeGreaterThan(0.35);
      expect(failRate).toBeLessThan(0.65);
    });

    it('wild-animal on BLOCK fails approximately 1/6 of the time (only natural 1)', () => {
      const baseState = makeTestState();
      const state = setupWildAnimalScenario(baseState, true, true);

      let passes = 0;
      let fails = 0;
      for (let seed = 0; seed < 500; seed++) {
        const rng = makeRNG(`wa-block-stats-${seed}`);
        const result = applyMove(state, BLOCK_B1, rng);

        if (result.gameLog.find(l =>
          l.message.includes('Fureur') && l.message.includes('✓')
        )) passes++;
        if (result.gameLog.find(l =>
          l.message.includes('Fureur') && l.message.includes('✗')
        )) fails++;
      }

      const total = passes + fails;
      expect(total).toBeGreaterThan(0);
      // Wild Animal on Block/Blitz: only natural 1 fails (1+2=3 <= 3), so ~16.7%
      const failRate = fails / total;
      expect(failRate).toBeGreaterThan(0.08);
      expect(failRate).toBeLessThan(0.30);
    });
  });
});
