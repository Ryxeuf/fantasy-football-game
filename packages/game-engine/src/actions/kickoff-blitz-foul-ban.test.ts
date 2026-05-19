/**
 * Tests de regression : FOUL interdit pendant kickoffBlitzTurn.
 *
 * Audit 2026-05-19 bug H1 — avant le fix, le filtre dispatcher
 * (actions.ts:161) bloquait PASS/HANDOFF pendant un blitz kickoff
 * mais oubliait FOUL. legal-moves.ts:248 generait aussi FOUL comme
 * coup legal. Bug fonctionnel BB.
 */

import { describe, it, expect } from 'vitest';

import { setup } from '../core/game-state';
import { applyMove } from './actions';
import { getLegalMoves } from './legal-moves';
import { makeRNG } from '../utils/rng';
import type { GameState, Player } from '../core/types';

function stateWithBlitzKickoff(): GameState {
  const base = setup();
  // Un joueur A1 adjacent a B1 (au sol = stunned).
  const players: Player[] = base.players.map((p) => {
    if (p.id === 'A1') return { ...p, pos: { x: 10, y: 7 } };
    if (p.id === 'B1') return { ...p, pos: { x: 11, y: 7 }, stunned: true };
    return p;
  });
  return { ...base, players, kickoffBlitzTurn: true, currentPlayer: 'A' };
}

describe('kickoffBlitzTurn: FOUL ban (audit bug H1)', () => {
  it('getLegalMoves ne genere pas de FOUL pendant kickoffBlitzTurn', () => {
    const state = stateWithBlitzKickoff();
    const legal = getLegalMoves(state);
    const fouls = legal.filter((m) => m.type === 'FOUL');
    expect(fouls).toHaveLength(0);
  });

  it('applyMove rejette une FOUL pendant kickoffBlitzTurn', () => {
    const state = stateWithBlitzKickoff();
    const result = applyMove(
      state,
      { type: 'FOUL', playerId: 'A1', targetId: 'B1' },
      makeRNG('kickoff-blitz-foul')
    );
    // applyMove retourne le state inchange (rejet silencieux pour
    // l'instant, cf. QW H2 pour log explicite).
    expect(result.teamFoulCount?.A ?? 0).toBe(0);
  });

  it('FOUL reste autorise hors kickoffBlitzTurn', () => {
    const state = { ...stateWithBlitzKickoff(), kickoffBlitzTurn: false };
    const legal = getLegalMoves(state);
    const fouls = legal.filter((m) => m.type === 'FOUL');
    expect(fouls.length).toBeGreaterThan(0);
  });
});
