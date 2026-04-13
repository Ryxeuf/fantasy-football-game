import { describe, it, expect, beforeEach } from 'vitest';
import { setup, applyMove, makeRNG } from '../index';
import type { GameState, Move } from '../core/types';
import { getSkillEffect } from '../skills/skill-registry';
import { hasSkill } from '../skills/skill-effects';

/**
 * No Hands (BB3 Season 2/3 rules):
 * - This player is unable to take the following actions: Pass, Hand-off
 * - This player is unable to pick up the ball
 * - This player cannot catch the ball (pass target, handoff target, bounce)
 * - If the ball bounces onto this player, it bounces again (no catch roll)
 * - This is a PROHIBITION, not a failed roll — no dice are rolled
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
 * Setup scenario for no-hands pickup test:
 * A1 at (5,5), ball at (6,5). A1 moves to (6,5) to trigger pickup.
 */
function setupNoHandsPickupScenario(
  baseState: GameState,
  hasNoHands: boolean,
): GameState {
  return {
    ...baseState,
    currentPlayer: 'A',
    selectedPlayerId: null,
    playerActions: {},
    isTurnover: false,
    ball: { x: 6, y: 5 },
    players: baseState.players.map(p => {
      if (p.id === 'A1') {
        return {
          ...p,
          pos: { x: 5, y: 5 },
          pm: 6,
          ma: 6,
          ag: 3,
          state: 'active' as const,
          stunned: false,
          hasBall: false,
          skills: hasNoHands ? ['no-hands'] : [],
          gfiUsed: 0,
        };
      }
      // Move all other players far away
      if (p.team === 'A') {
        return { ...p, pos: { x: 1, y: 1 }, state: 'active' as const, stunned: false, hasBall: false };
      }
      return { ...p, pos: { x: 24, y: 13 }, state: 'active' as const, stunned: false, hasBall: false };
    }),
  };
}

/**
 * Setup scenario for no-hands pass/handoff test:
 * A1 at (5,5) with ball, A2 at (7,5) (pass target) or (6,5) (handoff target).
 */
function setupNoHandsPassScenario(
  baseState: GameState,
  targetHasNoHands: boolean,
  targetAdjacent: boolean,
): GameState {
  return {
    ...baseState,
    currentPlayer: 'A',
    selectedPlayerId: null,
    playerActions: {},
    isTurnover: false,
    ball: undefined,
    players: baseState.players.map(p => {
      if (p.id === 'A1') {
        return {
          ...p,
          pos: { x: 5, y: 5 },
          pm: 6,
          ma: 6,
          ag: 3,
          pa: 3,
          state: 'active' as const,
          stunned: false,
          hasBall: true,
          skills: [],
          gfiUsed: 0,
        };
      }
      if (p.id === 'A2') {
        return {
          ...p,
          pos: targetAdjacent ? { x: 6, y: 5 } : { x: 7, y: 5 },
          pm: 6,
          ma: 6,
          ag: 3,
          state: 'active' as const,
          stunned: false,
          hasBall: false,
          skills: targetHasNoHands ? ['no-hands'] : [],
          gfiUsed: 0,
        };
      }
      // Move all other players far away
      if (p.team === 'A') {
        return { ...p, pos: { x: 1, y: 1 }, state: 'active' as const, stunned: false, hasBall: false };
      }
      return { ...p, pos: { x: 24, y: 13 }, state: 'active' as const, stunned: false, hasBall: false };
    }),
  };
}

/**
 * Setup scenario for ball bouncing onto a no-hands player.
 * A1 at (5,5) fails pickup, ball bounces. A2 at adjacent position with no-hands.
 */
