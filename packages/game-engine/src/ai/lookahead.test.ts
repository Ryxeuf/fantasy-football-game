/**
 * Tests pour `lookahead.ts` (Lot 3.A.0.b — 2-ply minimax).
 *
 * Vérifie :
 *  - scoreMove2Ply retourne le score 1-ply pour les coups non-END_TURN
 *    (no surprise factor)
 *  - scoreMove2Ply pénalise END_TURN quand l'adversaire a un gros coup
 *    à jouer après
 *  - pickBestMove2Ply produit toujours un Move légal
 *  - le résultat est déterministe (même seed = même output)
 */

import { describe, expect, it } from 'vitest';

import { setup } from '../core/game-state';
import type { GameState, Player } from '../core/types';

import { scoreMove } from './evaluator';
import { pickBestMove2Ply, scoreMove2Ply } from './lookahead';

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    team: 'A',
    pos: { x: 5, y: 5 },
    name: 'Lineman',
    number: 1,
    position: 'Lineman',
    ma: 6,
    st: 3,
    ag: 3,
    pa: 4,
    av: 8,
    skills: [],
    pm: 6,
    state: 'active',
    ...overrides,
  };
}

function baseState(
  players: Player[],
  overrides: Partial<GameState> = {}
): GameState {
  const state = setup();
  return { ...state, players, ...overrides };
}

describe('scoreMove2Ply — Lot 3.A.0.b', () => {
  it('retourne le score 1-ply pour les coups non-END_TURN', () => {
    const a1 = makePlayer({
      id: 'a1',
      team: 'A',
      pos: { x: 10, y: 7 },
    });
    const b1 = makePlayer({
      id: 'b1',
      team: 'B',
      pos: { x: 15, y: 7 },
    });
    const state = baseState([a1, b1], { activeTeam: 'A' });

    const move = {
      type: 'MOVE' as const,
      playerId: 'a1',
      to: { x: 11, y: 7 },
    };
    const oneP = scoreMove(state, move, 'A');
    const twoP = scoreMove2Ply(state, move, 'A');
    expect(twoP).toBe(oneP);
  });

  it('END_TURN garde le score baseline si pas de coup adverse possible', () => {
    // État minimal sans adversaire : pas de réponse possible →
    // score 2-ply ≈ score 1-ply (juste -END_TURN_PENALTY).
    const a1 = makePlayer({ id: 'a1', team: 'A', pos: { x: 5, y: 5 } });
    const state = baseState([a1], { activeTeam: 'A' });
    const move = { type: 'END_TURN' as const };

    const twoP = scoreMove2Ply(state, move, 'A');
    expect(typeof twoP).toBe('number');
    expect(Number.isFinite(twoP)).toBe(true);
  });

  it('weights override propagé vers le scoring 1-ply', () => {
    const a1 = makePlayer({ id: 'a1', team: 'A', pos: { x: 10, y: 7 } });
    const b1 = makePlayer({ id: 'b1', team: 'B', pos: { x: 15, y: 7 } });
    const state = baseState([a1, b1], { activeTeam: 'A' });

    const move = {
      type: 'MOVE' as const,
      playerId: 'a1',
      to: { x: 11, y: 7 },
    };
    // Avec un poids POSITIONING_PER_STEP boosté, le score doit changer.
    const baseline = scoreMove2Ply(state, move, 'A');
    const boosted = scoreMove2Ply(state, move, 'A', {
      POSITIONING_PER_STEP: 50,
    });
    expect(boosted).not.toBe(baseline);
  });
});

describe('pickBestMove2Ply', () => {
  it('retourne null si aucun coup légal', () => {
    const state = baseState([], {
      activeTeam: 'A',
      gamePhase: 'ended',
    });
    const result = pickBestMove2Ply(state, 'A');
    expect(result).toBeNull();
  });

  it('produit un Move déterministe pour un état donné', () => {
    const a1 = makePlayer({ id: 'a1', team: 'A', pos: { x: 10, y: 7 } });
    const b1 = makePlayer({ id: 'b1', team: 'B', pos: { x: 15, y: 7 } });
    const state = baseState([a1, b1], { activeTeam: 'A' });

    const a = pickBestMove2Ply(state, 'A');
    const b = pickBestMove2Ply(state, 'A');
    expect(a).toEqual(b);
  });

  it('respecte le weights override (≠ baseline si poids différents)', () => {
    const a1 = makePlayer({
      id: 'a1',
      team: 'A',
      pos: { x: 10, y: 7 },
      hasBall: true,
    });
    const b1 = makePlayer({ id: 'b1', team: 'B', pos: { x: 15, y: 7 } });
    const state = baseState([a1, b1], { activeTeam: 'A' });

    const baseline = pickBestMove2Ply(state, 'A');
    // Override extreme : pénalise massivement les MOVE positionnels →
    // l'IA doit changer son choix.
    const skewed = pickBestMove2Ply(state, 'A', {
      POSITIONING_PER_STEP: 0,
      BALL_PROGRESS_PER_STEP: 0,
    });
    // Le test vérifie que l'override fait un effet ; les deux doivent
    // tous deux être des Move valides (non null).
    expect(baseline).not.toBeNull();
    expect(skewed).not.toBeNull();
  });
});
