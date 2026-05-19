/**
 * Tests pour rejectMove helper.
 * Audit 2026-05-19 quick win ST3.
 */

import { describe, it, expect } from 'vitest';

import { setup } from '../core/game-state';
import { applyMove } from './actions';
import { rejectMove } from './reject-move';
import { makeRNG } from '../utils/rng';

describe('rejectMove helper', () => {
  it('ajoute une entree de log avec prefixe [reject]', () => {
    const state = setup();
    const result = rejectMove(state, 'test reason', { foo: 'bar' });
    expect(result.gameLog.length).toBe(state.gameLog.length + 1);
    const lastLog = result.gameLog[result.gameLog.length - 1];
    expect(lastLog.message).toBe('[reject] test reason');
    expect(lastLog.type).toBe('info');
    expect(lastLog.details).toEqual({ foo: 'bar' });
  });

  it('ne mute pas le state initial', () => {
    const state = setup();
    const snapshot = state.gameLog.length;
    rejectMove(state, 'test reason');
    expect(state.gameLog.length).toBe(snapshot);
  });

  it('preserve les autres champs du state', () => {
    const state = setup();
    const result = rejectMove(state, 'test reason');
    expect(result.players).toBe(state.players);
    expect(result.turn).toBe(state.turn);
    expect(result.score).toEqual(state.score);
  });
});

describe('rejectMove integration (audit bug H2)', () => {
  it('BLITZ non legal genere un log de rejet', () => {
    const state = setup();
    // BLITZ vers une case occupee ou sans cible adjacente : non legal.
    const before = state.gameLog.length;
    const result = applyMove(
      state,
      {
        type: 'BLITZ',
        playerId: 'A1',
        to: { x: 0, y: 0 },
        targetId: 'B99-inexistant',
      },
      makeRNG('reject-blitz-test')
    );
    // Le BLITZ est rejete via rejectMove ⇒ +1 log avec prefixe.
    expect(result.gameLog.length).toBe(before + 1);
    const lastLog = result.gameLog[result.gameLog.length - 1];
    expect(lastLog.message).toContain('[reject]');
  });
});
