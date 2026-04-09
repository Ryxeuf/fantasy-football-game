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

    describe('Regle: Cheering Fans — dedicated fans added to D3 roll', () => {
      const cheeringFansEvent = KICKOFF_EVENTS[6];

      it('adds dedicatedFans to D3 roll for each team', () => {
        // Use a deterministic seed. We run multiple seeds to find one where
        // the D3 rolls alone would tie but dedicated fans break the tie.
        // With dedicated fans {teamA: 5, teamB: 1}, teamA should almost
        // always win since scoreA = d3 + 5 vs scoreB = d3 + 1.
        const state = {
          ...setup(),
          dedicatedFans: { teamA: 5, teamB: 1 },
        };
        // Try multiple seeds to find a consistent outcome
        let teamAWins = 0;
        for (let i = 0; i < 20; i++) {
          const rng = makeRNG(`cheering-fans-df-${i}`);
          const result = applyKickoffEvent(state, cheeringFansEvent, rng, 'A');
          if (result.teamRerolls.teamA > state.teamRerolls.teamA) {
            teamAWins++;
          }
        }
        // With +5 vs +1, teamA should win most of the time (d3 range is 1-3)
        // teamA min score = 1+5=6, teamB max score = 3+1=4, so teamA always wins
        expect(teamAWins).toBe(20);
      });

      it('works when dedicatedFans is undefined (defaults to 0)', () => {
        const state = setup(); // no dedicatedFans
        const rng = makeRNG('cheering-no-df');
        const result = applyKickoffEvent(state, cheeringFansEvent, rng, 'A');
        // Should not throw and should produce a valid state
        expect(result.gameLog.length).toBeGreaterThan(state.gameLog.length);
      });

      it('grants reroll to teamB when teamB has higher dedicated fans', () => {
        const state = {
          ...setup(),
          dedicatedFans: { teamA: 1, teamB: 5 },
        };
        // teamB min = 1+5=6, teamA max = 3+1=4 → teamB always wins
        let teamBWins = 0;
        for (let i = 0; i < 10; i++) {
          const rng = makeRNG(`cheering-b-wins-${i}`);
          const result = applyKickoffEvent(state, cheeringFansEvent, rng, 'A');
          if (result.teamRerolls.teamB > state.teamRerolls.teamB) {
            teamBWins++;
          }
        }
        expect(teamBWins).toBe(10);
      });

      it('results in tie when both teams have equal dedicated fans and same D3', () => {
        const state = {
          ...setup(),
          dedicatedFans: { teamA: 3, teamB: 3 },
        };
        // With equal dedicated fans, result depends on D3 rolls
        const rng = makeRNG('cheering-tie');
        const result = applyKickoffEvent(state, cheeringFansEvent, rng, 'A');
        // Just verify it runs without error and logs something
        expect(result.gameLog.length).toBeGreaterThan(state.gameLog.length);
      });

      it('includes dedicated fans in log message', () => {
        const state = {
          ...setup(),
          dedicatedFans: { teamA: 3, teamB: 1 },
        };
        const rng = makeRNG('cheering-log');
        const result = applyKickoffEvent(state, cheeringFansEvent, rng, 'A');
        const lastLogs = result.gameLog.slice(state.gameLog.length);
        const actionLog = lastLogs.find(l => l.type === 'action');
        expect(actionLog).toBeDefined();
        // Log should mention the dedicated fans contribution
        expect(actionLog!.message).toMatch(/D3.*\+.*fans/i);
      });
    });
  });
});
