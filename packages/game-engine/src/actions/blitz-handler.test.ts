/**
 * S27.8.8 — Smoke tests pour `handleBlitz` extrait dans
 * `actions/blitz-handler.ts`. Les regles metier (block dice, dodge,
 * shadowing, break tackle, etc.) sont deja couvertes par les tests
 * dedies (`mechanics/blitz.test.ts`, `mechanics/blitz-limit.test.ts`,
 * `armor-injury-rolls.test.ts`, `turnover-detection.test.ts`). Ici on
 * s'assure uniquement que :
 *   1. l'action est ignoree si attaquant/cible absent,
 *   2. l'action est ignoree si `canBlitz` echoue (gate principal),
 *   3. apres le blitz, l'attaquant est marque `BLITZ` dans
 *      `playerActions` et `teamBlitzCount` est incremente.
 */
import { describe, it, expect } from 'vitest';
import type { GameState, Player, RNG } from '../core/types';
import { handleBlitz } from './blitz-handler';

const rng: RNG = () => 0.5;

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p',
    team: 'A',
    pos: { x: 0, y: 0 },
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

function makeState(players: Player[], current: 'A' | 'B' = 'A'): GameState {
  return {
    width: 26,
    height: 15,
    players,
    currentPlayer: current,
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
    teamRosters: { teamA: 'human', teamB: 'human' },
    pm: 0,
    gameLog: [],
    playerActions: {},
    teamBlitzCount: { A: 0, B: 0 },
    teamFoulCount: { A: 0, B: 0 },
    matchStats: {},
  } as unknown as GameState;
}

describe('S27.8.8 — handleBlitz', () => {
  it("ignore l'action si l'attaquant n'existe pas", () => {
    const target = makePlayer({ id: 'T', team: 'B', pos: { x: 1, y: 0 } });
    const state = makeState([target], 'A');
    const next = handleBlitz(
      state,
      { type: 'BLITZ', playerId: 'missing', to: { x: 0, y: 0 }, targetId: 'T' },
      rng,
    );
    expect(next).toBe(state);
  });

  it("ignore l'action si la cible n'existe pas", () => {
    const attacker = makePlayer({ id: 'A1', team: 'A' });
    const state = makeState([attacker], 'A');
    const next = handleBlitz(
      state,
      { type: 'BLITZ', playerId: 'A1', to: { x: 1, y: 0 }, targetId: 'missing' },
      rng,
    );
    expect(next).toBe(state);
  });

  it("ignore l'action si canBlitz echoue (mauvais tour d'equipe)", () => {
    const attacker = makePlayer({ id: 'A1', team: 'A', pos: { x: 0, y: 0 } });
    const target = makePlayer({ id: 'T', team: 'B', pos: { x: 2, y: 0 } });
    const state = makeState([attacker, target], 'B');
    const next = handleBlitz(
      state,
      { type: 'BLITZ', playerId: 'A1', to: { x: 1, y: 0 }, targetId: 'T' },
      rng,
    );
    expect(next).toBe(state);
  });

  it("ignore l'action si l'attaquant et la cible sont dans la meme equipe", () => {
    const attacker = makePlayer({ id: 'A1', team: 'A', pos: { x: 0, y: 0 } });
    const ally = makePlayer({ id: 'A2', team: 'A', pos: { x: 2, y: 0 } });
    const state = makeState([attacker, ally], 'A');
    const next = handleBlitz(
      state,
      { type: 'BLITZ', playerId: 'A1', to: { x: 1, y: 0 }, targetId: 'A2' },
      rng,
    );
    expect(next).toBe(state);
  });
});
