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

  it("un déplacement diagonal coûte 1 PM (Chebyshev), pas 2 (BB rule)", () => {
    // BUG fix : avant, le coût en PM était calculé en Manhattan
    // (|dx| + |dy|), donc une diagonale coûtait 2 PM au lieu d'1. BB
    // utilise Chebyshev (king-move) : 1 PM par case adjacente, diagonales
    // incluses. `getLegalMoves` énumère pourtant les 8 directions comme
    // single-PM BLITZ steps — incohérence corrigée ici.
    //
    // Setup : attaquant (4,5), cible (6,7). Le blitz consiste à se
    // déplacer en (5,6) (diagonale, distance Chebyshev=1 / Manhattan=2)
    // puis bloquer la cible adjacente.
    const attacker = makePlayer({
      id: 'A',
      team: 'A',
      pos: { x: 4, y: 5 },
      ma: 6,
      pm: 6,
      skills: [],
    });
    const target = makePlayer({
      id: 'T',
      team: 'B',
      pos: { x: 6, y: 7 },
      ma: 6,
      pm: 6,
    });
    const state = makeState({
      players: [attacker, target],
      currentPlayer: 'A',
    });
    const next = handleBlitz(
      state,
      { type: 'BLITZ', playerId: 'A', to: { x: 5, y: 6 }, targetId: 'T' },
      rng,
    );
    // L'attaquant a maintenant pm = 6 - 1 = 5 (Chebyshev), pas 6 - 2 = 4 (Manhattan).
    const movedAttacker = next.players.find(p => p.id === 'A');
    expect(movedAttacker?.pm).toBe(5);
  });
});