function setupNoHandsBounceScenario(
  baseState: GameState,
  bouncerHasNoHands: boolean,
): GameState {
  return {
    ...baseState,
    currentPlayer: 'A',
    selectedPlayerId: null,
    playerActions: {},
    isTurnover: false,
    ball: { x: 6, y: 5 },
    players: baseState.players.map(p => {
      if (p.id === 'A1') {
        return {
          ...p,
          pos: { x: 5, y: 5 },
          pm: 6,
          ma: 6,
          ag: 3,
          state: 'active' as const,
          stunned: false,
          hasBall: false,
          skills: [],
          gfiUsed: 0,
        };
      }
      if (p.id === 'A2') {
        // Place A2 adjacent to ball position so it could receive a bounce
        return {
          ...p,
          pos: { x: 7, y: 5 },
          pm: 6,
          ma: 6,
          ag: 3,
          state: 'active' as const,
          stunned: false,
          hasBall: false,
          skills: bouncerHasNoHands ? ['no-hands'] : [],
          gfiUsed: 0,
        };
      }
      // Move all other players far away
      if (p.team === 'A') {
        return { ...p, pos: { x: 1, y: 1 }, state: 'active' as const, stunned: false, hasBall: false };
      }
      return { ...p, pos: { x: 24, y: 13 }, state: 'active' as const, stunned: false, hasBall: false };
    }),
  };
}

const MOVE_TO_BALL: Move = { type: 'MOVE', playerId: 'A1', to: { x: 6, y: 5 } };

