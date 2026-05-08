/**
 * S27.8.15 — Smoke tests pour `handleBlock` extrait dans
 * `actions/block-handler.ts`. Les regles metier completes (Foul
 * Appearance, Dump-off, assists offensifs/defensifs, Dauntless,
 * 1 vs 2+ dice resolution, pendingBlock) sont couvertes par
 * `block-action.test.ts` et les tests d'integration `actions.test.ts`.
 *
 * Ici on s'assure que :
 *  1. l'API `handleBlock` est exportee comme une fonction,
 *  2. le re-export depuis `block-action.ts` reste valide
 *     (preserve la chaine de delegation : `actions.ts` -> `block-action`
 *     -> `block-handler`),
 *  3. les gates de garde retournent le state inchange (attaquant
 *     introuvable, cible introuvable).
 */

import { describe, it, expect } from 'vitest';
import type { GameState, Player, RNG } from '../core/types';
import { handleBlock } from './block-handler';
import { handleBlock as handleBlockReExport } from './block-action';

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

describe('S27.8.15 — handleBlock', () => {
  it('exporte une fonction depuis le nouveau module', () => {
    expect(typeof handleBlock).toBe('function');
  });

  it('reste re-exporte depuis block-action.ts (backward compat)', () => {
    expect(typeof handleBlockReExport).toBe('function');
    expect(handleBlockReExport).toBe(handleBlock);
  });

  it('retourne le state inchange si l\'attaquant est introuvable', () => {
    const target = makePlayer({ id: 'T', team: 'B', pos: { x: 6, y: 5 } });
    const state = makeState({ players: [target] });
    const next = handleBlock(
      state,
      { type: 'BLOCK', playerId: 'missing', targetId: 'T' },
      rng,
    );
    expect(next).toBe(state);
  });

  it('retourne le state inchange si la cible est introuvable', () => {
    const attacker = makePlayer({ id: 'A', team: 'A' });
    const state = makeState({ players: [attacker] });
    const next = handleBlock(
      state,
      { type: 'BLOCK', playerId: 'A', targetId: 'missing' },
      rng,
    );
    expect(next).toBe(state);
  });

  it('ne mute pas le state passe en argument quand court-circuite par un gate', () => {
    const attacker = makePlayer({ id: 'A', team: 'A' });
    const state = makeState({ players: [attacker] });
    const snapshot = JSON.stringify(state);
    handleBlock(
      state,
      { type: 'BLOCK', playerId: 'A', targetId: 'missing' },
      rng,
    );
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});
