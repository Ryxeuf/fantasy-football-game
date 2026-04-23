import { describe, it, expect } from 'vitest';
import { setup, type GameState, type Player } from '../index';
import {
  calculatePassModifiers,
  calculateCatchModifiers,
} from './passing';
import { calculatePickupModifiers } from './movement';

/**
 * O.1 batch 3 — Skills modificateurs de jets (niche mais a fort impact local) :
 * - Nerves of Steel : ignore les malus de zones de tacle sur pass et catch.
 * - Big Hand : ignore le malus de zones de tacle sur le jet de ramassage.
 * - Extra Arms : +1 aux jets de reception et de ramassage.
 */

function patchPlayer(state: GameState, id: string, patch: Partial<Player>): GameState {
  return {
    ...state,
    players: state.players.map(p => (p.id === id ? { ...p, ...patch } : p)),
  };
}

describe('Niche skills: Nerves of Steel', () => {
  it('annule le malus TZ sur le jet de passe', () => {
    let s = setup();
    // A2 a le passeur, entoure par B1 et B2 (2 TZ).
    s = patchPlayer(s, 'A2', {
      skills: ['nerves-of-steel'],
      pos: { x: 5, y: 5 },
      pa: 3,
    });
    s = patchPlayer(s, 'B1', { pos: { x: 4, y: 5 } });
    s = patchPlayer(s, 'B2', { pos: { x: 6, y: 5 } });
    s = patchPlayer(s, 'A1', { pos: { x: 0, y: 0 } });

    const passer = s.players.find(p => p.id === 'A2')!;
    const target = { x: 10, y: 5 }; // distance 5 -> Short range (+0)
    const modWithSkill = calculatePassModifiers(s, passer, target);

    const passerNoSkill: Player = { ...passer, skills: [] };
    const stateNoSkill = patchPlayer(s, 'A2', { skills: [] });
    const modNoSkill = calculatePassModifiers(stateNoSkill, passerNoSkill, target);

    // Avec Nerves of Steel : les TZ sont ignorees.
    expect(modWithSkill).toBeGreaterThan(modNoSkill);
    expect(modWithSkill).toBe(0); // Short range, pas de TZ pris en compte
    expect(modNoSkill).toBe(-2); // Short range (0) - 2 TZ = -2
  });

  it('annule le malus TZ sur le jet de reception', () => {
    let s = setup();
    // A2 receveur entoure de 2 adversaires.
    s = patchPlayer(s, 'A2', {
      skills: ['nerves-of-steel'],
      pos: { x: 5, y: 5 },
    });
    s = patchPlayer(s, 'B1', { pos: { x: 4, y: 5 } });
    s = patchPlayer(s, 'B2', { pos: { x: 6, y: 5 } });
    s = patchPlayer(s, 'A1', { pos: { x: 0, y: 0 } });

    const catcher = s.players.find(p => p.id === 'A2')!;
    const modWithSkill = calculateCatchModifiers(s, catcher);

    const catcherNoSkill: Player = { ...catcher, skills: [] };
    const stateNoSkill = patchPlayer(s, 'A2', { skills: [] });
    const modNoSkill = calculateCatchModifiers(stateNoSkill, catcherNoSkill);

    expect(modWithSkill).toBe(0);
    expect(modNoSkill).toBe(-2);
  });

  it('ne modifie pas les autres malus (Disturbing Presence)', () => {
    let s = setup();
    // Pas d'adversaires TZ, mais 1 adversaire avec Disturbing Presence a 2 cases.
    s = patchPlayer(s, 'A2', {
      skills: ['nerves-of-steel'],
      pos: { x: 5, y: 5 },
      pa: 3,
    });
    s = patchPlayer(s, 'B1', { pos: { x: 7, y: 5 }, skills: ['disturbing-presence'] });
    s = patchPlayer(s, 'B2', { pos: { x: 25, y: 0 } });
    s = patchPlayer(s, 'A1', { pos: { x: 0, y: 0 } });

    const passer = s.players.find(p => p.id === 'A2')!;
    const mod = calculatePassModifiers(s, passer, { x: 10, y: 5 });
    // Nerves ne modifie pas le malus DP : -1 DP attendu + 0 (Short) = -1
    expect(mod).toBe(-1);
  });
});

