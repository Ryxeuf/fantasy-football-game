import { describe, it, expect, beforeEach } from 'vitest';
import { setup, applyMove, makeRNG } from '../index';
import type { GameState, Move } from '../core/types';
import { getSkillEffect } from '../skills/skill-registry';

/**
 * Really Stupid (BB3 Season 2/3 rules):
 * - At the start of this player's activation, roll a D6
 * - If adjacent to a standing teammate without Really Stupid: +2 modifier → succeed on 2+
 * - If NOT adjacent to such a teammate: succeed on 4+ (fail on 1-3)
 * - On failure: activation ends immediately, NOT a turnover
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
 * A1 at (5,5) with optional really-stupid.
 * A2 at (6,5) if adjacentTeammate = true (standing, non-RS teammate).
 * A2 at (6,5) with really-stupid if adjacentRS = true (RS teammate — doesn't count).
 * B1 placed at (7,5) if adjacentTarget, else far away.
 * Other players moved out of the way.
 */
function setupReallyStupidScenario(
  baseState: GameState,
  options: {
    hasReallyStupid: boolean;
    skillSlug?: string;
    adjacentTeammate?: boolean;
    adjacentTeammateHasRS?: boolean;
    adjacentTarget?: boolean;
  }
): GameState {
  const {
    hasReallyStupid,
    skillSlug = 'really-stupid',
    adjacentTeammate = false,
    adjacentTeammateHasRS = false,
    adjacentTarget = false,
  } = options;

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
          skills: hasReallyStupid ? [skillSlug] : [],
          gfiUsed: 0,
        };
      }
      if (p.id === 'A2') {
        // Teammate — adjacent or far away
        const teammateSkills: string[] = adjacentTeammateHasRS ? ['really-stupid'] : [];
        return {
          ...p,
          pos: adjacentTeammate || adjacentTeammateHasRS ? { x: 5, y: 6 } : { x: 1, y: 2 },
          pm: 6,
          st: 3,
          state: 'active' as const,
          stunned: false,
          skills: teammateSkills,
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

describe('Regle: Really Stupid (Gros Débile)', () => {
  describe('Skill Registry', () => {
    it('really-stupid is registered in skill registry', () => {
      const effect = getSkillEffect('really-stupid');
      expect(effect).toBeDefined();
      expect(effect!.slug).toBe('really-stupid');
    });

    it('really-stupid has on-activation trigger', () => {
      const effect = getSkillEffect('really-stupid');
      expect(effect!.triggers).toContain('on-activation');
    });

    it('really-stupid-2 is registered in skill registry', () => {
      const effect = getSkillEffect('really-stupid-2');
      expect(effect).toBeDefined();
      expect(effect!.slug).toBe('really-stupid-2');
    });

    it('really-stupid-2 has on-activation trigger', () => {
      const effect = getSkillEffect('really-stupid-2');
      expect(effect!.triggers).toContain('on-activation');
    });
  });

  describe('Player without really-stupid', () => {
    let baseState: GameState;

    beforeEach(() => {
      baseState = makeTestState();
    });

    it('player without really-stupid can move normally (no activation roll)', () => {
      const state = setupReallyStupidScenario(baseState, { hasReallyStupid: false });
      const rng = makeRNG('no-rs-move');
      const result = applyMove(state, MOVE_LEFT, rng);

      const a1 = result.players.find(p => p.id === 'A1')!;
      expect(a1.pos).toEqual({ x: 4, y: 5 });

      const rsLogs = result.gameLog.filter(l =>
        l.message.includes('Gros Débile')
      );
      expect(rsLogs).toHaveLength(0);
    });
  });

  describe('With adjacent non-RS teammate (succeed on 2+)', () => {
    let baseState: GameState;

    beforeEach(() => {
      baseState = makeTestState();
    });

    it('roll of 2+ with adjacent teammate allows movement', () => {
      const state = setupReallyStupidScenario(baseState, {
        hasReallyStupid: true,
        adjacentTeammate: true,
      });

      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`rs-adj-pass-${seed}`);
        const result = applyMove(state, MOVE_LEFT, rng);

        const passLog = result.gameLog.find(l =>
          l.message.includes('Gros Débile') && l.message.includes('✓')
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

    it('roll of 1 with adjacent teammate prevents movement', () => {
      const state = setupReallyStupidScenario(baseState, {
        hasReallyStupid: true,
        adjacentTeammate: true,
      });

      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`rs-adj-fail-${seed}`);
        const result = applyMove(state, MOVE_LEFT, rng);

        const failLog = result.gameLog.find(l =>
          l.message.includes('Gros Débile') && l.message.includes('✗')
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

    it('with adjacent teammate fails ~1/6 (only on roll of 1)', () => {
      const state = setupReallyStupidScenario(baseState, {
        hasReallyStupid: true,
        adjacentTeammate: true,
      });

      let fails = 0;
      let total = 0;
      for (let seed = 0; seed < 500; seed++) {
        const rng = makeRNG(`rs-adj-stats-${seed}`);
        const result = applyMove(state, MOVE_LEFT, rng);

        if (result.gameLog.find(l =>
          l.message.includes('Gros Débile') && l.message.includes('✓')
        )) total++;
        if (result.gameLog.find(l =>
          l.message.includes('Gros Débile') && l.message.includes('✗')
        )) {
          fails++;
          total++;
        }
      }

      expect(total).toBeGreaterThan(0);
      const failRate = fails / total;
      // With teammate: fail on 1 only → ~16.7%
      expect(failRate).toBeGreaterThan(0.08);
      expect(failRate).toBeLessThan(0.30);
    });
  });

  describe('Without adjacent non-RS teammate (succeed on 4+)', () => {
    let baseState: GameState;

    beforeEach(() => {
      baseState = makeTestState();
    });

    it('roll of 4+ without adjacent teammate allows movement', () => {
      const state = setupReallyStupidScenario(baseState, {
        hasReallyStupid: true,
        adjacentTeammate: false,
      });

      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`rs-alone-pass-${seed}`);
        const result = applyMove(state, MOVE_LEFT, rng);

        const passLog = result.gameLog.find(l =>
          l.message.includes('Gros Débile') && l.message.includes('✓')
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

    it('roll of 1-3 without adjacent teammate prevents movement', () => {
      const state = setupReallyStupidScenario(baseState, {
        hasReallyStupid: true,
        adjacentTeammate: false,
      });

      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`rs-alone-fail-${seed}`);
        const result = applyMove(state, MOVE_LEFT, rng);

        const failLog = result.gameLog.find(l =>
          l.message.includes('Gros Débile') && l.message.includes('✗')
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

    it('without adjacent teammate fails ~50% (on roll of 1-3)', () => {
      const state = setupReallyStupidScenario(baseState, {
        hasReallyStupid: true,
        adjacentTeammate: false,
      });

      let fails = 0;
      let total = 0;
      for (let seed = 0; seed < 500; seed++) {
        const rng = makeRNG(`rs-alone-stats-${seed}`);
        const result = applyMove(state, MOVE_LEFT, rng);

        if (result.gameLog.find(l =>
          l.message.includes('Gros Débile') && l.message.includes('✓')
        )) total++;
        if (result.gameLog.find(l =>
          l.message.includes('Gros Débile') && l.message.includes('✗')
        )) {
          fails++;
          total++;
        }
      }

      expect(total).toBeGreaterThan(0);
      const failRate = fails / total;
      // Without teammate: fail on 1-3 → ~50%
      expect(failRate).toBeGreaterThan(0.35);
      expect(failRate).toBeLessThan(0.65);
    });
  });

  describe('Adjacent RS teammate does not count', () => {
    let baseState: GameState;

    beforeEach(() => {
      baseState = makeTestState();
    });

    it('adjacent teammate with really-stupid does not help (needs 4+)', () => {
      const state = setupReallyStupidScenario(baseState, {
        hasReallyStupid: true,
        adjacentTeammateHasRS: true,
      });

      let fails = 0;
      let total = 0;
      for (let seed = 0; seed < 500; seed++) {
        const rng = makeRNG(`rs-rs-adj-${seed}`);
        const result = applyMove(state, MOVE_LEFT, rng);

        if (result.gameLog.find(l =>
          l.message.includes('Gros Débile') && l.message.includes('✓')
        )) total++;
        if (result.gameLog.find(l =>
          l.message.includes('Gros Débile') && l.message.includes('✗')
        )) {
          fails++;
          total++;
        }
      }

      expect(total).toBeGreaterThan(0);
      const failRate = fails / total;
      // RS teammate doesn't help → still fail on 1-3 → ~50%
      expect(failRate).toBeGreaterThan(0.35);
      expect(failRate).toBeLessThan(0.65);
    });
  });

  describe('Failure behavior', () => {
    let baseState: GameState;

    beforeEach(() => {
      baseState = makeTestState();
    });

    it('really-stupid failure is NOT a turnover', () => {
      const state = setupReallyStupidScenario(baseState, {
        hasReallyStupid: true,
        adjacentTeammate: false,
      });

      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`rs-no-to-${seed}`);
        const result = applyMove(state, MOVE_LEFT, rng);

        const failLog = result.gameLog.find(l =>
          l.message.includes('Gros Débile') && l.message.includes('✗')
        );
        if (failLog) {
          found = true;
          expect(result.isTurnover).toBe(false);
          break;
        }
      }
      expect(found).toBe(true);
    });

    it('failure marks player as having acted with 0 PM', () => {
      const state = setupReallyStupidScenario(baseState, {
        hasReallyStupid: true,
        adjacentTeammate: false,
      });

      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`rs-acted-${seed}`);
        const result = applyMove(state, MOVE_LEFT, rng);

        const failLog = result.gameLog.find(l =>
          l.message.includes('Gros Débile') && l.message.includes('✗')
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

    it('failure logs confusion message', () => {
      const state = setupReallyStupidScenario(baseState, {
        hasReallyStupid: true,
        adjacentTeammate: false,
      });

      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`rs-log-${seed}`);
        const result = applyMove(state, MOVE_LEFT, rng);

        const failLog = result.gameLog.find(l =>
          l.message.includes('Gros Débile') && l.message.includes('✗')
        );
        if (failLog) {
          found = true;
          const confusionLog = result.gameLog.find(l =>
            l.message.includes('stupide') && l.message.includes('ne peut pas agir')
          );
          expect(confusionLog).toBeDefined();
          break;
        }
      }
      expect(found).toBe(true);
    });
  });

  describe('Activation check once per turn', () => {
    let baseState: GameState;

    beforeEach(() => {
      baseState = makeTestState();
    });

    it('check happens only once per activation (not on subsequent moves)', () => {
      const state = setupReallyStupidScenario(baseState, {
        hasReallyStupid: true,
        adjacentTeammate: true,
      });

      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`rs-once-${seed}`);
        const result = applyMove(state, MOVE_LEFT, rng);

        const passLog = result.gameLog.find(l =>
          l.message.includes('Gros Débile') && l.message.includes('✓')
        );
        if (passLog) {
          // First move succeeded, now do a second move
          const MOVE_AGAIN: Move = { type: 'MOVE', playerId: 'A1', to: { x: 3, y: 5 } };
          const rng2 = makeRNG(`rs-once-2-${seed}`);
          const result2 = applyMove(result, MOVE_AGAIN, rng2);

          // Should only have 1 really-stupid check log total
          const rsLogs = result2.gameLog.filter(l =>
            l.message.includes('Gros Débile')
          );
          expect(rsLogs).toHaveLength(1);
          found = true;
          break;
        }
      }
      expect(found).toBe(true);
    });
  });

  describe('Really Stupid on BLOCK', () => {
    let baseState: GameState;

    beforeEach(() => {
      baseState = makeTestState();
    });

    it('roll failure prevents block action', () => {
      const state = setupReallyStupidScenario(baseState, {
        hasReallyStupid: true,
        adjacentTeammate: false,
        adjacentTarget: true,
      });

      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`rs-block-fail-${seed}`);
        const result = applyMove(state, BLOCK_B1, rng);

        const failLog = result.gameLog.find(l =>
          l.message.includes('Gros Débile') && l.message.includes('✗')
        );
        if (failLog) {
          found = true;
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

    it('roll success allows block to proceed', () => {
      const state = setupReallyStupidScenario(baseState, {
        hasReallyStupid: true,
        adjacentTeammate: true,
        adjacentTarget: true,
      });

      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`rs-block-pass-${seed}`);
        const result = applyMove(state, BLOCK_B1, rng);

        const passLog = result.gameLog.find(l =>
          l.message.includes('Gros Débile') && l.message.includes('✓')
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
  });

  describe('really-stupid-2 variant', () => {
    let baseState: GameState;

    beforeEach(() => {
      baseState = makeTestState();
    });

    it('really-stupid-2 uses the same activation check', () => {
      const state = setupReallyStupidScenario(baseState, {
        hasReallyStupid: true,
        skillSlug: 'really-stupid-2',
        adjacentTeammate: true,
      });

      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`rs2-pass-${seed}`);
        const result = applyMove(state, MOVE_LEFT, rng);

        const passLog = result.gameLog.find(l =>
          l.message.includes('Gros Débile') && l.message.includes('✓')
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

    it('really-stupid-2 failure without teammate (needs 4+)', () => {
      const state = setupReallyStupidScenario(baseState, {
        hasReallyStupid: true,
        skillSlug: 'really-stupid-2',
        adjacentTeammate: false,
      });

      let fails = 0;
      let total = 0;
      for (let seed = 0; seed < 500; seed++) {
        const rng = makeRNG(`rs2-alone-${seed}`);
        const result = applyMove(state, MOVE_LEFT, rng);

        if (result.gameLog.find(l =>
          l.message.includes('Gros Débile') && l.message.includes('✓')
        )) total++;
        if (result.gameLog.find(l =>
          l.message.includes('Gros Débile') && l.message.includes('✗')
        )) {
          fails++;
          total++;
        }
      }

      expect(total).toBeGreaterThan(0);
      const failRate = fails / total;
      // Without teammate: fail on 1-3 → ~50%
      expect(failRate).toBeGreaterThan(0.35);
      expect(failRate).toBeLessThan(0.65);
    });
  });

  describe('Log details', () => {
    let baseState: GameState;

    beforeEach(() => {
      baseState = makeTestState();
    });

    it('log shows target number 2 with adjacent teammate', () => {
      const state = setupReallyStupidScenario(baseState, {
        hasReallyStupid: true,
        adjacentTeammate: true,
      });

      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`rs-log-tn2-${seed}`);
        const result = applyMove(state, MOVE_LEFT, rng);

        const rsLog = result.gameLog.find(l =>
          l.message.includes('Gros Débile') && l.message.includes('/2')
        );
        if (rsLog) {
          found = true;
          expect(rsLog.details).toBeDefined();
          expect((rsLog.details as Record<string, unknown>).targetNumber).toBe(2);
          expect((rsLog.details as Record<string, unknown>).skill).toBe('really-stupid');
          break;
        }
      }
      expect(found).toBe(true);
    });

    it('log shows target number 4 without adjacent teammate', () => {
      const state = setupReallyStupidScenario(baseState, {
        hasReallyStupid: true,
        adjacentTeammate: false,
      });

      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`rs-log-tn4-${seed}`);
        const result = applyMove(state, MOVE_LEFT, rng);

        const rsLog = result.gameLog.find(l =>
          l.message.includes('Gros Débile') && l.message.includes('/4')
        );
        if (rsLog) {
          found = true;
          expect(rsLog.details).toBeDefined();
          expect((rsLog.details as Record<string, unknown>).targetNumber).toBe(4);
          expect((rsLog.details as Record<string, unknown>).skill).toBe('really-stupid');
          break;
        }
      }
      expect(found).toBe(true);
    });
  });
});
