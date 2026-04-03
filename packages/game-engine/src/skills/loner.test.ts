import { describe, it, expect, beforeEach } from 'vitest';
import { setup, applyMove, makeRNG } from '../index';
import type { GameState, Move } from '../core/types';
import { getSkillEffect } from './skill-registry';

/**
 * Loner (BB2020 rules):
 * - A player with Loner (X+) must roll X+ on a D6 before using a team reroll
 * - If the Loner check fails: the team reroll IS consumed (wasted), original failure applies
 * - If the Loner check passes: the team reroll proceeds normally
 * - Variants: loner-3 (3+), loner-4 (4+), loner-5 (5+)
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
 * A2 at (10,7) in B2's tackle zone at (10,8).
 * Legal dodge move: (10,6) — leaving B2's TZ.
 */
function setupDodgeScenario(
  baseState: GameState,
  lonerSkill: string | null,
): GameState {
  const a2Skills = lonerSkill ? [lonerSkill] : [];
  return {
    ...baseState,
    currentTeam: 'A' as const,
    players: baseState.players.map(p => {
      if (p.id === 'A2') return { ...p, pos: { x: 10, y: 7 }, pm: 6, state: 'active' as const, stunned: false, skills: a2Skills };
      if (p.id === 'B2') return { ...p, pos: { x: 10, y: 8 }, state: 'active' as const, stunned: false };
      return p;
    }),
  };
}

const DODGE_MOVE: Move = { type: 'MOVE', playerId: 'A2', to: { x: 10, y: 6 } };
const REROLL_ACCEPT: Move = { type: 'REROLL_CHOOSE', useReroll: true };

describe('Regle: Loner', () => {
  describe('Skill Registry', () => {
    it('loner-3 is registered in skill registry', () => {
      const effect = getSkillEffect('loner-3');
      expect(effect).toBeDefined();
      expect(effect!.slug).toBe('loner-3');
    });

    it('loner-4 is registered in skill registry', () => {
      const effect = getSkillEffect('loner-4');
      expect(effect).toBeDefined();
      expect(effect!.slug).toBe('loner-4');
    });

    it('loner-5 is registered in skill registry', () => {
      const effect = getSkillEffect('loner-5');
      expect(effect).toBeDefined();
      expect(effect!.slug).toBe('loner-5');
    });

    it('loner skills have passive trigger', () => {
      for (const slug of ['loner-3', 'loner-4', 'loner-5']) {
        const effect = getSkillEffect(slug);
        expect(effect!.triggers).toContain('passive');
      }
    });
  });

  describe('Loner check on team reroll', () => {
    let baseState: GameState;

    beforeEach(() => {
      baseState = makeTestState();
    });

    it('player without Loner uses team reroll normally (no Loner check)', () => {
      const state = setupDodgeScenario(baseState, null);

      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`no-loner-${seed}`);
        const afterDodge = applyMove(state, DODGE_MOVE, rng);

        if (afterDodge.pendingReroll) {
          const rng2 = makeRNG(`no-loner-reroll-${seed}`);
          const afterReroll = applyMove(afterDodge, REROLL_ACCEPT, rng2);
          const lonerLogs = afterReroll.gameLog.filter(l =>
            l.message.includes('Solitaire'),
          );
          expect(lonerLogs).toHaveLength(0);
          return; // Test passed
        }
      }
      // If dodge never failed in 200 seeds, that's fine — no Loner involved
    });

    it('Loner check pass allows team reroll to proceed', () => {
      const state = setupDodgeScenario(baseState, 'loner-4');

      let found = false;
      for (let seed = 0; seed < 500; seed++) {
        const rng = makeRNG(`loner-pass-${seed}`);
        const afterDodge = applyMove(state, DODGE_MOVE, rng);

        if (afterDodge.pendingReroll) {
          const rng2 = makeRNG(`loner-pass-reroll-${seed}`);
          const afterReroll = applyMove(afterDodge, REROLL_ACCEPT, rng2);

          const lonerPassLog = afterReroll.gameLog.find(l =>
            l.message.includes('Solitaire') && l.message.includes('✓'),
          );
          if (lonerPassLog) {
            found = true;
            // Reroll was consumed
            expect(afterReroll.teamRerolls.teamA).toBe(state.teamRerolls.teamA - 1);
            // Reroll execution log should exist
            const rerollLog = afterReroll.gameLog.find(l =>
              l.message.includes("Relance d'équipe utilisée"),
            );
            expect(rerollLog).toBeDefined();
            break;
          }
        }
      }
      expect(found).toBe(true);
    });

    it('Loner check fail wastes team reroll and applies original failure', () => {
      const state = setupDodgeScenario(baseState, 'loner-5');

      let found = false;
      for (let seed = 0; seed < 500; seed++) {
        const rng = makeRNG(`loner-fail-${seed}`);
        const afterDodge = applyMove(state, DODGE_MOVE, rng);

        if (afterDodge.pendingReroll) {
          const rng2 = makeRNG(`loner-fail-reroll-${seed}`);
          const afterReroll = applyMove(afterDodge, REROLL_ACCEPT, rng2);

          const lonerFailLog = afterReroll.gameLog.find(l =>
            l.message.includes('Solitaire') && l.message.includes('✗'),
          );
          if (lonerFailLog) {
            found = true;
            // Team reroll WAS consumed (wasted)
            expect(afterReroll.teamRerolls.teamA).toBe(state.teamRerolls.teamA - 1);
            expect(afterReroll.rerollUsedThisTurn).toBe(true);
            // Original failure applies (turnover)
            expect(afterReroll.isTurnover).toBe(true);
            break;
          }
        }
      }
      expect(found).toBe(true);
    });

    it('loner-3 threshold is 3+ (passes more often than it fails)', () => {
      const state = setupDodgeScenario(baseState, 'loner-3');

      let lonerPasses = 0;
      let lonerFails = 0;
      for (let seed = 0; seed < 500; seed++) {
        const rng = makeRNG(`loner3-${seed}`);
        const afterDodge = applyMove(state, DODGE_MOVE, rng);

        if (afterDodge.pendingReroll) {
          const rng2 = makeRNG(`loner3-reroll-${seed}`);
          const afterReroll = applyMove(afterDodge, REROLL_ACCEPT, rng2);

          if (afterReroll.gameLog.find(l => l.message.includes('Solitaire') && l.message.includes('✓'))) lonerPasses++;
          if (afterReroll.gameLog.find(l => l.message.includes('Solitaire') && l.message.includes('✗'))) lonerFails++;
        }
      }

      // loner-3 passes on 3,4,5,6 = 4/6 ≈ 66.7%
      expect(lonerPasses + lonerFails).toBeGreaterThan(0);
      expect(lonerPasses).toBeGreaterThan(lonerFails);
    });

    it('Loner check is logged in gameLog with roll and threshold', () => {
      const state = setupDodgeScenario(baseState, 'loner-4');

      let foundLog = false;
      for (let seed = 0; seed < 500; seed++) {
        const rng = makeRNG(`loner-log-${seed}`);
        const afterDodge = applyMove(state, DODGE_MOVE, rng);

        if (afterDodge.pendingReroll) {
          const rng2 = makeRNG(`loner-log-reroll-${seed}`);
          const afterReroll = applyMove(afterDodge, REROLL_ACCEPT, rng2);

          const lonerLog = afterReroll.gameLog.find(l =>
            l.message.includes('Solitaire'),
          );
          if (lonerLog) {
            foundLog = true;
            expect(lonerLog.message).toMatch(/Solitaire.*\d+\/\d+/);
            break;
          }
        }
      }
      expect(foundLog).toBe(true);
    });
  });
});
