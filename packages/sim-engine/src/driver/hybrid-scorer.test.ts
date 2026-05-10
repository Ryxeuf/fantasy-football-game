/**
 * Tests pour le pickHybridScorer (Lot 4.D.4).
 *
 * Couvre la fonction pure qui choisit un scorer pseudo-aleatoire
 * pondere par position parmi un roster, pour permettre au hybrid
 * driver d'attribuer un `scorerId` realiste sur les TD events.
 */

import { describe, expect, it } from 'vitest';

import {
  HYBRID_SCORER_POSITION_WEIGHTS,
  pickHybridScorer,
} from './hybrid-scorer';
import type { SimRosterPlayer } from '../types';

function player(
  overrides: Partial<SimRosterPlayer> = {},
): SimRosterPlayer {
  return {
    id: 'p',
    name: 'Player',
    number: 1,
    position: 'Lineman',
    ma: 6,
    st: 3,
    ag: 3,
    pa: 4,
    av: 9,
    ...overrides,
  };
}

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('HYBRID_SCORER_POSITION_WEIGHTS — Lot 4.D.4', () => {
  it('Catcher / Runner ont un poids superieur a Lineman', () => {
    expect(HYBRID_SCORER_POSITION_WEIGHTS.Catcher).toBeGreaterThan(
      HYBRID_SCORER_POSITION_WEIGHTS.Lineman,
    );
    expect(HYBRID_SCORER_POSITION_WEIGHTS.Runner).toBeGreaterThan(
      HYBRID_SCORER_POSITION_WEIGHTS.Lineman,
    );
  });

  it('Big Guy a un poids tres faible (rarement scorer)', () => {
    expect(HYBRID_SCORER_POSITION_WEIGHTS['Big Guy']).toBeLessThan(
      HYBRID_SCORER_POSITION_WEIGHTS.Lineman,
    );
  });

  it('Blitzer / Thrower / Skink presents (scorers credibles)', () => {
    expect(HYBRID_SCORER_POSITION_WEIGHTS.Blitzer).toBeGreaterThan(0);
    expect(HYBRID_SCORER_POSITION_WEIGHTS.Thrower).toBeGreaterThan(0);
    expect(HYBRID_SCORER_POSITION_WEIGHTS.Skink).toBeGreaterThan(0);
  });
});

describe('pickHybridScorer — Lot 4.D.4', () => {
  it('null sur roster vide', () => {
    expect(pickHybridScorer([], mulberry(1))).toBeNull();
  });

  it('retourne le seul joueur si le roster en contient un', () => {
    const roster = [player({ id: 'p1', position: 'Lineman' })];
    expect(pickHybridScorer(roster, mulberry(1))).toBe('p1');
  });

  it('deterministe pour un meme rng', () => {
    const roster = [
      player({ id: 'L1', position: 'Lineman' }),
      player({ id: 'C1', position: 'Catcher' }),
      player({ id: 'B1', position: 'Big Guy' }),
    ];
    const a = pickHybridScorer(roster, mulberry(42));
    const b = pickHybridScorer(roster, mulberry(42));
    expect(a).toBe(b);
  });

  it('biais par position : Catcher pris plus souvent que Big Guy sur 1000 runs', () => {
    const roster = [
      player({ id: 'cat', position: 'Catcher' }),
      player({ id: 'big', position: 'Big Guy' }),
    ];
    let catWins = 0;
    let bigWins = 0;
    for (let i = 0; i < 1000; i += 1) {
      const pick = pickHybridScorer(roster, mulberry(i));
      if (pick === 'cat') catWins += 1;
      else if (pick === 'big') bigWins += 1;
    }
    // Catcher (poids ~5) doit etre pris >= 4x plus souvent que Big Guy (~1).
    expect(catWins).toBeGreaterThan(bigWins * 3);
  });

  it('exclut les positions de poids 0 sauf si seules options', () => {
    // Position inconnue -> poids defaut. Tous les joueurs avec une
    // position connue (Catcher) devraient etre pris en priorite.
    const roster = [
      player({ id: 'cat', position: 'Catcher' }),
      player({ id: 'unknown', position: 'WeirdPosition' }),
    ];
    let catCount = 0;
    for (let i = 0; i < 200; i += 1) {
      if (pickHybridScorer(roster, mulberry(i)) === 'cat') catCount += 1;
    }
    // Catcher (poids ~5) >> WeirdPosition (poids defaut faible).
    expect(catCount).toBeGreaterThan(120);
  });

  it('positions inconnues fallback : roster ne contenant que des positions inconnues retourne quand meme un id', () => {
    const roster = [
      player({ id: 'a', position: 'Foo' }),
      player({ id: 'b', position: 'Bar' }),
    ];
    const pick = pickHybridScorer(roster, mulberry(1));
    expect(['a', 'b']).toContain(pick);
  });
});
