import { describe, it, expect } from 'vitest';
import { setup, type GameState, type Player } from '../index';
import { calculateCatchModifiers } from './passing';

/**
 * O.1 batch 3d — Diving Catch (BB2020) :
 * - +1 au jet de reception.
 * - (non implemente ici) : peut receptionner un ballon atterrissant sur une
 *   case adjacente.
 */

function patchPlayer(state: GameState, id: string, patch: Partial<Player>): GameState {
  return {
    ...state,
    players: state.players.map(p => (p.id === id ? { ...p, ...patch } : p)),
  };
}

describe('Pass modifier skills: Diving Catch', () => {
  it('+1 au jet de reception quand le catcher a diving-catch', () => {
    let s = setup();
    s = patchPlayer(s, 'A2', {
      skills: ['diving-catch'],
      pos: { x: 5, y: 5 },
    });
    s = patchPlayer(s, 'B1', { pos: { x: 25, y: 14 } });
    s = patchPlayer(s, 'B2', { pos: { x: 25, y: 0 } });
    s = patchPlayer(s, 'A1', { pos: { x: 0, y: 0 } });

    const catcher = s.players.find(p => p.id === 'A2')!;
    const withSkill = calculateCatchModifiers(s, catcher);

    const catcherNoSkill: Player = { ...catcher, skills: [] };
    const stateNoSkill = patchPlayer(s, 'A2', { skills: [] });
    const noSkill = calculateCatchModifiers(stateNoSkill, catcherNoSkill);

    expect(withSkill - noSkill).toBe(1);
  });

  it('le bonus Diving Catch se cumule avec Extra Arms', () => {
    let s = setup();
    s = patchPlayer(s, 'A2', {
      skills: ['diving-catch', 'extra-arms'],
      pos: { x: 5, y: 5 },
    });
    s = patchPlayer(s, 'B1', { pos: { x: 25, y: 14 } });
    s = patchPlayer(s, 'B2', { pos: { x: 25, y: 0 } });
    s = patchPlayer(s, 'A1', { pos: { x: 0, y: 0 } });

    const catcher = s.players.find(p => p.id === 'A2')!;
    const modBoth = calculateCatchModifiers(s, catcher);
    // +1 Diving Catch + +1 Extra Arms = +2 (sans TZ, sans DP)
    expect(modBoth).toBe(2);
  });

  it('le bonus reste inchange en presence de Nerves of Steel', () => {
    // Avec Nerves of Steel : TZ ignore. Avec Diving Catch : +1. Avec 2 TZ :
    // sans les deux skills on aurait -2, avec les deux on a 0 + 1 = +1.
    let s = setup();
    s = patchPlayer(s, 'A2', {
      skills: ['diving-catch', 'nerves-of-steel'],
      pos: { x: 5, y: 5 },
    });
    s = patchPlayer(s, 'B1', { pos: { x: 4, y: 5 } });
    s = patchPlayer(s, 'B2', { pos: { x: 6, y: 5 } });
    s = patchPlayer(s, 'A1', { pos: { x: 0, y: 0 } });

    const catcher = s.players.find(p => p.id === 'A2')!;
    expect(calculateCatchModifiers(s, catcher)).toBe(1);
  });
});
