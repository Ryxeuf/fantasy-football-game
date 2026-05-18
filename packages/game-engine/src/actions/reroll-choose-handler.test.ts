/**
 * S27.8.14 — Smoke tests pour le handler `handleRerollChoose` extrait
 * dans `actions/reroll-choose-handler.ts`. Les regles metier completes
 * (Loner test, dodge/GFI/pickup reroll, applyRollFailure /
 * applyPickupFailure) sont couvertes par les tests existants
 * (`actions.test.ts`, dodge/pickup integration tests).
 *
 * Ici on s'assure que :
 *  1. l'API `handleRerollChoose` est exportee comme une fonction,
 *  2. le re-export depuis `choice-handlers.ts` reste valide,
 *  3. le gate `pendingReroll absent` retourne le state inchange.
 */

import { describe, it, expect } from 'vitest';
import type { GameState, RNG } from '../core/types';
import { handleRerollChoose } from './reroll-choose-handler';
import { handleRerollChoose as handleRerollChooseReExport } from './choice-handlers';

const rng: RNG = () => 0.5;

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    width: 26,
    height: 15,
    players: [],
    currentPlayer: 'A',
    turn: 1,
    selectedPlayerId: null,
    isTurnover: false,
    apothecaryAvailable: { teamA: 1, teamB: 1 },
    dugouts: {
      teamA: { reserves: [], ko: [], casualties: [] },
      teamB: { reserves: [], ko: [], casualties: [] },
    },
    gamePhase: 'playing',
    half: 1,
    score: { teamA: 0, teamB: 0 },
    teamNames: { teamA: 'A', teamB: 'B' },
    teamRosters: { teamA: 'skaven', teamB: 'human' },
    pm: 0,
    gameLog: [],
    playerActions: {},
    teamBlitzCount: { A: 0, B: 0 },
    teamFoulCount: { A: 0, B: 0 },
    teamRerolls: { teamA: 3, teamB: 3 },
    matchStats: {},
    ...overrides,
  } as unknown as GameState;
}

describe('S27.8.14 — handleRerollChoose', () => {
  it('exporte une fonction depuis le nouveau module', () => {
    expect(typeof handleRerollChoose).toBe('function');
  });

  it('reste re-exporte depuis choice-handlers (backward compat)', () => {
    expect(typeof handleRerollChooseReExport).toBe('function');
    expect(handleRerollChooseReExport).toBe(handleRerollChoose);
  });

  it('retourne le state inchange si pendingReroll est absent', () => {
    const state = makeState({ pendingReroll: undefined });
    const next = handleRerollChoose(
      state,
      { type: 'REROLL_CHOOSE', useReroll: true },
      rng,
    );
    expect(next).toBe(state);
  });

  it('retourne le state inchange si pendingReroll est absent (useReroll=false)', () => {
    const state = makeState({ pendingReroll: undefined });
    const next = handleRerollChoose(
      state,
      { type: 'REROLL_CHOOSE', useReroll: false },
      rng,
    );
    expect(next).toBe(state);
  });

  it('ne mute pas le state passe en argument quand court-circuite par le gate', () => {
    const state = makeState({ pendingReroll: undefined });
    const snapshot = JSON.stringify(state);
    handleRerollChoose(
      state,
      { type: 'REROLL_CHOOSE', useReroll: true },
      rng,
    );
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});
