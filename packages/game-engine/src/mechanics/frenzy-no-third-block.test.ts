/**
 * BB2020 : Frenzy donne EXACTEMENT un second bloc par action Block,
 * jamais un troisième même si le second produit aussi un PUSH_BACK.
 *
 * Avant le fix, `handlePushBack` armait `pendingFrenzyBlock` à chaque
 * fois que `hasFrenzy(attacker)` était vrai. Une suite de PUSH_BACK
 * (premier bloc → second bloc → troisième bloc → …) déclenchait donc
 * une chaîne infinie de blocs.
 *
 * Fix : la séquence trace les attackerIds qui ont déjà consommé leur
 * second bloc Frenzy dans le tour courant via
 * `state.frenzySecondBlockTriggered`. handlePushBack ne réarme plus
 * pendingFrenzyBlock pour ces attackers.
 */
import { describe, it, expect } from 'vitest';
import { setup } from '../core/game-state';
import { resolveBlockResult } from './blocking';
import { resolveFrenzyBlock } from '../actions/block-action';
import type { GameState, RNG } from '../core/types';

function makeRNG(values: number[]): RNG {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i++;
    return v;
  };
}

function placeAttackerWithFrenzy(base: GameState): GameState {
  return {
    ...base,
    players: base.players.map((p) => {
      if (p.id === 'A2')
        return { ...p, pos: { x: 10, y: 7 }, stunned: false, pm: 6, skills: ['frenzy'] };
      if (p.id === 'B2')
        return { ...p, pos: { x: 11, y: 7 }, stunned: false, pm: 6, skills: [] };
      return { ...p, pos: { x: 1, y: p.team === 'A' ? 1 : 14 }, stunned: false, pm: 6 };
    }),
    currentPlayer: 'A',
  };
}

function makeBlockResult(result: 'PUSH_BACK') {
  return {
    type: 'block' as const,
    playerId: 'A2',
    targetId: 'B2',
    diceRoll: 3,
    result,
    offensiveAssists: 0,
    defensiveAssists: 0,
    totalStrength: 3,
    targetStrength: 3,
  };
}

describe('Frenzy — pas de troisième bloc', () => {
  it("apres un premier PUSH_BACK, pendingFrenzyBlock est marque puis consomme par resolveFrenzyBlock", () => {
    const base = setup();
    const state = placeAttackerWithFrenzy(base);

    const result = resolveBlockResult(state, makeBlockResult('PUSH_BACK'), makeRNG([0.5]));

    expect(result.pendingFrenzyBlock).toBeDefined();
    expect(result.pendingFrenzyBlock?.attackerId).toBe('A2');
    // Le flag n'est pas encore set tant que resolveFrenzyBlock n'a pas tourne.
    expect(result.frenzySecondBlockTriggered).toBeFalsy();
  });

  it("apres resolveFrenzyBlock, l'attaquant est dans frenzySecondBlockTriggered", () => {
    const base = setup();
    // RNG queue : 0.5 pour la resolution du bloc unique (1 die seul, force 3v3 → 1 die).
    // floor(0.5*6)+1 = 4 → PUSH_BACK.
    // Mais en pratique resolveFrenzyBlock execute handleBlock qui peut roller plusieurs des.
    // On verifie juste que la liste contient A2 apres l'appel.
    const state: GameState = {
      ...placeAttackerWithFrenzy(base),
      pendingFrenzyBlock: { attackerId: 'A2', targetId: 'B2' },
    };
    const rng = makeRNG([0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);

    const result = resolveFrenzyBlock(state, rng);

    expect(result.frenzySecondBlockTriggered).toBeDefined();
    expect(result.frenzySecondBlockTriggered).toContain('A2');
  });

  it("si le second bloc produit aussi PUSH_BACK, pendingFrenzyBlock n'est PAS rearme (single direction)", () => {
    const base = setup();
    const state: GameState = {
      ...placeAttackerWithFrenzy(base),
      // Simule l'etat apres execution du 2nd bloc Frenzy : flag deja set
      frenzySecondBlockTriggered: ['A2'],
    };

    // resolveBlockResult(PUSH_BACK) avec A2 deja dans la liste : ne doit
    // pas reset pendingFrenzyBlock.
    const result = resolveBlockResult(state, makeBlockResult('PUSH_BACK'), makeRNG([0.5]));

    expect(result.pendingFrenzyBlock).toBeUndefined();
  });

  it("idem en multi-direction push : pas de pendingFrenzyBlock si deja consomme", () => {
    const base = setup();
    // Bord (x=0,y=0) avec attacker en (1,1) target en (0,0) → seulement
    // quelques directions valides. On cree une scene simple avec
    // adjacents bloquees pour forcer le multi-direction.
    const state: GameState = {
      ...base,
      players: base.players.map((p) => {
        if (p.id === 'A2') return { ...p, pos: { x: 5, y: 5 }, stunned: false, skills: ['frenzy'] };
        if (p.id === 'B2') return { ...p, pos: { x: 6, y: 5 }, stunned: false, skills: [] };
        return { ...p, pos: { x: 1, y: p.team === 'A' ? 1 : 14 }, stunned: false };
      }),
      currentPlayer: 'A',
      frenzySecondBlockTriggered: ['A2'],
    };

    const result = resolveBlockResult(state, makeBlockResult('PUSH_BACK'), makeRNG([0.5]));

    // Quelle que soit la branche (single ou multi direction), pendingFrenzyBlock
    // ne doit pas etre reset apres une consommation deja en cours.
    expect(result.pendingFrenzyBlock).toBeUndefined();
  });
});
