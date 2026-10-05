/**
 * Lot 3 « cerveau du coach » — après un touchdown, le compteur de rounds et
 * l'ordre d'alternance restent ceux de la mi-temps. Avant : le receveur
 * rejouait le numéro de tour du round en cours quand le marqueur jouait en
 * second (9 tours dans la mi-temps), et la 2e mi-temps lisait l'engagement
 * COURANT (le dernier marqueur) au lieu du premier engagement.
 */

import { describe, expect, it } from 'vitest';

import { handlePostTouchdown } from './game-state';
import type { GameState } from './types';
import { makePlayer, baseState } from '../__tests__/helpers';
import { makeRNG } from '../utils/rng';
import { createLogEntry } from '../utils/logging';

function scored(state: GameState, team: 'A' | 'B'): GameState {
  return {
    ...state,
    gamePhase: 'post-td',
    currentPlayer: team,
    gameLog: [...state.gameLog, createLogEntry('score', 'Touchdown', undefined, team)],
  };
}

function twoTeams(overrides: Partial<GameState>): GameState {
  const a1 = makePlayer({ id: 'A1', team: 'A', pos: { x: 5, y: 5 } });
  const b1 = makePlayer({ id: 'B1', team: 'B', pos: { x: 20, y: 5 } });
  return baseState([a1, b1], { kickingTeam: 'B', halfKickingTeam: 'B', half: 1, turn: 3, ...overrides });
}

describe('touchdown — compteur de rounds et alternance', () => {
  it('le marqueur jouait en second : le receveur entame le round suivant', () => {
    const next = handlePostTouchdown(scored(twoTeams({}), 'B'), makeRNG('td'));
    expect(next.turn).toBe(4);
    expect(next.currentPlayer).toBe('A');
    expect(next.kickingTeam).toBe('B');
    expect(next.halfKickingTeam).toBe('B');
  });

  it("le marqueur jouait en premier : l'autre équipe joue encore son tour du round", () => {
    const next = handlePostTouchdown(scored(twoTeams({}), 'A'), makeRNG('td'));
    expect(next.turn).toBe(3);
    expect(next.currentPlayer).toBe('B');
    expect(next.kickingTeam).toBe('A');
    // L'ordre d'alternance de la mi-temps ne change pas.
    expect(next.halfKickingTeam).toBe('B');
  });

  it('un touchdown au dernier tour du second joueur clôt la mi-temps', () => {
    const next = handlePostTouchdown(scored(twoTeams({ turn: 8 }), 'B'), makeRNG('td'));
    expect(next.half).toBe(2);
    expect(next.turn).toBe(1);
    expect(next.gamePhase).toBe('halftime');
    // L'équipe qui a engagé en 1re mi-temps (B) reçoit en 2e.
    expect(next.kickingTeam).toBe('A');
    expect(next.halfKickingTeam).toBe('A');
  });
});
