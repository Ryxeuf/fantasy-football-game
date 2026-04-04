import { describe, it, expect } from 'vitest';
import { setup, advanceHalfIfNeeded } from './game-state';
import { applyMove } from '../actions/actions';
import { makeRNG } from '../utils/rng';
import type { GameState, TeamId } from './types';

/**
 * Helper: creates a state at end of half 1 (turn > 8) ready for halftime transition.
 */
function createHalftimeState(overrides?: Partial<GameState>): GameState {
  const base = setup();
  return {
    ...base,
    gamePhase: 'playing' as const,
    half: 1,
    turn: 9, // Just past turn 8 → triggers halftime
    currentPlayer: 'A' as TeamId,
    kickingTeam: 'A' as TeamId,
    score: { teamA: 0, teamB: 0 },
    ...overrides,
  };
}

describe('Règle: Mi-temps complète (B1.7)', () => {
  describe('advanceHalfIfNeeded — half 1 → half 2', () => {
    it('devrait passer à la 2e mi-temps quand turn > 8 et half === 1', () => {
      const state = createHalftimeState();
      const rng = makeRNG('halftime-basic');
      const result = advanceHalfIfNeeded(state, rng);

      expect(result.half).toBe(2);
      expect(result.turn).toBe(1);
      expect(result.gamePhase).toBe('playing');
    });

    it('devrait inverser les équipes de kick/réception', () => {
      const state = createHalftimeState({ kickingTeam: 'A' as TeamId });
      const rng = makeRNG('halftime-swap');
      const result = advanceHalfIfNeeded(state, rng);

      // A kicked in half 1 → B kicks in half 2
      expect(result.kickingTeam).toBe('B');
      expect(result.currentPlayer).toBe('A'); // receiving team plays first
    });

    it('devrait placer la balle au centre du terrain', () => {
      const state = createHalftimeState();
      const rng = makeRNG('halftime-ball');
      const result = advanceHalfIfNeeded(state, rng);

      expect(result.ball).toEqual({ x: 13, y: 7 });
    });

    it('devrait réinitialiser les compteurs d\'actions', () => {
      const state = createHalftimeState({
        playerActions: { A1: 'MOVE', A2: 'BLOCK' } as Record<string, any>,
        teamBlitzCount: { A: 1 } as Record<string, number>,
        teamFoulCount: { A: 1 } as Record<string, number>,
        rerollUsedThisTurn: true,
      });
      const rng = makeRNG('halftime-reset');
      const result = advanceHalfIfNeeded(state, rng);

      expect(result.playerActions).toEqual({});
      expect(result.teamBlitzCount).toEqual({});
      expect(result.teamFoulCount).toEqual({});
      expect(result.rerollUsedThisTurn).toBe(false);
      expect(result.isTurnover).toBe(false);
    });

    it('devrait réinitialiser PM et GFI des joueurs actifs', () => {
      const state = createHalftimeState({
        players: setup().players.map(p => ({
          ...p,
          pm: 0,
          gfiUsed: 2,
          stunned: true,
        })),
      });
      const rng = makeRNG('halftime-pm');
      const result = advanceHalfIfNeeded(state, rng);

      for (const player of result.players) {
        expect(player.pm).toBe(player.ma);
        expect(player.gfiUsed).toBe(0);
        expect(player.stunned).toBe(false);
      }
    });

    it('devrait rouler et appliquer un événement de kickoff', () => {
      const state = createHalftimeState();
      const rng = makeRNG('halftime-kickoff-event');
      const result = advanceHalfIfNeeded(state, rng);

      // Verify a kickoff event log was added (same pattern as post-TD test)
      const kickoffEventLogs = result.gameLog.filter(
        log => log.details && (log.details as Record<string, unknown>).kickoffEvent
      );
      expect(kickoffEventLogs.length).toBeGreaterThanOrEqual(1);
    });

    it('devrait ajouter un log de mi-temps', () => {
      const state = createHalftimeState();
      const rng = makeRNG('halftime-log');
      const result = advanceHalfIfNeeded(state, rng);

      const halftimeLogs = result.gameLog.filter(
        log => log.message.includes('Mi-temps') || log.message.includes('mi-temps')
      );
      expect(halftimeLogs.length).toBeGreaterThanOrEqual(1);
    });

    it('devrait conserver le score après la mi-temps', () => {
      const state = createHalftimeState({
        score: { teamA: 2, teamB: 1 },
      });
      const rng = makeRNG('halftime-score');
      const result = advanceHalfIfNeeded(state, rng);

      expect(result.score).toEqual({ teamA: 2, teamB: 1 });
    });

    it('devrait tenter de récupérer les joueurs KO', () => {
      const base = setup();
      const state = createHalftimeState({
        players: base.players.map(p =>
          p.id === 'A2'
            ? { ...p, state: 'knocked_out' as const }
            : p
        ),
        dugouts: {
          ...base.dugouts,
          teamA: {
            ...base.dugouts.teamA,
            zones: {
              ...base.dugouts.teamA.zones,
              knockedOut: {
                ...base.dugouts.teamA.zones.knockedOut,
                players: ['A2'],
              },
            },
          },
        },
      });

      // Run multiple times with different seeds to verify KO recovery can happen
      let recoveredAtLeastOnce = false;
      for (let i = 0; i < 20; i++) {
        const rng = makeRNG(`halftime-ko-${i}`);
        const result = advanceHalfIfNeeded(state, rng);
        const koZone = result.dugouts.teamA.zones.knockedOut;
        if (!koZone.players.includes('A2')) {
          recoveredAtLeastOnce = true;
          expect(result.dugouts.teamA.zones.reserves.players).toContain('A2');
          break;
        }
      }
      expect(recoveredAtLeastOnce).toBe(true);
    });
  });

  describe('advanceHalfIfNeeded — half 2 → end', () => {
    it('devrait terminer le match quand turn > 8 et half === 2', () => {
      const state = createHalftimeState({ half: 2 });
      const rng = makeRNG('end-match');
      const result = advanceHalfIfNeeded(state, rng);

      expect(result.gamePhase).toBe('ended');
    });
  });

  describe('advanceHalfIfNeeded — no transition', () => {
    it('ne devrait rien changer si turn <= 8', () => {
      const state = createHalftimeState({ turn: 8 });
      const rng = makeRNG('no-halftime');
      const result = advanceHalfIfNeeded(state, rng);

      expect(result.half).toBe(1);
      expect(result.turn).toBe(8);
    });
  });

  describe('END_TURN trigger halftime', () => {
    it('devrait déclencher la mi-temps via END_TURN quand turn passe à 9', () => {
      // Set up state at turn 8, player B's turn (B's END_TURN increments turn 8→9)
      const base = setup();
      const state: GameState = {
        ...base,
        gamePhase: 'playing' as const,
        half: 1,
        turn: 8,
        currentPlayer: 'B' as TeamId,
        kickingTeam: 'A' as TeamId,
      };
      const rng = makeRNG('end-turn-halftime');
      const result = applyMove(state, { type: 'END_TURN' }, rng);

      expect(result.half).toBe(2);
      expect(result.turn).toBe(1);
      expect(result.gamePhase).toBe('playing');
    });
  });
});
