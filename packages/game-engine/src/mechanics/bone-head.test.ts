import { describe, it, expect, beforeEach } from 'vitest';
import { setup, applyMove, makeRNG } from '../index';
import type { GameState, Move } from '../core/types';
import { getSkillEffect } from '../skills/skill-registry';

/**
 * Bone Head (BB3 Season 2/3 rules):
 * - At the start of this player's activation, roll a D6
 * - On a 1: the player can't perform any action, activation ends immediately
 * - On 2+: the player acts normally
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
 * A1 at (5,5) with optional bone-head.
 * B1 placed at (6,5) if adjacentTarget, else far away (20,10).
 * Other players moved out of the way to avoid tackle zone interference.
 */
function setupBoneHeadScenario(
  baseState: GameState,
  hasBoneHead: boolean,
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
          skills: hasBoneHead ? ['bone-head'] : [],
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

describe('Regle: Bone Head (Cerveau Lent)', () => {
  describe('Skill Registry', () => {
    it('bone-head is registered in skill registry', () => {
      const effect = getSkillEffect('bone-head');
      expect(effect).toBeDefined();
      expect(effect!.slug).toBe('bone-head');
    });

    it('bone-head has on-activation trigger', () => {
      const effect = getSkillEffect('bone-head');
      expect(effect!.triggers).toContain('on-activation');
    });
  });

  describe('Bone Head activation check on MOVE', () => {
    let baseState: GameState;

    beforeEach(() => {
      baseState = makeTestState();
    });

    it('player without bone-head can move normally (no activation roll)', () => {
      const state = setupBoneHeadScenario(baseState, false);
      const rng = makeRNG('no-bone-head-move');
      const result = applyMove(state, MOVE_LEFT, rng);

      const a1 = result.players.find(p => p.id === 'A1')!;
      expect(a1.pos).toEqual({ x: 4, y: 5 });

      const boneHeadLogs = result.gameLog.filter(l =>
        l.message.includes('Cerveau Lent')
      );
      expect(boneHeadLogs).toHaveLength(0);
    });

    it('bone-head roll of 2+ allows normal movement', () => {
      const state = setupBoneHeadScenario(baseState, true);

      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`bh-pass-${seed}`);
        const result = applyMove(state, MOVE_LEFT, rng);

        const passLog = result.gameLog.find(l =>
          l.message.includes('Cerveau Lent') && l.message.includes('✓')
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

    it('bone-head roll of 1 prevents movement (player stays in place)', () => {
      const state = setupBoneHeadScenario(baseState, true);

      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`bh-fail-${seed}`);
        const result = applyMove(state, MOVE_LEFT, rng);

        const failLog = result.gameLog.find(l =>
          l.message.includes('Cerveau Lent') && l.message.includes('✗')
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

    it('bone-head failure is NOT a turnover', () => {
      const state = setupBoneHeadScenario(baseState, true);

      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`bh-no-to-${seed}`);
        const result = applyMove(state, MOVE_LEFT, rng);

        const failLog = result.gameLog.find(l =>
          l.message.includes('Cerveau Lent') && l.message.includes('✗')
        );
        if (failLog) {
          found = true;
          expect(result.isTurnover).toBe(false);
          break;
        }
      }
      expect(found).toBe(true);
    });

    it('bone-head failure marks player as having acted with 0 PM', () => {
      const state = setupBoneHeadScenario(baseState, true);

      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`bh-acted-${seed}`);
        const result = applyMove(state, MOVE_LEFT, rng);

        const failLog = result.gameLog.find(l =>
          l.message.includes('Cerveau Lent') && l.message.includes('✗')
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

    it('bone-head check happens only once per activation (not on subsequent moves)', () => {
      const state = setupBoneHeadScenario(baseState, true);

      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`bh-once-${seed}`);
        const result = applyMove(state, MOVE_LEFT, rng);

        const passLog = result.gameLog.find(l =>
          l.message.includes('Cerveau Lent') && l.message.includes('✓')
        );
        if (passLog) {
          // First move succeeded, now do a second move
          const MOVE_AGAIN: Move = { type: 'MOVE', playerId: 'A1', to: { x: 3, y: 5 } };
          const rng2 = makeRNG(`bh-once-2-${seed}`);
          const result2 = applyMove(result, MOVE_AGAIN, rng2);

          // Should only have 1 bone-head check log total
          const boneHeadLogs = result2.gameLog.filter(l =>
            l.message.includes('Cerveau Lent')
          );
          expect(boneHeadLogs).toHaveLength(1);
          found = true;
          break;
        }
      }
      expect(found).toBe(true);
    });

    it('bone-head failure logs confusion message', () => {
      const state = setupBoneHeadScenario(baseState, true);

      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`bh-log-${seed}`);
        const result = applyMove(state, MOVE_LEFT, rng);

        const failLog = result.gameLog.find(l =>
          l.message.includes('Cerveau Lent') && l.message.includes('✗')
        );
        if (failLog) {
          found = true;
          const confusionLog = result.gameLog.find(l =>
            l.message.includes('confus') && l.message.includes('ne peut pas agir')
          );
          expect(confusionLog).toBeDefined();
          break;
        }
      }
      expect(found).toBe(true);
    });
  });

  describe('Bone Head activation check on BLOCK', () => {
    let baseState: GameState;

    beforeEach(() => {
      baseState = makeTestState();
    });

    it('bone-head roll of 1 prevents block action', () => {
      const state = setupBoneHeadScenario(baseState, true, true);

      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`bh-block-fail-${seed}`);
        const result = applyMove(state, BLOCK_B1, rng);

        const failLog = result.gameLog.find(l =>
          l.message.includes('Cerveau Lent') && l.message.includes('✗')
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

    it('bone-head roll of 2+ allows block to proceed', () => {
      const state = setupBoneHeadScenario(baseState, true, true);

      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`bh-block-pass-${seed}`);
        const result = applyMove(state, BLOCK_B1, rng);

        const passLog = result.gameLog.find(l =>
          l.message.includes('Cerveau Lent') && l.message.includes('✓')
        );
        if (passLog) {
          found = true;
          // Block should have been attempted (block dice log or pending block)
          const hasBlock = result.gameLog.some(l =>
            l.message.includes('Blocage')
          ) || result.pendingBlock !== undefined;
          expect(hasBlock).toBe(true);
          break;
        }
      }
      expect(found).toBe(true);
    });
  });

  describe('Statistical distribution', () => {
    it('bone-head fails approximately 1/6 of the time', () => {
      const baseState = makeTestState();
      const state = setupBoneHeadScenario(baseState, true);

      let passes = 0;
      let fails = 0;
      for (let seed = 0; seed < 500; seed++) {
        const rng = makeRNG(`bh-stats-${seed}`);
        const result = applyMove(state, MOVE_LEFT, rng);

        if (result.gameLog.find(l =>
          l.message.includes('Cerveau Lent') && l.message.includes('✓')
        )) passes++;
        if (result.gameLog.find(l =>
          l.message.includes('Cerveau Lent') && l.message.includes('✗')
        )) fails++;
      }

      const total = passes + fails;
      expect(total).toBeGreaterThan(0);
      // Bone-head fails on 1 out of 6 ≈ 16.7%
      const failRate = fails / total;
      expect(failRate).toBeGreaterThan(0.08);
      expect(failRate).toBeLessThan(0.30);
    });
  });
});
