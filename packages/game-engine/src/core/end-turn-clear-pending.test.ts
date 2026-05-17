import { describe, it, expect } from 'vitest';
import { setup } from './game-state';
import { handleEndTurn } from '../actions/turn-foul-actions';
import { makeRNG } from '../utils/rng';
import type { GameState, TeamId } from './types';

/**
 * Régression : `handleEndTurn` doit clear les états pending* pour éviter
 * un softlock du tour adverse. Avant le fix, un END_TURN forcé directement
 * (timer-out serveur, AI fallback, scénario admin) alors qu'un
 * pendingBlock / pendingReroll / pendingApothecary / etc. était ouvert
 * laissait ces flags actifs au tour suivant, gating le dispatcher sur
 * l'attente d'un BLOCK_CHOOSE / REROLL_CHOOSE / APOTHECARY_CHOOSE qui
 * ne viendrait jamais (joueur différent maintenant).
 *
 * Note : ces tests appellent `handleEndTurn` directement (pas via
 * `applyMove`) car le dispatcher principal rejette END_TURN quand certains
 * pendings sont actifs (`pendingKickoffEvent`, `pendingApothecary`). Le
 * cas de softlock concerne les chemins qui bypassent le dispatcher (cf.
 * apps/server timer handler).
 */
describe('handleEndTurn — clear pending* states (softlock fix)', () => {
  function baseState(): GameState {
    return {
      ...setup(),
      gamePhase: 'playing' as const,
      half: 1,
      turn: 1,
      currentPlayer: 'A' as TeamId,
      kickingTeam: 'A' as TeamId,
    };
  }

  it('clear pendingReroll', () => {
    const state: GameState = {
      ...baseState(),
      pendingReroll: {
        rollType: 'gfi',
        playerId: 'A1',
        team: 'A',
        targetNumber: 2,
        modifiers: 0,
        playerIndex: 0,
        to: { x: 5, y: 7 },
      },
    };
    const result = handleEndTurn(state, makeRNG('clear-pending-reroll'));
    expect(result.pendingReroll).toBeUndefined();
  });

  it('clear pendingApothecary', () => {
    const state: GameState = {
      ...baseState(),
      pendingApothecary: {
        playerId: 'B1',
        team: 'B',
        injuryType: 'ko',
      },
    };
    const result = handleEndTurn(state, makeRNG('clear-pending-apothecary'));
    expect(result.pendingApothecary).toBeUndefined();
  });

  it('clear pendingKickoffEvent', () => {
    const state: GameState = {
      ...baseState(),
      pendingKickoffEvent: {
        type: 'perfect-defence',
        team: 'A',
      },
    };
    const result = handleEndTurn(state, makeRNG('clear-pending-kickoff'));
    expect(result.pendingKickoffEvent).toBeUndefined();
  });

  it('clear pendingOnTheBall', () => {
    const state: GameState = {
      ...baseState(),
      pendingOnTheBall: {
        playerId: 'A1',
        team: 'A',
        pendingPassMove: { type: 'PASS', playerId: 'A1', targetId: 'A2' },
      } as any,
    };
    const result = handleEndTurn(state, makeRNG('clear-pending-otb'));
    expect(result.pendingOnTheBall).toBeUndefined();
  });
});
