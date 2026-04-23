import { describe, it, expect } from 'vitest';
import {
  setup,
  type GameState,
  type Player,
  type RNG,
} from '../index';
import {
  calculatePassModifiers,
  performCatchRollWithSkill,
} from './passing';

/**
 * O.1 batch 3f — Skills niche passe/catch :
 * - Cannoneer : +1 au jet de passe sur les distances Long (7-10) et Bomb (11-13).
 *   Complement symetrique d'Accurate (Quick/Short) et Strong Arm (Short/Long/Bomb).
 * - Monstrous Mouth : relance toute tentative ratee de reception (effet symetrique
 *   du skill Catch mais disponible uniquement pour les joueurs ayant la mutation).
 *   Le second effet (Strip Ball ne peut pas etre utilise contre ce joueur) est
 *   couvert par un autre test (blocking).
 */

function scriptedRng(values: number[]): RNG {
  let idx = 0;
  return () => {
    const v = values[idx % values.length];
    idx += 1;
    return v;
  };
}

function patchPlayer(state: GameState, id: string, patch: Partial<Player>): GameState {
  return {
    ...state,
    players: state.players.map(p => (p.id === id ? { ...p, ...patch } : p)),
  };
}

function setupPasser(skills: string[]): { state: GameState; passer: Player } {
  let s = setup();
  s = patchPlayer(s, 'A2', { skills, pos: { x: 5, y: 5 }, pa: 3 });
  // Eloigner les autres joueurs pour eviter TZ/DP parasites.
  s = patchPlayer(s, 'A1', { pos: { x: 0, y: 0 } });
  s = patchPlayer(s, 'B1', { pos: { x: 25, y: 14 } });
  s = patchPlayer(s, 'B2', { pos: { x: 25, y: 0 } });
  const passer = s.players.find(p => p.id === 'A2')!;
  return { state: s, passer };
}

function makeCatcher(skills: string[]): Player {
  const s = setup();
  const base = s.players.find(p => p.id === 'A2')!;
  return { ...base, skills, ag: 3 };
}

describe('Pass modifier skill: Cannoneer', () => {
  it('aucun bonus sur une passe Quick (distance 3)', () => {
    const { state, passer } = setupPasser(['cannoneer']);
    const mod = calculatePassModifiers(state, passer, { x: 8, y: 5 });
    // Quick range = +1, Cannoneer inactif (Quick) -> +1
    expect(mod).toBe(1);
  });

  it('aucun bonus sur une passe Short (distance 5)', () => {
    const { state, passer } = setupPasser(['cannoneer']);
    const mod = calculatePassModifiers(state, passer, { x: 10, y: 5 });
    // Short range = 0, Cannoneer inactif -> 0
    expect(mod).toBe(0);
  });

  it('+1 sur une passe Long (distance 10)', () => {
    const { state, passer } = setupPasser(['cannoneer']);
    const mod = calculatePassModifiers(state, passer, { x: 15, y: 5 });
    // Long range = -1, Cannoneer +1 -> 0
    expect(mod).toBe(0);
  });

  it('+1 sur une passe Long Bomb (distance 13)', () => {
    const { state, passer } = setupPasser(['cannoneer']);
    const mod = calculatePassModifiers(state, passer, { x: 18, y: 5 });
    // Long Bomb = -2, Cannoneer +1 -> -1
    expect(mod).toBe(-1);
  });

  it('cumul Cannoneer + Strong Arm sur une passe Long (+2 total)', () => {
    const { state, passer } = setupPasser(['cannoneer', 'strong-arm']);
    const mod = calculatePassModifiers(state, passer, { x: 15, y: 5 });
    // Long range = -1, Cannoneer +1, Strong Arm +1 -> +1
    expect(mod).toBe(1);
  });

  it('cumul Cannoneer + Strong Arm sur une passe Bomb (+2 total)', () => {
    const { state, passer } = setupPasser(['cannoneer', 'strong-arm']);
    const mod = calculatePassModifiers(state, passer, { x: 18, y: 5 });
    // Long Bomb = -2, Cannoneer +1, Strong Arm +1 -> 0
    expect(mod).toBe(0);
  });

  it('Accurate + Cannoneer ne se cumulent jamais (aucune portee commune)', () => {
    const { state, passer } = setupPasser(['accurate', 'cannoneer']);
    const short = calculatePassModifiers(state, passer, { x: 10, y: 5 });
    const long = calculatePassModifiers(state, passer, { x: 15, y: 5 });
    // Short : Accurate +1, Cannoneer inactif -> +1
    expect(short).toBe(1);
    // Long : Accurate inactif, Cannoneer +1, base -1 -> 0
    expect(long).toBe(0);
  });
});

describe('Catch skill: Monstrous Mouth (reroll)', () => {
  it('relance un jet de reception rate (echec puis reussite)', () => {
    const catcher = makeCatcher(['monstrous-mouth']);
    // AG 3 -> target 4+. 1er jet = 1 (echec), 2eme = 5 (reussite).
    const rng = scriptedRng([0.01, 0.75]);
    const { result, rerolled } = performCatchRollWithSkill(catcher, rng, 0);
    expect(rerolled).toBe(true);
    expect(result.success).toBe(true);
  });

  it('ne relance pas si le premier jet reussit', () => {
    const catcher = makeCatcher(['monstrous-mouth']);
    const rng = scriptedRng([0.99, 0.01]);
    const { result, rerolled } = performCatchRollWithSkill(catcher, rng, 0);
    expect(rerolled).toBe(false);
    expect(result.success).toBe(true);
  });

  it('ne relance pas sans le skill', () => {
    const catcher = makeCatcher([]);
    const rng = scriptedRng([0.01, 0.99]);
    const { result, rerolled } = performCatchRollWithSkill(catcher, rng, 0);
    expect(rerolled).toBe(false);
    expect(result.success).toBe(false);
  });

  it('catch + monstrous-mouth : une seule relance (pas deux)', () => {
    const catcher = makeCatcher(['catch', 'monstrous-mouth']);
    // Echec, echec, un troisieme jet reussi ne doit pas etre consomme.
    const rng = scriptedRng([0.01, 0.01, 0.99]);
    const { result, rerolled } = performCatchRollWithSkill(catcher, rng, 0);
    expect(rerolled).toBe(true);
    expect(result.success).toBe(false);
  });
});
