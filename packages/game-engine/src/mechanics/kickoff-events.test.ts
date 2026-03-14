import { describe, it, expect } from 'vitest';
import { KICKOFF_EVENTS, rollKickoffEvent, applyKickoffEvent } from './kickoff-events';
import { setup } from '../core/game-state';
import { makeRNG } from '../utils/rng';

describe('Kickoff Events', () => {
  describe('KICKOFF_EVENTS table', () => {
    it('has events for all 2D6 results (2-12)', () => {
      for (let i = 2; i <= 12; i++) {
        expect(KICKOFF_EVENTS[i]).toBeDefined();
        expect(KICKOFF_EVENTS[i].id).toBeTruthy();
        expect(KICKOFF_EVENTS[i].name).toBeTruthy();
        expect(KICKOFF_EVENTS[i].nameFr).toBeTruthy();
        expect(KICKOFF_EVENTS[i].description).toBeTruthy();
      }
    });

    it('has 11 unique events', () => {
      const uniqueIds = new Set(Object.values(KICKOFF_EVENTS).map(e => e.id));
      expect(uniqueIds.size).toBe(11);
    });
  });

  describe('rollKickoffEvent', () => {
    it('returns a valid event and total', () => {
      const rng = makeRNG('test-kickoff');
      const { total, event } = rollKickoffEvent(rng);
      expect(total).toBeGreaterThanOrEqual(2);
      expect(total).toBeLessThanOrEqual(12);
      expect(event).toBeDefined();
      expect(event.id).toBeTruthy();
    });
  });

  describe('applyKickoffEvent', () => {
    it('applies Get the Ref (+1 reroll each team)', () => {
      const state = setup();
      const event = KICKOFF_EVENTS[2]; // Get the Ref
      const rng = makeRNG('test');
      const result = applyKickoffEvent(state, event, rng, 'A');
      expect(result.teamRerolls.teamA).toBe(state.teamRerolls.teamA + 1);
      expect(result.teamRerolls.teamB).toBe(state.teamRerolls.teamB + 1);
    });

    it('applies Riot (turn counter change)', () => {
      const state = setup();
      const event = KICKOFF_EVENTS[3]; // Riot
      const rng = makeRNG('test');
      const result = applyKickoffEvent(state, event, rng, 'A');
      expect(result.turn).toBeGreaterThanOrEqual(1);
      expect(result.turn).toBeLessThanOrEqual(8);
    });

    it('applies Pitch Invasion (stuns on 6)', () => {
      const state = setup();
      const event = KICKOFF_EVENTS[12]; // Pitch Invasion
      const rng = makeRNG('test-invasion');
      const result = applyKickoffEvent(state, event, rng, 'A');
      // Verify state is valid (some players may be stunned)
      expect(result.players).toBeDefined();
      expect(result.gameLog.length).toBeGreaterThan(state.gameLog.length);
    });
  });
});
