import { describe, it, expect } from 'vitest';
import { setup, handlePostTouchdown } from './game-state';
import { applyMove } from '../actions/actions';
import { makeRNG } from '../utils/rng';
import type { GameState, TeamId } from './types';

/**
 * Helper: creates a post-TD state where team A scored.
 * Sets gamePhase to 'post-td', scoring team A, and ball removed.
 */
function createPostTdState(overrides?: Partial<GameState>): GameState {
  const base = setup();
  return {
    ...base,
    gamePhase: 'post-td' as const,
    half: 1,
    turn: 3,
    currentPlayer: 'A' as TeamId,
    isTurnover: true,
    ball: undefined,
    kickingTeam: 'B' as TeamId,
    players: base.players.map(p => ({ ...p, hasBall: false })),
    gameLog: [
      ...base.gameLog,
      {
        id: 'score-1',
        timestamp: Date.now(),
        type: 'score' as const,
        message: 'Touchdown par A1 !',
        playerId: 'A1',
        team: 'A' as TeamId,
      },
    ],
    ...overrides,
  };
}

describe('Règle: Post-touchdown re-kickoff', () => {
  describe('handlePostTouchdown', () => {
    it('devrait transitionner vers gamePhase "playing" après un TD', () => {
      const state = createPostTdState();
      const rng = makeRNG('post-td-test');
      const result = handlePostTouchdown(state, rng);

      expect(result.gamePhase).toBe('playing');
    });

    it('devrait définir l\'équipe qui a marqué comme kicking team', () => {
      // Team A scored → A kicks
      const state = createPostTdState();
      const rng = makeRNG('post-td-kicking');
      const result = handlePostTouchdown(state, rng);

      expect(result.kickingTeam).toBe('A');
      expect(result.currentPlayer).toBe('B'); // receiving team plays first
    });

    it('devrait ne pas avoir de balle (en attente du kickoff après re-setup)', () => {
      const state = createPostTdState();
      const rng = makeRNG('post-td-ball');
      const result = handlePostTouchdown(state, rng);

      expect(result.ball).toBeUndefined();
    });

    it('devrait réinitialiser les actions des joueurs', () => {
      const state = createPostTdState({
        playerActions: { A1: 'MOVE', A2: 'BLOCK' } as Record<string, any>,
        teamBlitzCount: { A: 1 } as Record<string, number>,
        teamFoulCount: { A: 1 } as Record<string, number>,
        rerollUsedThisTurn: true,
      });
      const rng = makeRNG('post-td-reset');
      const result = handlePostTouchdown(state, rng);

      expect(result.playerActions).toEqual({});
      expect(result.teamBlitzCount).toEqual({});
      expect(result.teamFoulCount).toEqual({});
      expect(result.rerollUsedThisTurn).toBe(false);
      expect(result.isTurnover).toBe(false);
    });

    it('devrait réinitialiser les PM et GFI des joueurs actifs', () => {
      const state = createPostTdState({
        players: setup().players.map(p => ({
          ...p,
          pm: 0,
          gfiUsed: 2,
          hasBall: false,
          stunned: true,
        })),
      });
      const rng = makeRNG('post-td-pm');
      const result = handlePostTouchdown(state, rng);

      for (const player of result.players) {
        expect(player.pm).toBe(player.ma);
        expect(player.gfiUsed).toBe(0);
        expect(player.stunned).toBe(false);
        expect(player.hasBall).toBe(false);
      }
    });

    it('devrait entrer en phase de setup pour le re-placement', () => {
      const state = createPostTdState();
      const rng = makeRNG('post-td-kickoff-event');
      const result = handlePostTouchdown(state, rng);

      // Après un TD, les joueurs doivent être replacés (phase setup)
      expect(result.preMatch?.phase).toBe('setup');
      expect(result.preMatch?.receivingTeam).toBe('B');
      expect(result.preMatch?.kickingTeam).toBe('A');
    });

    it('devrait ajouter un log de re-kickoff', () => {
      const state = createPostTdState();
      const rng = makeRNG('post-td-log');
      const result = handlePostTouchdown(state, rng);

      const reKickoffLogs = result.gameLog.filter(
        log => log.message.includes('frappe au pied')
      );
      expect(reKickoffLogs.length).toBeGreaterThanOrEqual(1);
    });

    it('devrait conserver le score après le re-kickoff', () => {
      const state = createPostTdState({
        score: { teamA: 2, teamB: 1 },
      });
      const rng = makeRNG('post-td-score');
      const result = handlePostTouchdown(state, rng);

      expect(result.score).toEqual({ teamA: 2, teamB: 1 });
    });

    it('devrait conserver le numéro de tour et la mi-temps', () => {
      const state = createPostTdState({ turn: 5, half: 2 });
      const rng = makeRNG('post-td-turn');
      const result = handlePostTouchdown(state, rng);

      // Turn and half should be preserved (kickoff riot may change turn)
      expect(result.half).toBe(2);
    });
  });

  describe('END_TURN en phase post-td', () => {
    it('devrait déclencher handlePostTouchdown via END_TURN', () => {
      const state = createPostTdState();
      const rng = makeRNG('end-turn-post-td');
      const result = applyMove(state, { type: 'END_TURN' }, rng);

      expect(result.gamePhase).toBe('playing');
      expect(result.preMatch?.phase).toBe('setup');
      expect(result.ball).toBeUndefined();
    });
  });

  describe('KO recovery au re-kickoff', () => {
    it('devrait tenter de récupérer les joueurs KO lors du re-kickoff', () => {
      const base = setup();
      const state = createPostTdState({
        players: base.players.map(p =>
          p.id === 'A2'
            ? { ...p, state: 'knocked_out' as const, hasBall: false }
            : { ...p, hasBall: false }
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

      // Run multiple times with different seeds to verify KO recovery happens
      let recoveredAtLeastOnce = false;
      for (let i = 0; i < 20; i++) {
        const rng = makeRNG(`ko-recovery-${i}`);
        const result = handlePostTouchdown(state, rng);
        const koZone = result.dugouts.teamA.zones.knockedOut;
        if (!koZone.players.includes('A2')) {
          recoveredAtLeastOnce = true;
          // Recovered player should be in reserves
          expect(result.dugouts.teamA.zones.reserves.players).toContain('A2');
          break;
        }
      }
      expect(recoveredAtLeastOnce).toBe(true);
    });
  });
});
