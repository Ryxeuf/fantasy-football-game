import { describe, it, expect, beforeEach } from 'vitest';
import { setup, applyMove, makeRNG } from '../index';
import type { GameState, Move } from '../core/types';
import { getSkillEffect } from '../skills/skill-registry';

/**
 * Foul Appearance (Répulsion*) — BB3 Season 2/3:
 * - When an opposing player declares a Block action targeting this player,
 *   the attacker's coach must first roll a D6.
 * - On a 1: the attacker can't perform the declared Block and the action is
 *   wasted (activation ends). This is NOT a turnover.
 * - On 2+: the Block proceeds as normal.
 *
 * The same check applies to the block portion of a Blitz action.
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
 * Place A1 at (5,5) as the attacker and B1 at (6,5) as the target.
 * Move every other player far away so they do not interfere with the test.
 */
function setupFoulAppearanceScenario(
  baseState: GameState,
  targetHasFoulAppearance: boolean,
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
          st: 4,
          state: 'active' as const,
          stunned: false,
          skills: [],
          gfiUsed: 0,
        };
      }
      if (p.id === 'B1') {
        return {
          ...p,
          pos: { x: 6, y: 5 },
          pm: 6,
          st: 3,
          state: 'active' as const,
          stunned: false,
          skills: targetHasFoulAppearance ? ['foul-appearance'] : [],
        };
      }
      if (p.team === 'A') {
        return { ...p, pos: { x: 1, y: 1 }, state: 'active' as const, stunned: false };
      }
      return { ...p, pos: { x: 24, y: 13 }, state: 'active' as const, stunned: false };
    }),
  };
}

const BLOCK_B1: Move = { type: 'BLOCK', playerId: 'A1', targetId: 'B1' };

describe('Regle: Foul Appearance (Répulsion)', () => {
  describe('Skill Registry', () => {
    it('foul-appearance is registered in skill registry', () => {
      const effect = getSkillEffect('foul-appearance');
      expect(effect).toBeDefined();
      expect(effect!.slug).toBe('foul-appearance');
    });

    it('foul-appearance has on-block-defender trigger', () => {
      const effect = getSkillEffect('foul-appearance');
      expect(effect!.triggers).toContain('on-block-defender');
    });
  });

  describe('Foul Appearance activation check on BLOCK', () => {
    let baseState: GameState;

    beforeEach(() => {
      baseState = makeTestState();
    });

    it('target without foul-appearance: no check is rolled', () => {
      const state = setupFoulAppearanceScenario(baseState, false);
      const rng = makeRNG('no-fa-seed');
      const result = applyMove(state, BLOCK_B1, rng);

      const faLogs = result.gameLog.filter(l => l.message.includes('Répulsion'));
      expect(faLogs).toHaveLength(0);
    });

    it('roll 2+: block proceeds normally', () => {
      const state = setupFoulAppearanceScenario(baseState, true);

      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`fa-pass-${seed}`);
        const result = applyMove(state, BLOCK_B1, rng);

        const passLog = result.gameLog.find(l =>
          l.message.includes('Répulsion') && l.message.includes('✓')
        );
        if (passLog) {
          found = true;
          const hasBlock = result.gameLog.some(l =>
            l.message.includes('Blocage')
          ) || result.pendingBlock !== undefined;
          expect(hasBlock).toBe(true);
          break;
        }
      }
      expect(found).toBe(true);
    });

    it('roll 1: block is cancelled (no block dice rolled)', () => {
      const state = setupFoulAppearanceScenario(baseState, true);

      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`fa-fail-${seed}`);
        const result = applyMove(state, BLOCK_B1, rng);

        const failLog = result.gameLog.find(l =>
          l.message.includes('Répulsion') && l.message.includes('✗')
        );
        if (failLog) {
          found = true;
          const blockLogs = result.gameLog.filter(l =>
            l.message.includes('Blocage')
          );
          expect(blockLogs).toHaveLength(0);
          expect(result.pendingBlock).toBeUndefined();
          break;
        }
      }
      expect(found).toBe(true);
    });

    it('roll 1 is NOT a turnover', () => {
      const state = setupFoulAppearanceScenario(baseState, true);

      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`fa-no-to-${seed}`);
        const result = applyMove(state, BLOCK_B1, rng);

        const failLog = result.gameLog.find(l =>
          l.message.includes('Répulsion') && l.message.includes('✗')
        );
        if (failLog) {
          found = true;
          expect(result.isTurnover).toBe(false);
          break;
        }
      }
      expect(found).toBe(true);
    });

    it('roll 1 consumes the attacker activation (action registered, 0 PM)', () => {
      const state = setupFoulAppearanceScenario(baseState, true);

      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`fa-consumed-${seed}`);
        const result = applyMove(state, BLOCK_B1, rng);

        const failLog = result.gameLog.find(l =>
          l.message.includes('Répulsion') && l.message.includes('✗')
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

    it('roll 1 logs a repulsion message', () => {
      const state = setupFoulAppearanceScenario(baseState, true);

      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`fa-log-${seed}`);
        const result = applyMove(state, BLOCK_B1, rng);

        const failLog = result.gameLog.find(l =>
          l.message.includes('Répulsion') && l.message.includes('✗')
        );
        if (failLog) {
          found = true;
          const repLog = result.gameLog.find(l =>
            l.message.includes('répugné') || l.message.includes('repugne')
          );
          expect(repLog).toBeDefined();
          break;
        }
      }
      expect(found).toBe(true);
    });
  });

  describe('Statistical distribution', () => {
    it('foul-appearance fails approximately 1/6 of the time', () => {
      const baseState = makeTestState();
      const state = setupFoulAppearanceScenario(baseState, true);

      let passes = 0;
      let fails = 0;
      for (let seed = 0; seed < 600; seed++) {
        const rng = makeRNG(`fa-stats-${seed}`);
        const result = applyMove(state, BLOCK_B1, rng);

        if (result.gameLog.find(l =>
          l.message.includes('Répulsion') && l.message.includes('✓')
        )) passes++;
        if (result.gameLog.find(l =>
          l.message.includes('Répulsion') && l.message.includes('✗')
        )) fails++;
      }

      const total = passes + fails;
      expect(total).toBeGreaterThan(0);
      const failRate = fails / total;
      // 1/6 ≈ 16.7%. Generous bounds to avoid flakiness.
      expect(failRate).toBeGreaterThan(0.08);
      expect(failRate).toBeLessThan(0.30);
    });
  });
});
