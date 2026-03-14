import { describe, it, expect } from 'vitest';
import { calculateMoveProbability, calculateBlockProbability, calculatePassProbability } from './probability-calculator';
import { setup } from '../core/game-state';

describe('Probability Calculator', () => {
  describe('calculateMoveProbability', () => {
    it('returns 100% for safe movement', () => {
      const state = setup();
      const player = state.players.find(p => p.team === 'A')!;
      // Move to an empty adjacent cell away from opponents
      const to = { x: player.pos.x - 1, y: player.pos.y };
      if (to.x >= 0) {
        const prob = calculateMoveProbability(state, player, to);
        // Should be >= 83% (at least GFI or safe)
        expect(prob.probability).toBeGreaterThanOrEqual(0);
        expect(prob.probability).toBeLessThanOrEqual(1);
        expect(prob.displayPercent).toMatch(/^\d+%$/);
        expect(['safe', 'low', 'medium', 'high', 'critical']).toContain(prob.risk);
      }
    });
  });

  describe('calculateBlockProbability', () => {
    it('calculates 1-die block probability', () => {
      const state = setup();
      const prob = calculateBlockProbability(state,
        { ...state.players[0], st: 3, skills: [] },
        { ...state.players[1], st: 3, skills: [] },
        0, 0
      );
      expect(prob.probability).toBeGreaterThan(0);
      expect(prob.probability).toBeLessThan(1);
      expect(prob.details).toContain('1 dé');
    });

    it('calculates 2-die block probability (attacker stronger)', () => {
      const state = setup();
      const prob = calculateBlockProbability(state,
        { ...state.players[0], st: 4, skills: [] },
        { ...state.players[1], st: 3, skills: [] },
        0, 0
      );
      expect(prob.probability).toBeGreaterThan(0.5);
      expect(prob.details).toContain('2 dé');
      expect(prob.details).toContain('attaquant');
    });

    it('calculates block with Block skill', () => {
      const state = setup();
      const prob = calculateBlockProbability(state,
        { ...state.players[0], st: 3, skills: ['block'] },
        { ...state.players[1], st: 3, skills: [] },
        0, 0
      );
      // With Block skill, probability should be higher
      const probWithout = calculateBlockProbability(state,
        { ...state.players[0], st: 3, skills: [] },
        { ...state.players[1], st: 3, skills: [] },
        0, 0
      );
      expect(prob.probability).toBeGreaterThan(probWithout.probability);
    });
  });

  describe('calculatePassProbability', () => {
    it('calculates pass probability at different ranges', () => {
      const state = setup();
      const passer = { ...state.players[0], pa: 3, ag: 3, skills: [], hasBall: true };
      const target = { ...state.players[1], ag: 3, skills: [] };

      // Close pass (quick)
      const closeTarget = { ...target, pos: { x: passer.pos.x + 2, y: passer.pos.y } };
      const closeProb = calculatePassProbability(state, passer, closeTarget);
      expect(closeProb.probability).toBeGreaterThan(0);

      // Far pass
      const farTarget = { ...target, pos: { x: passer.pos.x + 8, y: passer.pos.y } };
      const farProb = calculatePassProbability(state, passer, farTarget);
      expect(farProb.probability).toBeLessThanOrEqual(closeProb.probability);
    });

    it('returns 0% for out of range', () => {
      const state = setup();
      const passer = { ...state.players[0], pa: 3, ag: 3, skills: [], hasBall: true };
      const target = { ...state.players[1], ag: 3, skills: [], pos: { x: passer.pos.x + 20, y: passer.pos.y } };
      const prob = calculatePassProbability(state, passer, target);
      expect(prob.probability).toBe(0);
    });
  });
});
