/**
 * S27.8.12 — Smoke tests pour les 3 handlers extraits dans
 * `actions/move-leap-dodge-handlers.ts`. Les regles metier completes
 * sont couvertes par les nombreux tests existants (`actions.test.ts`,
 * `mechanics/movement.test.ts`, etc.). Ici on s'assure que :
 *  1. les handlers sont exportes,
 *  2. les gates de garde (player inexistant) renvoient le state inchange,
 *  3. les handlers sont des fonctions pures cote signature (pas de
 *     mutation de l'argument).
 */

import { describe, it, expect } from 'vitest';
import type { GameState, Player, RNG } from '../core/types';
import {
  handleLeap,
  handleMove,
  handleDodge,
} from './move-leap-dodge-handlers';

const rng: RNG = () => 0.5;

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p',
    team: 'A',
    pos: { x: 5, y: 5 },
    name: 'P',
    number: 1,
    position: 'Lineman',
    ma: 6,
    st: 3,
    ag: 3,
    pa: 4,
    av: 8,
    skills: [],
    pm: 6,
    ...overrides,
  };
}

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
    matchStats: {},
    ...overrides,
  } as unknown as GameState;
}

describe('S27.8.12 — handleLeap', () => {
  it('exporte une fonction', () => {
    expect(typeof handleLeap).toBe('function');
  });

  it('retourne le state inchange si le playerId n\'existe pas', () => {
    const player = makePlayer({ id: 'P', team: 'A' });
    const state = makeState({ players: [player] });
    const next = handleLeap(
      state,
      { type: 'LEAP', playerId: 'missing', to: { x: 7, y: 7 } },
      rng,
    );
    expect(next).toBe(state);
  });

  it('ne mute pas le state passe en argument quand le LEAP est rejete', () => {
    const player = makePlayer({ id: 'P', team: 'A', skills: [] });
    const state = makeState({ players: [player] });
    const snapshot = JSON.stringify(state);
    handleLeap(
      state,
      { type: 'LEAP', playerId: 'P', to: { x: 6, y: 5 } },
      rng,
    );
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});

describe('S27.8.12 — handleMove', () => {
  it('exporte une fonction', () => {
    expect(typeof handleMove).toBe('function');
  });

  it('retourne le state inchange si le playerId n\'existe pas', () => {
    const player = makePlayer({ id: 'P', team: 'A' });
    const state = makeState({ players: [player] });
    const next = handleMove(
      state,
      { type: 'MOVE', playerId: 'missing', to: { x: 6, y: 5 } },
      rng,
    );
    expect(next).toBe(state);
  });

  it('ne mute pas le state passe en argument', () => {
    const player = makePlayer({ id: 'P', team: 'A' });
    const state = makeState({ players: [player] });
    const snapshot = JSON.stringify(state);
    handleMove(
      state,
      { type: 'MOVE', playerId: 'missing', to: { x: 6, y: 5 } },
      rng,
    );
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});

describe('S27.8.12 — handleDodge', () => {
  it('exporte une fonction', () => {
    expect(typeof handleDodge).toBe('function');
  });

  it('retourne le state inchange si le playerId n\'existe pas', () => {
    const player = makePlayer({ id: 'P', team: 'A' });
    const state = makeState({ players: [player] });
    const next = handleDodge(
      state,
      { type: 'DODGE', playerId: 'missing', from: { x: 5, y: 5 }, to: { x: 6, y: 5 } },
      rng,
    );
    expect(next).toBe(state);
  });
});
