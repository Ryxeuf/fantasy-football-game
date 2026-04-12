import { describe, it, expect, beforeEach } from 'vitest';
import { setup, applyMove, makeRNG } from '../index';
import type { GameState, Move } from '../core/types';
import { getSkillEffect } from '../skills/skill-registry';

/**
 * Animal Savagery (BB3 Season 2/3 rules):
 * - At the start of this player's activation, roll a D6
 * - On a 2+: player may perform their declared action as normal
 * - On a 1: player lashes out at a random adjacent standing teammate
 *   -> If adjacent standing teammate exists: perform forced block, then continue action
 *   -> If no adjacent standing teammate: activation ends immediately (NOT a turnover)
 * - Neither outcome causes a Turnover (the forced block itself can if attacker goes down)
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
 * A1 at (5,5) with optional animal-savagery (ST 5 big guy).
 * A2 at adjacentTeammate position (6,5) if present, else far away.
 * B1 placed far away to avoid interference.
 */
function setupAnimalSavageryScenario(
  baseState: GameState,
  hasAnimalSavagery: boolean,
  options: {
    adjacentTeammate?: boolean;
    adjacentTeammatePos?: { x: number; y: number };
    multipleAdjacentTeammates?: boolean;
  } = {}
): GameState {
  const { adjacentTeammate = false, adjacentTeammatePos, multipleAdjacentTeammates = false } = options;
  const teammatePos = adjacentTeammatePos ?? { x: 6, y: 5 };

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
          skills: hasAnimalSavagery ? ['animal-savagery'] : [],
          gfiUsed: 0,
        };
      }
      if (p.id === 'A2') {
        return {
          ...p,
          pos: adjacentTeammate ? teammatePos : { x: 1, y: 14 },
          pm: 8,
          ma: 8,
          st: 3,
          av: 8,
          state: 'active' as const,
          stunned: false,
          skills: [],
          team: 'A' as const,
        };
      }
      if (p.id === 'A3' && multipleAdjacentTeammates) {
        return {
          ...p,
          pos: { x: 4, y: 5 },
          pm: 8,
          ma: 8,
          st: 3,
          av: 8,
          state: 'active' as const,
          stunned: false,
          skills: [],
          team: 'A' as const,
        };
      }
      // Move other team A players far away
      if (p.team === 'A') {
        return { ...p, pos: { x: 1, y: 1 }, state: 'active' as const, stunned: false };
      }
      // Move team B players far away
      return { ...p, pos: { x: 24, y: 13 }, state: 'active' as const, stunned: false };
    }),
  };
}

const MOVE_LEFT: Move = { type: 'MOVE', playerId: 'A1', to: { x: 4, y: 5 } };

