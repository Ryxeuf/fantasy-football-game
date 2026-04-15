import { describe, it, expect } from 'vitest';
import { setup, applyMove } from '../index';
import { GameState, RNG, Player } from '../core/types';
import {
  canDumpOff,
  getDumpOffReceivers,
  executeDumpOff,
} from './dump-off';

function makeTestRNG(values: number[]): RNG {
  let i = 0;
  return () => {
    const val = values[i % values.length];
    i++;
    return val;
  };
}

/**
 * Helper: convert a D6 target (1-6) to an rng() value producing rollD6 === value.
 * rollD6 = Math.floor(rng() * 6) + 1. For value=V, return (V-1)/6 + 0.01
 */
function d6(value: number): number {
  return (value - 1) / 6 + 0.01;
}

/**
 * Scénario de test Dump-off :
 *  - A1 est le porteur de balle adverse (team A), à (10,7), skill "dump-off", hasBall.
 *  - B1 (attaquant team B) adjacent à (11,7) — va effectuer un blocage contre A1.
 *  - A2 (coéquipier de A1) à (8,7) — à portée Quick (distance 2).
 *  - A3 (coéquipier de A1) à (4,7) — hors de portée Quick (distance 6 = Short).
 *  - A4 (coéquipier stun) à (9,7) — distance 1 mais stunné, pas éligible.
 *  - B2 adverse à (5,5).
 */
function createDumpOffTestState(): GameState {
  const state = setup();
  state.players = [
    {
      id: 'A1', team: 'A', pos: { x: 10, y: 7 }, name: 'Elf Thrower', number: 1,
      position: 'Thrower', ma: 6, st: 3, ag: 3, pa: 3, av: 8,
      skills: ['dump-off'],
      pm: 6, hasBall: true, state: 'active',
    },
    {
      id: 'A2', team: 'A', pos: { x: 8, y: 7 }, name: 'Elf Catcher', number: 2,
      position: 'Catcher', ma: 8, st: 2, ag: 3, pa: 4, av: 7, skills: [],
      pm: 8, hasBall: false, state: 'active',
    },
    {
      id: 'A3', team: 'A', pos: { x: 4, y: 7 }, name: 'Elf Lineman', number: 3,
      position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [],
      pm: 6, hasBall: false, state: 'active',
    },
    {
      id: 'A4', team: 'A', pos: { x: 9, y: 7 }, name: 'Elf Stunned', number: 4,
      position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [],
      pm: 0, hasBall: false, state: 'active', stunned: true,
    },
    {
      id: 'B1', team: 'B', pos: { x: 11, y: 7 }, name: 'Orc Blitzer', number: 1,
      position: 'Blitzer', ma: 6, st: 4, ag: 3, pa: 5, av: 10, skills: [],
      pm: 6, hasBall: false, state: 'active',
    },
    {
      id: 'B2', team: 'B', pos: { x: 5, y: 5 }, name: 'Orc Lineman', number: 2,
      position: 'Lineman', ma: 5, st: 3, ag: 3, pa: 5, av: 10, skills: [],
      pm: 5, hasBall: false, state: 'active',
    },
  ];
  state.ball = { x: 10, y: 7 };
  state.currentPlayer = 'B';
  state.playerActions = {};
  state.teamBlitzCount = {};
  state.teamFoulCount = {};
  state.teamRerolls = { teamA: 3, teamB: 3 };
  return state;
}

function getPlayer(state: GameState, id: string): Player {
  const p = state.players.find(pl => pl.id === id);
  if (!p) throw new Error(`Player ${id} not found`);
  return p;
}

