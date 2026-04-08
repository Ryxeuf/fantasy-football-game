import { describe, it, expect } from 'vitest';
import { setup, advanceHalfIfNeeded } from './game-state';
import { makeRNG } from '../utils/rng';
import { calculateMatchWinnings } from '../utils/team-value-calculator';
import type { GameState, TeamId } from './types';

/**
 * Helper: creates a state at end of half 2 (turn > 8) ready for match end.
 */
function createEndOfMatchState(overrides?: Partial<GameState>): GameState {
  const base = setup();
  return {
    ...base,
    gamePhase: 'playing' as const,
    half: 2,
    turn: 9, // Just past turn 8 → triggers match end
    currentPlayer: 'A' as TeamId,
    kickingTeam: 'B' as TeamId,
    score: { teamA: 2, teamB: 1 },
    fanAttendance: 8, // Sum of both teams' fan factors
    dedicatedFans: { teamA: 3, teamB: 2 },
    matchStats: {
      A1: { touchdowns: 2, casualties: 0, completions: 1, interceptions: 0, mvp: false },
      B3: { touchdowns: 1, casualties: 1, completions: 0, interceptions: 0, mvp: false },
    },
    ...overrides,
  };
}

describe('Règle: Fin de match complète (B1.8)', () => {
  describe('Winnings calculation', () => {
    it('devrait calculer les gains = (fanAttendance / 2 + touchdowns) × 10,000', () => {
      // Fan attendance = 8, touchdowns = 2
      // Winnings = (8/2 + 2) * 10000 = 60000
      const winnings = calculateMatchWinnings(8, 2);
      expect(winnings).toBe(60000);
    });

    it('devrait retourner 0 si le match est concédé', () => {
      const winnings = calculateMatchWinnings(8, 2, true);
      expect(winnings).toBe(0);
    });

    it('devrait arrondir la fan attendance / 2 vers le bas', () => {
      // Fan attendance = 7, touchdowns = 1
      // Winnings = (3 + 1) * 10000 = 40000
      const winnings = calculateMatchWinnings(7, 1);
      expect(winnings).toBe(40000);
    });

    it('devrait gérer 0 touchdowns', () => {
      // Fan attendance = 6, touchdowns = 0
      // Winnings = (3 + 0) * 10000 = 30000
      const winnings = calculateMatchWinnings(6, 0);
      expect(winnings).toBe(30000);
    });
  });

  describe('matchResult — winnings included at match end', () => {
    it('devrait inclure les winnings dans matchResult', () => {
      const state = createEndOfMatchState();
      const rng = makeRNG('end-winnings');
      const result = advanceHalfIfNeeded(state, rng);

      expect(result.gamePhase).toBe('ended');
      expect(result.matchResult).toBeDefined();
      expect(result.matchResult!.winnings).toBeDefined();
      expect(result.matchResult!.winnings!.teamA).toBeGreaterThanOrEqual(0);
      expect(result.matchResult!.winnings!.teamB).toBeGreaterThanOrEqual(0);
    });

    it('devrait calculer les winnings correctement pour chaque équipe', () => {
      const state = createEndOfMatchState({
        score: { teamA: 2, teamB: 1 },
        fanAttendance: 8,
      });
      const rng = makeRNG('end-winnings-calc');
      const result = advanceHalfIfNeeded(state, rng);

      // Team A scored 2 TDs: (8/2 + 2) * 10000 = 60000
      expect(result.matchResult!.winnings!.teamA).toBe(60000);
      // Team B scored 1 TD: (8/2 + 1) * 10000 = 50000
      expect(result.matchResult!.winnings!.teamB).toBe(50000);
    });

    it('devrait calculer des winnings avec 0 touchdowns', () => {
      const state = createEndOfMatchState({
        score: { teamA: 0, teamB: 0 },
        fanAttendance: 6,
      });
      const rng = makeRNG('end-winnings-zero');
      const result = advanceHalfIfNeeded(state, rng);

      // 0 TDs: (6/2 + 0) * 10000 = 30000
      expect(result.matchResult!.winnings!.teamA).toBe(30000);
      expect(result.matchResult!.winnings!.teamB).toBe(30000);
    });
  });

  describe('Dedicated Fans update', () => {
    it('devrait inclure dedicatedFansChange dans matchResult', () => {
      const state = createEndOfMatchState();
      const rng = makeRNG('end-fans');
      const result = advanceHalfIfNeeded(state, rng);

      expect(result.matchResult!.dedicatedFansChange).toBeDefined();
      expect(typeof result.matchResult!.dedicatedFansChange!.teamA).toBe('number');
      expect(typeof result.matchResult!.dedicatedFansChange!.teamB).toBe('number');
    });

    it('devrait augmenter les dedicated fans du gagnant si D6 >= dedicatedFans', () => {
      // Use a seed that produces a high D6 roll for the winner check
      // Winner = team A (score 2-1), dedicated fans A = 3
      // If D6 >= 3, fan factor +1
      const state = createEndOfMatchState({
        score: { teamA: 2, teamB: 1 },
        dedicatedFans: { teamA: 1, teamB: 6 }, // Low DF for A → almost any roll works
      });
      // We need a deterministic seed — test the range of possible values
      const rng = makeRNG('end-fans-winner-up');
      const result = advanceHalfIfNeeded(state, rng);

      // With dedicatedFans = 1, any D6 (1-6) >= 1, so always +1
      expect(result.matchResult!.dedicatedFansChange!.teamA).toBe(1);
    });

    it('devrait diminuer les dedicated fans du perdant si D6 < dedicatedFans', () => {
      // Loser = team B (score 2-1), dedicated fans B = 6
      // If D6 < 6, fan factor -1 → very likely
      const state = createEndOfMatchState({
        score: { teamA: 2, teamB: 1 },
        dedicatedFans: { teamA: 1, teamB: 6 },
      });
      const rng = makeRNG('end-fans-loser-down');
      const result = advanceHalfIfNeeded(state, rng);

      // With dedicatedFans = 6, D6 must be < 6 (i.e. 1-5) for -1
      // Very likely but RNG dependent — check it's either 0 or -1
      expect([-1, 0]).toContain(result.matchResult!.dedicatedFansChange!.teamB);
    });

    it('devrait ne pas changer les dedicated fans en cas de match nul', () => {
      const state = createEndOfMatchState({
        score: { teamA: 1, teamB: 1 },
      });
      const rng = makeRNG('end-fans-draw');
      const result = advanceHalfIfNeeded(state, rng);

      expect(result.matchResult!.dedicatedFansChange!.teamA).toBe(0);
      expect(result.matchResult!.dedicatedFansChange!.teamB).toBe(0);
    });

    it('devrait ne jamais descendre en dessous de 1 dedicated fan', () => {
      const state = createEndOfMatchState({
        score: { teamA: 2, teamB: 1 },
        dedicatedFans: { teamA: 1, teamB: 1 },
      });
      const rng = makeRNG('end-fans-min');
      const result = advanceHalfIfNeeded(state, rng);

      // Even if loser gets -1, dedicated fans can't go below 1
      // With DF=1, D6 < 1 is impossible, so change = 0
      expect(result.matchResult!.dedicatedFansChange!.teamB).toBe(0);
    });
  });

  describe('fanAttendance preservation', () => {
    it('devrait conserver le fanAttendance dans le state pendant le match', () => {
      const state = createEndOfMatchState({ fanAttendance: 10 });
      expect(state.fanAttendance).toBe(10);
    });

    it('devrait utiliser le fanAttendance pour le calcul des winnings', () => {
      const state = createEndOfMatchState({
        fanAttendance: 12,
        score: { teamA: 3, teamB: 0 },
      });
      const rng = makeRNG('end-attendance');
      const result = advanceHalfIfNeeded(state, rng);

      // Team A: (12/2 + 3) * 10000 = 90000
      expect(result.matchResult!.winnings!.teamA).toBe(90000);
      // Team B: (12/2 + 0) * 10000 = 60000
      expect(result.matchResult!.winnings!.teamB).toBe(60000);
    });
  });

  describe('Match end — complete matchResult structure', () => {
    it('devrait avoir tous les champs dans matchResult', () => {
      const state = createEndOfMatchState();
      const rng = makeRNG('end-complete');
      const result = advanceHalfIfNeeded(state, rng);

      expect(result.gamePhase).toBe('ended');
      expect(result.matchResult).toBeDefined();
      expect(result.matchResult!.winner).toBe('A'); // score 2-1
      expect(result.matchResult!.spp).toBeDefined();
      expect(result.matchResult!.winnings).toBeDefined();
      expect(result.matchResult!.dedicatedFansChange).toBeDefined();
    });

    it('devrait détecter un match nul', () => {
      const state = createEndOfMatchState({
        score: { teamA: 1, teamB: 1 },
      });
      const rng = makeRNG('end-draw');
      const result = advanceHalfIfNeeded(state, rng);

      expect(result.matchResult!.winner).toBeUndefined();
    });
  });
});
