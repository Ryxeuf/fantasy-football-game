/**
 * S27.8.13 — Smoke tests pour le handler `handleBlitz` extrait dans
 * `actions/blitz-handler.ts`. Les regles metier completes (Foul
 * Appearance, dodge, Shadowing, Break Tackle, armor + injury, blocage
 * post-mouvement, pendingBlock) sont couvertes par les tests existants
 * (`actions.test.ts`, `mechanics/blocking.test.ts`, etc.).
 *
 * Ici on s'assure que :
 *  1. l'API `handleBlitz` est exportee comme une fonction,
 *  2. les gates de garde retournent le state inchange (attaquant
 *     introuvable, cible introuvable, blitz illegal),
 *  3. handleBlitz ne mute pas le state passe en argument quand
 *     court-circuite par un gate.
 */

import { describe, it, expect } from 'vitest';
import type { GameState, Player, RNG } from '../core/types';
import { handleBlitz } from './blitz-handler';

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
    apothecaryAvailable: { teamA: true, teamB: true },
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

describe('S27.8.13 — handleBlitz', () => {
  it('exporte une fonction', () => {
    expect(typeof handleBlitz).toBe('function');
  });

  it('retourne le state inchange si l\'attaquant est introuvable', () => {
    const target = makePlayer({ id: 'T', team: 'B', pos: { x: 6, y: 5 } });
    const state = makeState({ players: [target] });
    const next = handleBlitz(
      state,
      { type: 'BLITZ', playerId: 'missing', to: { x: 6, y: 5 }, targetId: 'T' },
      rng,
    );
    expect(next).toBe(state);
  });

  it('retourne le state inchange si la cible est introuvable', () => {
    const attacker = makePlayer({ id: 'A', team: 'A', pos: { x: 4, y: 5 } });
    const state = makeState({ players: [attacker] });
    const next = handleBlitz(
      state,
      { type: 'BLITZ', playerId: 'A', to: { x: 5, y: 5 }, targetId: 'missing' },
      rng,
    );
    expect(next).toBe(state);
  });

  it('retourne le state inchange si le blitz est illegal (cible amie)', () => {
    // canBlitz refuse les coequipiers
    const attacker = makePlayer({ id: 'A', team: 'A', pos: { x: 4, y: 5 } });
    const teammate = makePlayer({ id: 'M', team: 'A', pos: { x: 6, y: 5 } });
    const state = makeState({ players: [attacker, teammate] });
    const next = handleBlitz(
      state,
      { type: 'BLITZ', playerId: 'A', to: { x: 5, y: 5 }, targetId: 'M' },
      rng,
    );
    expect(next).toBe(state);
  });

  it('ne mute pas le state passe en argument quand court-circuite par un gate', () => {
    const attacker = makePlayer({ id: 'A', team: 'A', pos: { x: 4, y: 5 } });
    const state = makeState({ players: [attacker] });
    const snapshot = JSON.stringify(state);
    handleBlitz(
      state,
      { type: 'BLITZ', playerId: 'A', to: { x: 5, y: 5 }, targetId: 'missing' },
      rng,
    );
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});
