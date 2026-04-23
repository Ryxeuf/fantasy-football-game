import { describe, it, expect } from 'vitest';
import { setup } from '../index';
import type { GameState, RNG, Player } from '../core/types';
import { canAttemptPassForRange, getPassRange, executePass } from './passing';

/**
 * Regle : Hail Mary Pass (Passe Desesperee) — Blood Bowl 2020 / BB3
 *
 * "Quand ce joueur effectue une action de Passe, la case cible peut etre n'importe
 *  ou sur le terrain et la regle de portee n'a pas besoin d'etre utilisee. Une
 *  passe desesperee n'est jamais precise, peu importe le resultat du test de
 *  Capacite de Passe."
 *
 * Notes d'implementation :
 *  - Le passeur avec Hail Mary Pass peut cibler au-dela de la portee normale
 *    (plus de 13 cases, hors categorie quick/short/long/bomb).
 *  - Meme si le jet de Capacite de Passe reussit, la passe n'est jamais precise :
 *    le ballon rebondit depuis la case cible (pas de jet de reception direct).
 *  - Sur echec du jet de passe, comportement standard : turnover + rebond.
 *  - Les interceptions s'appliquent normalement.
 */

function makeRNGFromValues(values: number[]): RNG {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i++;
    return v;
  };
}

/** rollD6 = floor(rng() * 6) + 1. Pour obtenir V, renvoyer (V - 1)/6 + 0.01 */
function d6(value: number): number {
  return (value - 1) / 6 + 0.01;
}

/** getRandomDirection lit rng() puis multiplie par 8. Pour un index I (0..7), renvoyer I/8 + 0.001 */
function scatter(index: number): number {
  return index / 8 + 0.001;
}

function createHMPState(): GameState {
  const state = setup();
  // Passer A1 at (2,7) with hail-mary-pass. Target A2 very far at (24,7) (distance 22).
  state.players = [
    {
      id: 'A1', team: 'A', pos: { x: 2, y: 7 }, name: 'Orc Thrower', number: 1,
      position: 'Thrower', ma: 6, st: 3, ag: 3, pa: 4, av: 9,
      skills: ['hail-mary-pass'],
      pm: 6, hasBall: true, state: 'active',
    },
    {
      id: 'A2', team: 'A', pos: { x: 24, y: 7 }, name: 'Orc Catcher', number: 2,
      position: 'Catcher', ma: 7, st: 3, ag: 3, pa: 5, av: 8, skills: [],
      pm: 7, hasBall: false, state: 'active',
    },
    {
      id: 'B1', team: 'B', pos: { x: 20, y: 0 }, name: 'Defender', number: 1,
      position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [],
      pm: 6, hasBall: false, state: 'active',
    },
  ];
  state.ball = { x: 2, y: 7 };
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

describe('Regle: Hail Mary Pass', () => {
  it('autorise une passe au-dela de la portee Long Bomb (>13 cases)', () => {
    const state = createHMPState();
    const passer = getPlayer(state, 'A1');
    // Distance 22 : normalement hors de toute categorie (null).
    expect(getPassRange(passer.pos, getPlayer(state, 'A2').pos)).toBeNull();
    expect(canAttemptPassForRange(passer, null)).toBe(true);
  });

  it('refuse la passe ultra-longue pour un joueur sans le skill', () => {
    const state = createHMPState();
    const passer = { ...getPlayer(state, 'A1'), skills: [] };
    expect(canAttemptPassForRange(passer, null)).toBe(false);
  });

  it('sur jet de passe reussi, le ballon rebondit depuis la cible (jamais precise)', () => {
    const state = createHMPState();
    const passer = getPlayer(state, 'A1');
    const target = getPlayer(state, 'A2');
    // rng : [pass roll = 6] puis [scatter direction index 0]
    const rng = makeRNGFromValues([d6(6), scatter(0)]);

    const next = executePass(state, passer, target, rng);

    // Le passeur n'a plus le ballon
    expect(getPlayer(next, 'A1').hasBall).toBe(false);
    // La cible ne l'a pas recu (jamais precise = pas de catch direct)
    expect(getPlayer(next, 'A2').hasBall).toBe(false);
    // Le ballon est sur le terrain (positionne et rebondissant)
    expect(next.ball).toBeDefined();
    // Succes de passe : pas de turnover
    expect(next.isTurnover).toBe(false);
    // Log qui mentionne l'imprecision
    const logText = next.gameLog.map(l => l.message).join('\n');
    expect(logText).toMatch(/impr[eé]cis|Hail Mary|desesp[eé]r/i);
  });

  it('sur jet de passe rate, turnover standard', () => {
    const state = createHMPState();
    const passer = getPlayer(state, 'A1');
    const target = getPlayer(state, 'A2');
    // pa=4, aucune TZ => targetNumber=4, roll 1 => echec
    const rng = makeRNGFromValues([d6(1), scatter(0)]);

    const next = executePass(state, passer, target, rng);

    expect(getPlayer(next, 'A1').hasBall).toBe(false);
    expect(getPlayer(next, 'A2').hasBall).toBe(false);
    expect(next.isTurnover).toBe(true);
  });
});
