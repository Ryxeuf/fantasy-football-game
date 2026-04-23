import { describe, it, expect } from 'vitest';
import { setup, type GameState, type Player } from '../index';
import { calculatePassModifiers } from './passing';

/**
 * O.1 batch 3b — Skills modificateurs de jets de passe :
 * - Accurate : +1 au jet de passe pour les distances Quick (1-3) et Short (4-6).
 * - Strong Arm : +1 au jet de passe pour les distances Short (4-6), Long (7-10)
 *   et Bomb/Long-Bomb (11-13).
 * Le cumul d'Accurate + Strong Arm donne +2 uniquement sur la portee Short.
 */

function patchPlayer(state: GameState, id: string, patch: Partial<Player>): GameState {
  return {
    ...state,
    players: state.players.map(p => (p.id === id ? { ...p, ...patch } : p)),
  };
}

function setupPasser(skills: string[]): { state: GameState; passer: Player } {
  let s = setup();
  s = patchPlayer(s, 'A2', { skills, pos: { x: 5, y: 5 }, pa: 3 });
  // Degager le terrain pour eviter les TZ/DP parasites
  s = patchPlayer(s, 'A1', { pos: { x: 0, y: 0 } });
  s = patchPlayer(s, 'B1', { pos: { x: 25, y: 14 } });
  s = patchPlayer(s, 'B2', { pos: { x: 25, y: 0 } });
  const passer = s.players.find(p => p.id === 'A2')!;
  return { state: s, passer };
}

describe('Pass modifier skills: Accurate', () => {
  it('+1 sur une passe Quick (distance 3)', () => {
    const { state, passer } = setupPasser(['accurate']);
    const mod = calculatePassModifiers(state, passer, { x: 8, y: 5 });
    // Quick range = +1 base, Accurate = +1 supplementaire -> +2
    expect(mod).toBe(2);
  });

  it('+1 sur une passe Short (distance 5)', () => {
    const { state, passer } = setupPasser(['accurate']);
    const mod = calculatePassModifiers(state, passer, { x: 10, y: 5 });
    // Short range = 0, Accurate = +1 -> +1
    expect(mod).toBe(1);
  });

  it('aucun bonus sur une passe Long (distance 10)', () => {
    const { state, passer } = setupPasser(['accurate']);
    const mod = calculatePassModifiers(state, passer, { x: 15, y: 5 });
    // Long range = -1, Accurate inactif (> Short) -> -1
    expect(mod).toBe(-1);
  });

  it('aucun bonus sur une passe Long Bomb (distance 13)', () => {
    const { state, passer } = setupPasser(['accurate']);
    const mod = calculatePassModifiers(state, passer, { x: 18, y: 5 });
    // Long Bomb = -2, Accurate inactif -> -2
    expect(mod).toBe(-2);
  });
});

describe('Pass modifier skills: Strong Arm', () => {
  it('aucun bonus sur une passe Quick (distance 3)', () => {
    const { state, passer } = setupPasser(['strong-arm']);
    const mod = calculatePassModifiers(state, passer, { x: 8, y: 5 });
    // Quick range = +1, Strong Arm inactif (Quick) -> +1
    expect(mod).toBe(1);
  });

  it('+1 sur une passe Short (distance 5)', () => {
    const { state, passer } = setupPasser(['strong-arm']);
    const mod = calculatePassModifiers(state, passer, { x: 10, y: 5 });
    // Short range = 0, Strong Arm = +1 -> +1
    expect(mod).toBe(1);
  });

  it('+1 sur une passe Long (distance 10)', () => {
    const { state, passer } = setupPasser(['strong-arm']);
    const mod = calculatePassModifiers(state, passer, { x: 15, y: 5 });
    // Long range = -1, Strong Arm = +1 -> 0
    expect(mod).toBe(0);
  });

  it('+1 sur une passe Long Bomb (distance 13)', () => {
    const { state, passer } = setupPasser(['strong-arm']);
    const mod = calculatePassModifiers(state, passer, { x: 18, y: 5 });
    // Long Bomb = -2, Strong Arm = +1 -> -1
    expect(mod).toBe(-1);
  });
});

describe('Pass modifier skills: cumul Accurate + Strong Arm', () => {
  it('+2 sur une passe Short (seule portee cumulant les deux)', () => {
    const { state, passer } = setupPasser(['accurate', 'strong-arm']);
    const mod = calculatePassModifiers(state, passer, { x: 10, y: 5 });
    // Short range = 0, Accurate +1, Strong Arm +1 -> +2
    expect(mod).toBe(2);
  });

  it('+1 seulement sur Quick (Accurate actif, Strong Arm inactif)', () => {
    const { state, passer } = setupPasser(['accurate', 'strong-arm']);
    const mod = calculatePassModifiers(state, passer, { x: 8, y: 5 });
    // Quick range = +1, Accurate +1, Strong Arm inactif -> +2
    expect(mod).toBe(2);
  });

  it('Long range : Accurate inactif, Strong Arm actif', () => {
    const { state, passer } = setupPasser(['accurate', 'strong-arm']);
    const mod = calculatePassModifiers(state, passer, { x: 15, y: 5 });
    // Long range = -1, Accurate inactif, Strong Arm +1 -> 0
    expect(mod).toBe(0);
  });
});
