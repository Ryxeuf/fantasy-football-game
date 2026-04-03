import { describe, it, expect } from 'vitest';
import { setup, advanceHalfIfNeeded, handlePostTouchdown } from './game-state';
import { applyMove } from '../actions/actions';
import { makeRNG } from '../utils/rng';
import type { GameState, TeamId } from './types';

/**
 * Helper: creates a state at the end of half 1 (turn 9, half 1).
 * This simulates what happens after both teams have completed 8 turns.
 */
function createEndOfHalf1State(overrides?: Partial<GameState>): GameState {
  const base = setup();
  return {
    ...base,
    gamePhase: 'playing' as const,
    half: 1,
    turn: 9, // Turn > 8 triggers half advance
    currentPlayer: 'A' as TeamId,
    kickingTeam: 'A' as TeamId,
    isTurnover: false,
    ...overrides,
  };
}

describe('Regle: Mi-temps complete', () => {
  describe('advanceHalfIfNeeded — transition vers halftime', () => {
    it('devrait transitionner vers gamePhase "halftime" quand turn > 8 en half 1', () => {
      const state = createEndOfHalf1State();
      const rng = makeRNG('halftime-phase');
      const result = advanceHalfIfNeeded(state, rng);

      expect(result.gamePhase).toBe('halftime');
    });

    it('devrait rester en half 1 pendant la phase halftime', () => {
      const state = createEndOfHalf1State();
      const rng = makeRNG('halftime-half');
      const result = advanceHalfIfNeeded(state, rng);

      // Still in halftime — half 2 starts after END_TURN
      expect(result.half).toBe(1);
    });

    it('devrait recuperer les joueurs KO pendant la mi-temps', () => {
      const base = setup();
      const state = createEndOfHalf1State({
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

    it('devrait reset les stats des joueurs (PM, stunned, GFI)', () => {
      const base = setup();
      const state = createEndOfHalf1State({
        players: base.players.map(p => ({
          ...p,
          pm: 0,
          gfiUsed: 2,
          stunned: true,
          hasBall: false,
        })),
      });
      const rng = makeRNG('halftime-reset-stats');
      const result = advanceHalfIfNeeded(state, rng);

      for (const player of result.players) {
        if (player.state && player.state !== 'active') continue;
        expect(player.pm).toBe(player.ma);
        expect(player.gfiUsed).toBe(0);
        expect(player.stunned).toBe(false);
      }
    });

    it('devrait ajouter un log de mi-temps', () => {
      const state = createEndOfHalf1State();
      const rng = makeRNG('halftime-log');
      const result = advanceHalfIfNeeded(state, rng);

      const halftimeLogs = result.gameLog.filter(
        log => log.message.includes('Mi-temps')
      );
      expect(halftimeLogs.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('END_TURN en phase halftime — completion de la mi-temps', () => {
    it('devrait passer a half 2, turn 1, gamePhase "playing"', () => {
      const state = createEndOfHalf1State();
      const rng1 = makeRNG('halftime-step1');
      const halftimeState = advanceHalfIfNeeded(state, rng1);
      expect(halftimeState.gamePhase).toBe('halftime');

      const rng2 = makeRNG('halftime-step2');
      const result = applyMove(halftimeState, { type: 'END_TURN' }, rng2);

      expect(result.gamePhase).toBe('playing');
      expect(result.half).toBe(2);
      expect(result.turn).toBe(1);
    });

    it('devrait swapper la kicking team pour la 2e mi-temps', () => {
      // Team A kicked in half 1 → Team B kicks in half 2
      const state = createEndOfHalf1State({ kickingTeam: 'A' as TeamId });
      const rng1 = makeRNG('halftime-swap1');
      const halftimeState = advanceHalfIfNeeded(state, rng1);

      const rng2 = makeRNG('halftime-swap2');
      const result = applyMove(halftimeState, { type: 'END_TURN' }, rng2);

      expect(result.kickingTeam).toBe('B');
      expect(result.currentPlayer).toBe('A'); // Receiving team plays first
    });

    it('devrait rouler et appliquer un evenement de kickoff', () => {
      const state = createEndOfHalf1State();
      const rng1 = makeRNG('halftime-kickoff1');
      const halftimeState = advanceHalfIfNeeded(state, rng1);

      const rng2 = makeRNG('halftime-kickoff2');
      const result = applyMove(halftimeState, { type: 'END_TURN' }, rng2);

      // Verify a kickoff event log was added
      const kickoffEventLogs = result.gameLog.filter(
        log => log.details && (log.details as Record<string, unknown>).kickoffEvent
      );
      expect(kickoffEventLogs.length).toBeGreaterThanOrEqual(1);
    });

    it('devrait placer la balle au centre pour le kickoff', () => {
      const state = createEndOfHalf1State();
      const rng1 = makeRNG('halftime-ball1');
      const halftimeState = advanceHalfIfNeeded(state, rng1);

      const rng2 = makeRNG('halftime-ball2');
      const result = applyMove(halftimeState, { type: 'END_TURN' }, rng2);

      expect(result.ball).toEqual({ x: 13, y: 7 });
    });

    it('devrait reinitialiser les compteurs d\'actions', () => {
      const state = createEndOfHalf1State({
        playerActions: { A1: 'MOVE', A2: 'BLOCK' } as Record<string, any>,
        teamBlitzCount: { A: 1 } as Record<string, number>,
        teamFoulCount: { A: 1 } as Record<string, number>,
        rerollUsedThisTurn: true,
      });
      const rng1 = makeRNG('halftime-actions1');
      const halftimeState = advanceHalfIfNeeded(state, rng1);

      const rng2 = makeRNG('halftime-actions2');
      const result = applyMove(halftimeState, { type: 'END_TURN' }, rng2);

      expect(result.playerActions).toEqual({});
      expect(result.teamBlitzCount).toEqual({});
      expect(result.teamFoulCount).toEqual({});
      expect(result.rerollUsedThisTurn).toBe(false);
      expect(result.isTurnover).toBe(false);
    });

    it('devrait conserver le score apres la mi-temps', () => {
      const state = createEndOfHalf1State({
        score: { teamA: 2, teamB: 1 },
      });
      const rng1 = makeRNG('halftime-score1');
      const halftimeState = advanceHalfIfNeeded(state, rng1);

      const rng2 = makeRNG('halftime-score2');
      const result = applyMove(halftimeState, { type: 'END_TURN' }, rng2);

      expect(result.score).toEqual({ teamA: 2, teamB: 1 });
    });
  });

  describe('Fin de match (half 2, turn > 8)', () => {
    it('devrait terminer le match quand turn > 8 en half 2', () => {
      const state = createEndOfHalf1State({
        half: 2,
        turn: 9,
      });
      const rng = makeRNG('end-match');
      const result = advanceHalfIfNeeded(state, rng);

      expect(result.gamePhase).toBe('ended');
      expect(result.matchResult).toBeDefined();
    });
  });

  describe('Integration: actions bloquees pendant halftime', () => {
    it('devrait ignorer MOVE pendant la phase halftime', () => {
      const state = createEndOfHalf1State();
      const rng1 = makeRNG('halftime-block-move1');
      const halftimeState = advanceHalfIfNeeded(state, rng1);

      const rng2 = makeRNG('halftime-block-move2');
      const result = applyMove(
        halftimeState,
        { type: 'MOVE', playerId: 'A1', to: { x: 5, y: 5 } },
        rng2
      );

      // State should be unchanged (move ignored)
      expect(result.gamePhase).toBe('halftime');
    });
  });
});
