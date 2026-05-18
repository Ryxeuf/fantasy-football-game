/**
 * S27.8.11 — Smoke tests pour le module `actions/legal-moves.ts`
 * extrait de `actions.ts`. Les regles metier completes sont couvertes
 * par les tests existants (`mechanics/*.test.ts`, `getLegalMoves`
 * indirectement via 4900+ tests d'integration). Ici on s'assure que :
 *  1. l'API `getLegalMoves` est bien exportee,
 *  2. les short-circuits documentes (gamePhase, players, pendingX,
 *     turnover) retournent les Move[] attendus,
 *  3. l'ensemble est immuable (state non muté).
 */

import { describe, it, expect } from 'vitest';
import type { GameState, Player } from '../core/types';
import { getLegalMoves } from './legal-moves';

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

describe('S27.8.11 — getLegalMoves (API surface)', () => {
  it('exporte une fonction', () => {
    expect(typeof getLegalMoves).toBe('function');
  });

  it('retourne [] quand gamePhase === "ended"', () => {
    const state = makeState({ gamePhase: 'ended' as GameState['gamePhase'] });
    expect(getLegalMoves(state)).toEqual([]);
  });

  it('retourne uniquement [END_TURN] quand state.players n\'est pas un Array', () => {
    const state = makeState({ players: undefined as unknown as Player[] });
    const moves = getLegalMoves(state);
    expect(moves).toEqual([{ type: 'END_TURN' }]);
  });

  it('retourne uniquement [END_TURN] quand isTurnover === true', () => {
    const player = makePlayer({ team: 'A' });
    const state = makeState({ players: [player], isTurnover: true });
    const moves = getLegalMoves(state);
    expect(moves).toEqual([{ type: 'END_TURN' }]);
  });

  it('retourne uniquement les choix apothecary pendant pendingApothecary', () => {
    const state = makeState({
      pendingApothecary: { playerId: 'p', injuryRoll: 9 } as GameState['pendingApothecary'],
    });
    const moves = getLegalMoves(state);
    expect(moves).toHaveLength(2);
    expect(moves.every(m => m.type === 'APOTHECARY_CHOOSE')).toBe(true);
  });

  it('retourne uniquement les choix reroll pendant pendingReroll', () => {
    const state = makeState({
      pendingReroll: { kind: 'dodge' } as unknown as GameState['pendingReroll'],
    });
    const moves = getLegalMoves(state);
    expect(moves).toHaveLength(2);
    expect(moves.every(m => m.type === 'REROLL_CHOOSE')).toBe(true);
  });

  it('retourne KICKOFF_PERFECT_DEFENCE pendant pendingKickoffEvent perfect-defence', () => {
    const state = makeState({
      pendingKickoffEvent: { type: 'perfect-defence' } as GameState['pendingKickoffEvent'],
    });
    const moves = getLegalMoves(state);
    expect(moves).toHaveLength(1);
    const [first] = moves;
    expect(first?.type).toBe('KICKOFF_PERFECT_DEFENCE');
  });

  it('inclut END_TURN par defaut quand l\'equipe ne peut plus rien faire', () => {
    // Aucun joueur de l'equipe A : auto end turn doit declencher
    const player = makePlayer({ team: 'B' });
    const state = makeState({ players: [player], currentPlayer: 'A' });
    const moves = getLegalMoves(state);
    expect(moves.some(m => m.type === 'END_TURN')).toBe(true);
  });

  it('ne mute pas le state passe en argument', () => {
    const player = makePlayer({ team: 'A' });
    const state = makeState({ players: [player] });
    const snapshot = JSON.stringify(state);
    getLegalMoves(state);
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});