describe('Regle: Animal Savagery (Sauvagerie Animale)', () => {
  describe('Skill Registry', () => {
    it('animal-savagery is registered in skill registry', () => {
      const effect = getSkillEffect('animal-savagery');
      expect(effect).toBeDefined();
      expect(effect!.slug).toBe('animal-savagery');
    });

    it('animal-savagery has on-activation trigger', () => {
      const effect = getSkillEffect('animal-savagery');
      expect(effect!.triggers).toContain('on-activation');
    });
  });

  describe('Activation check on MOVE', () => {
    let baseState: GameState;

    beforeEach(() => {
      baseState = makeTestState();
    });

    it('player without animal-savagery can move normally (no activation roll)', () => {
      const state = setupAnimalSavageryScenario(baseState, false);
      const rng = makeRNG('no-animal-savagery');
      const result = applyMove(state, MOVE_LEFT, rng);

      const a1 = result.players.find(p => p.id === 'A1')!;
      expect(a1.pos).toEqual({ x: 4, y: 5 });

      const savageryLogs = result.gameLog.filter(l =>
        l.message.includes('Sauvagerie')
      );
      expect(savageryLogs).toHaveLength(0);
    });

    it('roll of 2+ allows normal movement', () => {
      const state = setupAnimalSavageryScenario(baseState, true);

      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`as-pass-${seed}`);
        const result = applyMove(state, MOVE_LEFT, rng);

        const passLog = result.gameLog.find(l =>
          l.message.includes('Sauvagerie') && l.message.includes('✓')
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

    it('roll of 1 without adjacent teammate ends activation (player stays in place)', () => {
      // No adjacent teammate — activation ends
      const state = setupAnimalSavageryScenario(baseState, true, { adjacentTeammate: false });

      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`as-fail-no-tm-${seed}`);
        const result = applyMove(state, MOVE_LEFT, rng);

        const failLog = result.gameLog.find(l =>
          l.message.includes('Sauvagerie') && l.message.includes('✗')
        );
        if (failLog) {
          found = true;
          const a1 = result.players.find(p => p.id === 'A1')!;
          expect(a1.pos).toEqual({ x: 5, y: 5 }); // Didn't move
          break;
        }
      }
      expect(found).toBe(true);
    });

    it('failure without adjacent teammate is NOT a turnover', () => {
      const state = setupAnimalSavageryScenario(baseState, true, { adjacentTeammate: false });

      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`as-no-to-${seed}`);
        const result = applyMove(state, MOVE_LEFT, rng);

        const failLog = result.gameLog.find(l =>
          l.message.includes('Sauvagerie') && l.message.includes('✗')
        );
        if (failLog) {
          found = true;
          expect(result.isTurnover).toBe(false);
          break;
        }
      }
      expect(found).toBe(true);
    });

    it('failure without adjacent teammate marks player as acted with 0 PM', () => {
      const state = setupAnimalSavageryScenario(baseState, true, { adjacentTeammate: false });

      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`as-acted-${seed}`);
        const result = applyMove(state, MOVE_LEFT, rng);

        const failLog = result.gameLog.find(l =>
          l.message.includes('Sauvagerie') && l.message.includes('✗')
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

    it('roll of 1 with adjacent teammate triggers forced block and allows continued action', () => {
      // Adjacent teammate present — forced block, then attacker can continue
      const state = setupAnimalSavageryScenario(baseState, true, { adjacentTeammate: true });

      let found = false;
      for (let seed = 0; seed < 500; seed++) {
        const rng = makeRNG(`as-lash-continue-${seed}`);
        const result = applyMove(state, MOVE_LEFT, rng);

        const failLog = result.gameLog.find(l =>
          l.message.includes('Sauvagerie') && l.message.includes('✗')
        );
        if (!failLog) continue;

        const lashLog = result.gameLog.find(l =>
          l.message.includes('attaque sauvagement')
        );
        if (!lashLog) continue;

        // If the attacker is still standing (not PLAYER_DOWN / BOTH_DOWN),
        // they should have been able to continue moving
        const a1 = result.players.find(p => p.id === 'A1')!;
        if (a1.state === 'active' && !a1.stunned) {
          found = true;
          // Attacker should have moved to (4,5)
          expect(a1.pos).toEqual({ x: 4, y: 5 });
          break;
        }
      }
      expect(found).toBe(true);
    });

    it('forced block logs lash out message with target name', () => {
      const state = setupAnimalSavageryScenario(baseState, true, { adjacentTeammate: true });

      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`as-lash-log-${seed}`);
        const result = applyMove(state, MOVE_LEFT, rng);

        const failLog = result.gameLog.find(l =>
          l.message.includes('Sauvagerie') && l.message.includes('✗')
        );
        if (failLog) {
          found = true;
          const lashLog = result.gameLog.find(l =>
            l.message.includes('attaque sauvagement')
          );
          expect(lashLog).toBeDefined();
          break;
        }
      }
      expect(found).toBe(true);
    });
  });

  describe('Check happens only once per activation', () => {
    it('animal-savagery check not repeated on subsequent moves', () => {
      const baseState = makeTestState();
      const state = setupAnimalSavageryScenario(baseState, true);

      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`as-once-${seed}`);
        const result = applyMove(state, MOVE_LEFT, rng);

        const passLog = result.gameLog.find(l =>
          l.message.includes('Sauvagerie') && l.message.includes('✓')
        );
        if (passLog) {
          // First move succeeded, now do a second move
          const MOVE_AGAIN: Move = { type: 'MOVE', playerId: 'A1', to: { x: 3, y: 5 } };
          const rng2 = makeRNG(`as-once-2-${seed}`);
          const result2 = applyMove(result, MOVE_AGAIN, rng2);

          // Should only have 1 animal-savagery check log total
          const savageryLogs = result2.gameLog.filter(l =>
            l.message.includes('Sauvagerie')
          );
          expect(savageryLogs).toHaveLength(1);
          found = true;
          break;
        }
      }
      expect(found).toBe(true);
    });
  });

  describe('Statistical distribution', () => {
    it('animal-savagery fails approximately 1/6 of the time (only on natural 1)', () => {
      const baseState = makeTestState();
      const state = setupAnimalSavageryScenario(baseState, true);

      let passes = 0;
      let fails = 0;
      for (let seed = 0; seed < 500; seed++) {
        const rng = makeRNG(`as-stats-${seed}`);
        const result = applyMove(state, MOVE_LEFT, rng);

        if (result.gameLog.find(l =>
          l.message.includes('Sauvagerie') && l.message.includes('✓')
        )) passes++;
        if (result.gameLog.find(l =>
          l.message.includes('Sauvagerie') && l.message.includes('✗')
        )) fails++;
      }

      const total = passes + fails;
      expect(total).toBeGreaterThan(0);
      // Animal Savagery fails on natural 1 only = ~16.7%
      const failRate = fails / total;
      expect(failRate).toBeGreaterThan(0.08);
      expect(failRate).toBeLessThan(0.30);
    });
  });
});
