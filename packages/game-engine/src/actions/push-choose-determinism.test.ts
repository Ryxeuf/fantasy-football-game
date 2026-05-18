/**
 * BUG fixes :
 *  1. `handlePushChoose` utilisait `Math.random()` localement pour
 *     l'appel a `applyChainPush`. Les surfs en chaine (crowd injury
 *     rolls) etaient donc non-deterministes — replay seed -> result
 *     non rejouable. Fix : passer le RNG seede du dispatcher.
 *
 *  2. `apothecaryAvailable` etait boolean. Une equipe avec apothecary
 *     natif (Human, Dwarf) qui achetait Wandering Apothecary inducement
 *     ne pouvait pas en accumuler 2 — silent no-op. Fix : compteur.
 */
import { describe, it, expect } from 'vitest';
import { setup } from '../core/game-state';
import { applyMove } from './actions';
import type { GameState, Player, RNG, Move } from '../core/types';

function basePlayer(over: Partial<Player>): Player {
  return {
    id: 'X', team: 'A', pos: { x: 5, y: 5 }, name: 'X', number: 1,
    position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 7,
    skills: [], pm: 6, state: 'active',
    ...over,
  };
}

function makeRNG(values: number[]): RNG {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('Determinism — chain push surf utilise le RNG seede', () => {
  it("deux runs avec meme seed produisent le meme state (surf chain push)", () => {
    // Scenario : push chain au bord du terrain — surf B1 dans la foule,
    // ce qui declenche un crowd injury roll. Avant le fix, ce roll
    // utilisait Math.random() local → non-deterministe.
    const base = setup();
    const players: Player[] = [
      basePlayer({ id: 'A1', team: 'A', pos: { x: 5, y: 5 } }),
      basePlayer({ id: 'B1', team: 'B', pos: { x: 25, y: 5 } }), // au bord
    ];
    const state: GameState = {
      ...base,
      players,
      currentPlayer: 'A',
      pendingPushChoice: {
        attackerId: 'A1', targetId: 'B1',
        availableDirections: [{ x: 1, y: 0 }],
        blockResult: 'PUSH_BACK',
        offensiveAssists: 0, defensiveAssists: 0,
        totalStrength: 3, targetStrength: 3,
      },
    };
    const move: Move = {
      type: 'PUSH_CHOOSE', playerId: 'A1', targetId: 'B1',
      direction: { x: 1, y: 0 },
    };

    // Deux runs avec le meme RNG seede : doit produire le meme outcome.
    const rng1 = makeRNG([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
    const rng2 = makeRNG([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
    const result1 = applyMove(state, move, rng1);
    const result2 = applyMove(state, move, rng2);

    const b1Result1 = result1.players.find(p => p.id === 'B1');
    const b1Result2 = result2.players.find(p => p.id === 'B1');
    // Meme state.players (apres surf : meme pos, meme state).
    expect(b1Result1?.pos).toEqual(b1Result2?.pos);
    expect(b1Result1?.state).toEqual(b1Result2?.state);
  });
});

describe('Apothecary count — Wandering Apothecary cumule', () => {
  it("apothecaryAvailable est un compteur (type number)", () => {
    const state = setup();
    expect(typeof state.apothecaryAvailable.teamA).toBe('number');
    expect(state.apothecaryAvailable.teamA).toBe(0);
    expect(state.apothecaryAvailable.teamB).toBe(0);
  });
});