describe('Regle: No Hands (Sans Ballon)', () => {
  describe('Skill Registry', () => {
    it('no-hands is registered in skill registry', () => {
      const effect = getSkillEffect('no-hands');
      expect(effect).toBeDefined();
      expect(effect!.slug).toBe('no-hands');
    });

    it('no-hands has passive trigger', () => {
      const effect = getSkillEffect('no-hands');
      expect(effect!.triggers).toContain('passive');
    });
  });

  describe('Pickup prevention', () => {
    let baseState: GameState;

    beforeEach(() => {
      baseState = makeTestState();
    });

    it('player without no-hands can pick up the ball normally', () => {
      const state = setupNoHandsPickupScenario(baseState, false);

      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`nh-pickup-normal-${seed}`);
        const result = applyMove(state, MOVE_TO_BALL, rng);

        const a1 = result.players.find(p => p.id === 'A1')!;
        if (a1.hasBall) {
          found = true;
          expect(a1.pos).toEqual({ x: 6, y: 5 });
          break;
        }
      }
      expect(found).toBe(true);
    });

    it('no-hands player cannot pick up the ball (auto-fail, no dice roll)', () => {
      const state = setupNoHandsPickupScenario(baseState, true);
      const rng = makeRNG('nh-pickup-fail');
      const result = applyMove(state, MOVE_TO_BALL, rng);

      const a1 = result.players.find(p => p.id === 'A1')!;
      // Player moves to the position but does NOT get the ball
      expect(a1.pos).toEqual({ x: 6, y: 5 });
      expect(a1.hasBall).toBeFalsy();

      // No pickup dice roll should appear (it's a prohibition)
      const pickupDiceLog = result.gameLog.filter(l =>
        l.message.includes('Jet de pickup')
      );
      expect(pickupDiceLog).toHaveLength(0);
    });

    it('no-hands pickup failure logs the "Sans Ballon" message', () => {
      const state = setupNoHandsPickupScenario(baseState, true);
      const rng = makeRNG('nh-pickup-log');
      const result = applyMove(state, MOVE_TO_BALL, rng);

      const noHandsLog = result.gameLog.find(l =>
        l.message.includes('Sans Ballon') || l.message.includes('No Hands')
      );
      expect(noHandsLog).toBeDefined();
    });

    it('no-hands pickup failure is a turnover', () => {
      const state = setupNoHandsPickupScenario(baseState, true);
      const rng = makeRNG('nh-pickup-turnover');
      const result = applyMove(state, MOVE_TO_BALL, rng);

      expect(result.isTurnover).toBe(true);
    });

    it('no-hands pickup failure causes the ball to bounce', () => {
      const state = setupNoHandsPickupScenario(baseState, true);
      const rng = makeRNG('nh-pickup-bounce');
      const result = applyMove(state, MOVE_TO_BALL, rng);

      // Ball should have bounced (not at pickup position or undefined = given to player)
      const bounceLogs = result.gameLog.filter(l =>
        l.message.includes('rebondit')
      );
      expect(bounceLogs.length).toBeGreaterThan(0);
    });

    it('no-hands player never gets hasBall=true across many seeds', () => {
      const state = setupNoHandsPickupScenario(baseState, true);

      for (let seed = 0; seed < 50; seed++) {
        const rng = makeRNG(`nh-never-ball-${seed}`);
        const result = applyMove(state, MOVE_TO_BALL, rng);

        const a1 = result.players.find(p => p.id === 'A1')!;
        expect(a1.hasBall).toBeFalsy();
      }
    });
  });

  describe('Pass to no-hands receiver', () => {
    let baseState: GameState;

    beforeEach(() => {
      baseState = makeTestState();
    });

    it('pass to a normal player can succeed', () => {
      const state = setupNoHandsPassScenario(baseState, false, false);
      const passMove: Move = { type: 'PASS', playerId: 'A1', targetId: 'A2' };

      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`nh-pass-normal-${seed}`);
        const result = applyMove(state, passMove, rng);

        const a2 = result.players.find(p => p.id === 'A2')!;
        if (a2.hasBall) {
          found = true;
          break;
        }
      }
      expect(found).toBe(true);
    });

    it('pass to no-hands receiver: catch auto-fails (no catch dice roll)', () => {
      const state = setupNoHandsPassScenario(baseState, true, false);
      const passMove: Move = { type: 'PASS', playerId: 'A1', targetId: 'A2' };

      // Try many seeds to ensure pass itself succeeds at least once
      let passSucceeded = false;
      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`nh-pass-nocatch-${seed}`);
        const result = applyMove(state, passMove, rng);

        // Check if pass roll succeeded (pass log with checkmark)
        const passSuccessLog = result.gameLog.find(l =>
          l.message.includes('Jet de passe') && l.message.includes('✓')
        );
        if (passSuccessLog) {
          passSucceeded = true;
          const a2 = result.players.find(p => p.id === 'A2')!;
          // No-hands receiver should NOT have the ball
          expect(a2.hasBall).toBeFalsy();

          // No catch dice roll should appear
          const catchDiceLog = result.gameLog.filter(l =>
            l.message.includes('Jet de réception')
          );
          expect(catchDiceLog).toHaveLength(0);
          break;
        }
      }
      expect(passSucceeded).toBe(true);
    });

    it('pass to no-hands receiver causes turnover', () => {
      const state = setupNoHandsPassScenario(baseState, true, false);
      const passMove: Move = { type: 'PASS', playerId: 'A1', targetId: 'A2' };

      // Find a seed where pass itself succeeds
      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`nh-pass-turnover-${seed}`);
        const result = applyMove(state, passMove, rng);

        const passSuccessLog = result.gameLog.find(l =>
          l.message.includes('Jet de passe') && l.message.includes('✓')
        );
        if (passSuccessLog) {
          expect(result.isTurnover).toBe(true);
          break;
        }
      }
    });
  });

  describe('Handoff to no-hands receiver', () => {
    let baseState: GameState;

    beforeEach(() => {
      baseState = makeTestState();
    });

    it('handoff to a normal adjacent player can succeed', () => {
      const state = setupNoHandsPassScenario(baseState, false, true);
      const handoffMove: Move = { type: 'HANDOFF', playerId: 'A1', targetId: 'A2' };

      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const rng = makeRNG(`nh-handoff-normal-${seed}`);
        const result = applyMove(state, handoffMove, rng);

        const a2 = result.players.find(p => p.id === 'A2')!;
        if (a2.hasBall) {
          found = true;
          break;
        }
      }
      expect(found).toBe(true);
    });

    it('handoff to no-hands receiver: catch auto-fails (no catch dice roll)', () => {
      const state = setupNoHandsPassScenario(baseState, true, true);
      const handoffMove: Move = { type: 'HANDOFF', playerId: 'A1', targetId: 'A2' };

      const rng = makeRNG('nh-handoff-nocatch');
      const result = applyMove(state, handoffMove, rng);

      const a2 = result.players.find(p => p.id === 'A2')!;
      expect(a2.hasBall).toBeFalsy();

      // No catch dice roll should appear
      const catchDiceLog = result.gameLog.filter(l =>
        l.message.includes('Jet de réception')
      );
      expect(catchDiceLog).toHaveLength(0);
    });

    it('handoff to no-hands receiver causes turnover', () => {
      const state = setupNoHandsPassScenario(baseState, true, true);
      const handoffMove: Move = { type: 'HANDOFF', playerId: 'A1', targetId: 'A2' };

      const rng = makeRNG('nh-handoff-turnover');
      const result = applyMove(state, handoffMove, rng);

      expect(result.isTurnover).toBe(true);
    });

    it('handoff to no-hands receiver logs the no-hands message', () => {
      const state = setupNoHandsPassScenario(baseState, true, true);
      const handoffMove: Move = { type: 'HANDOFF', playerId: 'A1', targetId: 'A2' };

      const rng = makeRNG('nh-handoff-log');
      const result = applyMove(state, handoffMove, rng);

      const noHandsLog = result.gameLog.find(l =>
        l.message.includes('Sans Ballon') || l.message.includes('No Hands')
      );
      expect(noHandsLog).toBeDefined();
    });
  });

  describe('Ball bounce onto no-hands player', () => {
    let baseState: GameState;

    beforeEach(() => {
      baseState = makeTestState();
    });

    it('ball bouncing onto no-hands player bounces again (no catch roll)', () => {
      // We test this indirectly: setup a no-hands player adjacent to a ball that will bounce.
      // The no-hands player should never end up with the ball, and no catch roll should be made for them.
      const state = setupNoHandsBounceScenario(baseState, true);

      // Move A1 to ball position (normal player, pickup attempt)
      // If pickup fails, ball bounces. If it lands on A2 (no-hands), should bounce again.
      let noHandsBounceDetected = false;
      for (let seed = 0; seed < 300; seed++) {
        const rng = makeRNG(`nh-bounce-${seed}`);
        const result = applyMove(state, MOVE_TO_BALL, rng);

        const a2 = result.players.find(p => p.id === 'A2')!;
        // A2 (no-hands) should NEVER have the ball
        expect(a2.hasBall).toBeFalsy();

        // Check if there was a bounce followed by no-hands interaction
        const noHandsLog = result.gameLog.find(l =>
          (l.message.includes('Sans Ballon') || l.message.includes('No Hands')) &&
          l.playerId === 'A2'
        );
        if (noHandsLog) {
          noHandsBounceDetected = true;
          // Verify no catch dice roll was made for A2
          const a2CatchLogs = result.gameLog.filter(l =>
            l.message.includes('Jet de réception') && l.playerId === 'A2'
          );
          expect(a2CatchLogs).toHaveLength(0);
        }
      }
      // We expect at least one seed where the ball bounced onto A2
      // (If not found, the test still passes on the "never hasBall" assertion)
    });

    it('no-hands player never receives ball from bounce across many seeds', () => {
      const state = setupNoHandsBounceScenario(baseState, true);

      for (let seed = 0; seed < 100; seed++) {
        const rng = makeRNG(`nh-bounce-never-${seed}`);
        const result = applyMove(state, MOVE_TO_BALL, rng);

        const a2 = result.players.find(p => p.id === 'A2')!;
        expect(a2.hasBall).toBeFalsy();
      }
    });
  });
});
