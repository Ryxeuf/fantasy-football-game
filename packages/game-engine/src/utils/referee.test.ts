import { describe, it, expect } from 'vitest';
import { validateMove, validateGameState } from './referee';
import { setup } from '../core/game-state';
import { getLegalMoves } from '../actions/actions';
import type { Move } from '../core/types';

describe('Referee Validation', () => {
  describe('validateMove', () => {
    it('validates END_TURN as always legal', () => {
      const state = setup();
      const result = validateMove(state, { type: 'END_TURN' });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('validates a legal move', () => {
      const state = setup();
      const legalMoves = getLegalMoves(state);
      const moveToValidate = legalMoves.find(m => m.type === 'MOVE');
      if (moveToValidate) {
        const result = validateMove(state, moveToValidate);
        expect(result.valid).toBe(true);
      }
    });

    it('rejects an illegal move', () => {
      const state = setup();
      const illegalMove: Move = {
        type: 'MOVE',
        playerId: 'nonexistent',
        to: { x: 0, y: 0 },
      };
      const result = validateMove(state, illegalMove);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects moves when game is ended', () => {
      const state = { ...setup(), gamePhase: 'ended' as const };
      const result = validateMove(state, { type: 'MOVE', playerId: 'p1', to: { x: 5, y: 5 } });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'GAME_ENDED')).toBe(true);
    });

    it('rejects REROLL_CHOOSE without pending reroll', () => {
      const state = setup();
      const result = validateMove(state, { type: 'REROLL_CHOOSE', useReroll: true });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'NO_PENDING_REROLL')).toBe(true);
    });
  });

  describe('validateGameState', () => {
    it('validates a fresh game state', () => {
      const state = setup();
      const result = validateGameState(state);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('detects negative PM', () => {
      const state = setup();
      state.players[0].pm = -1;
      const result = validateGameState(state);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'NEGATIVE_PM')).toBe(true);
    });

    it('detects negative scores', () => {
      const state = setup();
      state.score.teamA = -1;
      const result = validateGameState(state);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'NEGATIVE_SCORE')).toBe(true);
    });

    it('detects multiple ball carriers', () => {
      const state = setup();
      state.players[0].hasBall = true;
      state.players[1].hasBall = true;
      const result = validateGameState(state);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MULTIPLE_BALL_CARRIERS')).toBe(true);
    });
  });
});
