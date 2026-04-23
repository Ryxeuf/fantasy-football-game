import { describe, it, expect } from 'vitest';
import { setup } from '../index';
import type { GameState, RNG, Player } from '../core/types';
import { executePass } from './passing';

/**
 * Regle : Safe Pass (Passe Assuree) — Blood Bowl 2020 / BB3
 *
 * "Si ce joueur echoue une action de Passe, le ballon n'est pas lache, ne rebondit
 *  pas depuis la case qu'occupe ce joueur, et aucun Renversement n'est cause. Au
 *  lieu de cela, ce joueur garde possession du ballon et son activation se termine."
 *
 * Notes d'implementation :
 *  - Uniquement sur echec du jet de Capacite de Passe (pas sur echec de reception,
 *    ni sur interception).
 *  - Le passeur conserve le ballon (hasBall = true).
 *  - Pas de turnover (isTurnover reste false).
 *  - Pas de rebond (state.ball reste undefined, car attache au passeur).
 */

function makeRNGFromValues(values: number[]): RNG {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i++;
    return v;
  };
}

function d6(value: number): number {
  return (value - 1) / 6 + 0.01;
}

function createSafePassState(skills: string[] = ['safe-pass']): GameState {
  const state = setup();
  // Passer A1 a (5,7), cible A2 a (8,7) (distance 3 = Quick).
  state.players = [
    {
      id: 'A1', team: 'A', pos: { x: 5, y: 7 }, name: 'Elf Thrower', number: 1,
      position: 'Thrower', ma: 6, st: 3, ag: 3, pa: 3, av: 8,
      skills,
      pm: 6, hasBall: true, state: 'active',
    },
    {
      id: 'A2', team: 'A', pos: { x: 8, y: 7 }, name: 'Elf Catcher', number: 2,
      position: 'Catcher', ma: 8, st: 2, ag: 3, pa: 4, av: 7, skills: [],
      pm: 8, hasBall: false, state: 'active',
    },
  ];
  state.ball = { x: 5, y: 7 };
  state.currentPlayer = 'A';
  state.playerActions = {};
  state.teamBlitzCount = {};
  state.teamFoulCount = {};
  state.teamRerolls = { teamA: 3, teamB: 3 };
  state.isTurnover = false;
  return state;
}

function getPlayer(state: GameState, id: string): Player {
  const p = state.players.find(pl => pl.id === id);
  if (!p) throw new Error(`Player ${id} not found`);
  return p;
}

describe('Regle: Safe Pass', () => {
  it('sur jet de passe rate, le passeur garde le ballon et aucun turnover', () => {
    const state = createSafePassState(['safe-pass']);
    const passer = getPlayer(state, 'A1');
    const target = getPlayer(state, 'A2');
    // pa=3, portee quick (+1) => targetNumber = 3-1 = 2. Roll 1 => echec.
    const rng = makeRNGFromValues([d6(1)]);

    const next = executePass(state, passer, target, rng);

    expect(getPlayer(next, 'A1').hasBall).toBe(true);
    expect(getPlayer(next, 'A2').hasBall).toBe(false);
    expect(next.isTurnover).toBe(false);
    expect(next.ball).toBeUndefined();

    const logText = next.gameLog.map(l => l.message).join('\n');
    expect(logText).toMatch(/Safe Pass|Passe Assur[eé]e/i);
  });

  it("sans le skill, une passe ratee provoque un turnover", () => {
    const state = createSafePassState([]);
    const passer = getPlayer(state, 'A1');
    const target = getPlayer(state, 'A2');
    const rng = makeRNGFromValues([d6(1), 0.001, 0.001]);

    const next = executePass(state, passer, target, rng);

    expect(getPlayer(next, 'A1').hasBall).toBe(false);
    expect(next.isTurnover).toBe(true);
  });

  it("sur passe reussie, le skill n'intervient pas (flux standard)", () => {
    const state = createSafePassState(['safe-pass']);
    const passer = getPlayer(state, 'A1');
    const target = getPlayer(state, 'A2');
    // pa=3, quick(+1) => target 2. Roll 6 => succes. Catch ag=3 => target 3. Roll 6 => succes.
    const rng = makeRNGFromValues([d6(6), d6(6)]);

    const next = executePass(state, passer, target, rng);

    expect(getPlayer(next, 'A1').hasBall).toBe(false);
    expect(getPlayer(next, 'A2').hasBall).toBe(true);
    expect(next.isTurnover).toBe(false);
  });
});