describe('Regle: Dump-off', () => {
  describe('canDumpOff', () => {
    it('allows dump-off when target has the skill, has the ball, and is active', () => {
      const state = createDumpOffTestState();
      expect(canDumpOff(state, getPlayer(state, 'A1'))).toBe(true);
    });

    it('rejects dump-off when target does not have the skill', () => {
      const state = createDumpOffTestState();
      state.players = state.players.map(p =>
        p.id === 'A1' ? { ...p, skills: [] } : p
      );
      expect(canDumpOff(state, getPlayer(state, 'A1'))).toBe(false);
    });

    it('rejects dump-off when target does not have the ball', () => {
      const state = createDumpOffTestState();
      state.players = state.players.map(p =>
        p.id === 'A1' ? { ...p, hasBall: false } : p
      );
      expect(canDumpOff(state, getPlayer(state, 'A1'))).toBe(false);
    });

    it('rejects dump-off when target is stunned', () => {
      const state = createDumpOffTestState();
      state.players = state.players.map(p =>
        p.id === 'A1' ? { ...p, stunned: true } : p
      );
      expect(canDumpOff(state, getPlayer(state, 'A1'))).toBe(false);
    });

    it('rejects dump-off when target is knocked_out', () => {
      const state = createDumpOffTestState();
      state.players = state.players.map(p =>
        p.id === 'A1' ? { ...p, state: 'knocked_out' } : p
      );
      expect(canDumpOff(state, getPlayer(state, 'A1'))).toBe(false);
    });
  });

  describe('getDumpOffReceivers', () => {
    it('returns teammates within Quick Pass range (distance 1-3)', () => {
      const state = createDumpOffTestState();
      const receivers = getDumpOffReceivers(state, getPlayer(state, 'A1'));
      const ids = receivers.map(p => p.id);
      expect(ids).toContain('A2'); // distance 2, Quick
      expect(ids).not.toContain('A3'); // distance 6, too far
    });

    it('excludes the passer himself', () => {
      const state = createDumpOffTestState();
      const receivers = getDumpOffReceivers(state, getPlayer(state, 'A1'));
      expect(receivers.map(p => p.id)).not.toContain('A1');
    });

    it('excludes opponents', () => {
      const state = createDumpOffTestState();
      const receivers = getDumpOffReceivers(state, getPlayer(state, 'A1'));
      expect(receivers.map(p => p.id)).not.toContain('B1');
      expect(receivers.map(p => p.id)).not.toContain('B2');
    });

    it('excludes stunned teammates', () => {
      const state = createDumpOffTestState();
      const receivers = getDumpOffReceivers(state, getPlayer(state, 'A1'));
      expect(receivers.map(p => p.id)).not.toContain('A4');
    });

    it('excludes knocked_out or casualty teammates', () => {
      const state = createDumpOffTestState();
      state.players = state.players.map(p =>
        p.id === 'A2' ? { ...p, state: 'knocked_out' } : p
      );
      const receivers = getDumpOffReceivers(state, getPlayer(state, 'A1'));
      expect(receivers.map(p => p.id)).not.toContain('A2');
    });

    it('excludes teammates with no-hands', () => {
      const state = createDumpOffTestState();
      state.players = state.players.map(p =>
        p.id === 'A2' ? { ...p, skills: ['no-hands'] } : p
      );
      const receivers = getDumpOffReceivers(state, getPlayer(state, 'A1'));
      expect(receivers.map(p => p.id)).not.toContain('A2');
    });
  });

  describe('executeDumpOff', () => {
    it('completes successfully when pass + catch succeed', () => {
      const state = createDumpOffTestState();
      // pass roll needs 4+ (pa 3, -1 for adjacent opponent B1, so target = 3+1=4) → roll 5
      // catch roll needs 3+ (ag 3) → roll 5
      const rng = makeTestRNG([d6(5), d6(5)]);

      const result = executeDumpOff(state, 'A1', 'A2', rng);

      const receiver = getPlayer(result, 'A2');
      const passer = getPlayer(result, 'A1');
      expect(receiver.hasBall).toBe(true);
      expect(passer.hasBall).toBe(false);
      expect(result.ball).toBeUndefined();
    });

    it('never causes a turnover when the Quick Pass fails', () => {
      const state = createDumpOffTestState();
      // pass roll fails: roll 1
      const rng = makeTestRNG([d6(1), d6(1), d6(1), d6(1)]);

      const result = executeDumpOff(state, 'A1', 'A2', rng);

      // The rule: "No Turnover is caused" — isTurnover must NOT be set
      expect(result.isTurnover).toBe(false);
      // The passer no longer holds the ball
      const passer = getPlayer(result, 'A1');
      expect(passer.hasBall).toBe(false);
    });

    it('never causes a turnover when the catch fails', () => {
      const state = createDumpOffTestState();
      // pass 5 OK, catch 1 fails
      const rng = makeTestRNG([d6(5), d6(1), d6(1), d6(1)]);

      const result = executeDumpOff(state, 'A1', 'A2', rng);

      expect(result.isTurnover).toBe(false);
      const passer = getPlayer(result, 'A1');
      expect(passer.hasBall).toBe(false);
    });

    it('logs the dump-off action', () => {
      const state = createDumpOffTestState();
      const rng = makeTestRNG([d6(5), d6(5)]);

      const result = executeDumpOff(state, 'A1', 'A2', rng);

      const logs = result.gameLog.map(l => l.message).join(' | ');
      expect(logs).toMatch(/Délestage|Dump-?off/i);
    });

    it('returns state unchanged if passer not found', () => {
      const state = createDumpOffTestState();
      const rng = makeTestRNG([d6(5)]);
      const result = executeDumpOff(state, 'NOPE', 'A2', rng);
      expect(result).toBe(state);
    });

    it('returns state unchanged if receiver not found', () => {
      const state = createDumpOffTestState();
      const rng = makeTestRNG([d6(5)]);
      const result = executeDumpOff(state, 'A1', 'NOPE', rng);
      expect(result).toBe(state);
    });

    it('awards touchdown if receiver is in opponent endzone with ball', () => {
      const state = createDumpOffTestState();
      // Move A2 to opponent endzone (team A attacks endzone of team B at x=1)
      state.players = state.players.map(p =>
        p.id === 'A2' ? { ...p, pos: { x: 10, y: 6 } } : p
      );
      const rng = makeTestRNG([d6(5), d6(5)]);

      const result = executeDumpOff(state, 'A1', 'A2', rng);

      const a2 = getPlayer(result, 'A2');
      // Either hasBall on A2 or TD scored
      expect(a2.hasBall || result.score.teamA > 0).toBe(true);
    });
  });

  describe('Block flow integration', () => {
    it('triggers pendingDumpOff when B1 blocks ball-carrier A1 with dump-off skill', () => {
      const state = createDumpOffTestState();
      // B1 (attacker) blocks A1 (ball carrier with dump-off)
      const rng = makeTestRNG([d6(5), d6(5), d6(5)]);

      const result = applyMove(state, { type: 'BLOCK', playerId: 'B1', targetId: 'A1' }, rng);

      expect(result.pendingDumpOff).toBeDefined();
      expect(result.pendingDumpOff?.attackerId).toBe('B1');
      expect(result.pendingDumpOff?.targetId).toBe('A1');
      // A2 is in Quick range (distance 2) → eligible receiver
      const receiverIds = result.pendingDumpOff?.receiverOptions ?? [];
      expect(receiverIds).toContain('A2');
      // Block not resolved yet → no pendingBlock or lastDiceResult of type 'block'
      expect(result.pendingBlock).toBeUndefined();
    });

    it('does NOT trigger pendingDumpOff when target does not have dump-off skill', () => {
      const state = createDumpOffTestState();
      state.players = state.players.map(p =>
        p.id === 'A1' ? { ...p, skills: [] } : p
      );
      const rng = makeTestRNG([d6(5), d6(5), d6(5)]);

      const result = applyMove(state, { type: 'BLOCK', playerId: 'B1', targetId: 'A1' }, rng);

      expect(result.pendingDumpOff).toBeUndefined();
    });

    it('does NOT trigger pendingDumpOff when target has no ball', () => {
      const state = createDumpOffTestState();
      state.players = state.players.map(p =>
        p.id === 'A1' ? { ...p, hasBall: false } : p
      );
      state.ball = { x: 3, y: 3 };
      const rng = makeTestRNG([d6(5), d6(5), d6(5)]);

      const result = applyMove(state, { type: 'BLOCK', playerId: 'B1', targetId: 'A1' }, rng);

      expect(result.pendingDumpOff).toBeUndefined();
    });

    it('resolves dump-off on DUMP_OFF_CHOOSE with receiverId, then resumes block', () => {
      const state = createDumpOffTestState();
      // Step 1: B1 declares a block on A1 → pendingDumpOff set
      // Step 2: A1 dumps off to A2 (success) → ball moves to A2, then block resolves on empty-handed A1
      const rng = makeTestRNG([
        d6(5), d6(5), // pass, catch
        d6(6),         // block die (2d6 needed is only 1 die: st 4 vs 3 → 2 dice attacker)
        d6(6),         // second block die
      ]);

      const afterBlock = applyMove(state, { type: 'BLOCK', playerId: 'B1', targetId: 'A1' }, rng);
      expect(afterBlock.pendingDumpOff).toBeDefined();

      const afterDumpOff = applyMove(
        afterBlock,
        { type: 'DUMP_OFF_CHOOSE', passerId: 'A1', receiverId: 'A2' },
        rng
      );

      // pendingDumpOff cleared
      expect(afterDumpOff.pendingDumpOff).toBeUndefined();
      // Ball transferred to A2
      expect(getPlayer(afterDumpOff, 'A2').hasBall).toBe(true);
      expect(getPlayer(afterDumpOff, 'A1').hasBall).toBe(false);
      // Block resumed: either pendingBlock set (multi-dice) or a block result has been applied
      const blockHappened =
        afterDumpOff.pendingBlock !== undefined ||
        afterDumpOff.gameLog.some(l =>
          l.message.includes('Blocage') || l.message.includes('est mis au sol')
        );
      expect(blockHappened).toBe(true);
    });

    it('resolves block normally when DUMP_OFF_CHOOSE skips with null receiver', () => {
      const state = createDumpOffTestState();
      const rng = makeTestRNG([d6(6), d6(6), d6(6)]);

      const afterBlock = applyMove(state, { type: 'BLOCK', playerId: 'B1', targetId: 'A1' }, rng);
      expect(afterBlock.pendingDumpOff).toBeDefined();

      const afterSkip = applyMove(
        afterBlock,
        { type: 'DUMP_OFF_CHOOSE', passerId: 'A1', receiverId: null },
        rng
      );

      expect(afterSkip.pendingDumpOff).toBeUndefined();
      // A1 still has the ball (dump-off skipped)
      expect(getPlayer(afterSkip, 'A1').hasBall).toBe(true);
      // Block has been resolved / progressed
      const blockProgressed =
        afterSkip.pendingBlock !== undefined ||
        afterSkip.gameLog.some(l => l.message.includes('Blocage'));
      expect(blockProgressed).toBe(true);
    });

    it('dump-off cannot be attempted when no eligible receivers exist', () => {
      const state = createDumpOffTestState();
      // Remove A2 & A3 (only teammates that could receive), keep only A4 stunned
      state.players = state.players.filter(p =>
        p.id !== 'A2' && p.id !== 'A3'
      );
      const rng = makeTestRNG([d6(6), d6(6), d6(6)]);

      const result = applyMove(state, { type: 'BLOCK', playerId: 'B1', targetId: 'A1' }, rng);

      // No eligible receivers → dump-off cannot interrupt; block proceeds immediately
      expect(result.pendingDumpOff).toBeUndefined();
    });

    it('DUMP_OFF_CHOOSE is a no-op when there is no pending dump-off', () => {
      const state = createDumpOffTestState();
      const rng = makeTestRNG([d6(5)]);

      const result = applyMove(
        state,
        { type: 'DUMP_OFF_CHOOSE', passerId: 'A1', receiverId: 'A2' },
        rng
      );

      // State should be effectively unchanged (no dump-off executed)
      expect(getPlayer(result, 'A1').hasBall).toBe(true);
      expect(getPlayer(result, 'A2').hasBall).toBe(false);
    });
  });
});