describe('Niche skills: Big Hand', () => {
  it('annule le malus TZ sur le jet de ramassage', () => {
    let s = setup();
    s = patchPlayer(s, 'A2', {
      skills: ['big-hand'],
      pos: { x: 5, y: 5 },
    });
    s = patchPlayer(s, 'B1', { pos: { x: 4, y: 5 } });
    s = patchPlayer(s, 'B2', { pos: { x: 6, y: 5 } });
    s = patchPlayer(s, 'A1', { pos: { x: 0, y: 0 } });

    const modWithSkill = calculatePickupModifiers(s, { x: 5, y: 5 }, 'A', s.players.find(p => p.id === 'A2'));
    const stateNoSkill = patchPlayer(s, 'A2', { skills: [] });
    const modNoSkill = calculatePickupModifiers(stateNoSkill, { x: 5, y: 5 }, 'A', stateNoSkill.players.find(p => p.id === 'A2'));

    expect(modWithSkill).toBe(0);
    expect(modNoSkill).toBe(-2);
  });
});

describe('Niche skills: Extra Arms', () => {
  it('+1 au jet de ramassage', () => {
    let s = setup();
    s = patchPlayer(s, 'A2', {
      skills: ['extra-arms'],
      pos: { x: 5, y: 5 },
    });
    s = patchPlayer(s, 'B1', { pos: { x: 25, y: 0 } });
    s = patchPlayer(s, 'B2', { pos: { x: 25, y: 1 } });
    s = patchPlayer(s, 'A1', { pos: { x: 0, y: 0 } });

    const withSkill = calculatePickupModifiers(s, { x: 5, y: 5 }, 'A', s.players.find(p => p.id === 'A2'));
    const stateNoSkill = patchPlayer(s, 'A2', { skills: [] });
    const noSkill = calculatePickupModifiers(stateNoSkill, { x: 5, y: 5 }, 'A', stateNoSkill.players.find(p => p.id === 'A2'));

    expect(withSkill - noSkill).toBe(1);
  });

  it('+1 au jet de reception', () => {
    let s = setup();
    s = patchPlayer(s, 'A2', {
      skills: ['extra-arms'],
      pos: { x: 5, y: 5 },
    });
    s = patchPlayer(s, 'B1', { pos: { x: 25, y: 0 } });
    s = patchPlayer(s, 'B2', { pos: { x: 25, y: 1 } });
    s = patchPlayer(s, 'A1', { pos: { x: 0, y: 0 } });

    const catcher = s.players.find(p => p.id === 'A2')!;
    const withSkill = calculateCatchModifiers(s, catcher);

    const catcherNoSkill: Player = { ...catcher, skills: [] };
    const stateNoSkill = patchPlayer(s, 'A2', { skills: [] });
    const noSkill = calculateCatchModifiers(stateNoSkill, catcherNoSkill);

    expect(withSkill - noSkill).toBe(1);
  });

  it('cumul Big Hand + Extra Arms : +1 et TZ ignore', () => {
    let s = setup();
    s = patchPlayer(s, 'A2', {
      skills: ['big-hand', 'extra-arms'],
      pos: { x: 5, y: 5 },
    });
    s = patchPlayer(s, 'B1', { pos: { x: 4, y: 5 } });
    s = patchPlayer(s, 'B2', { pos: { x: 6, y: 5 } });
    s = patchPlayer(s, 'A1', { pos: { x: 0, y: 0 } });

    const mod = calculatePickupModifiers(s, { x: 5, y: 5 }, 'A', s.players.find(p => p.id === 'A2'));
    // Sans skill : -2 (2 TZ). Avec Big Hand : 0 TZ. Avec Extra Arms : +1. Total = +1.
    expect(mod).toBe(1);
  });
});
