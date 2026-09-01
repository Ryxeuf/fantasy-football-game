/**
 * Le Dé de Blocage : six faces, cinq icônes, `Repoussé` en double.
 * `BLOCK_DIE_FACES` est la source unique — moteur, resolver sim-engine,
 * `@bb/ui` et le simulateur de la page d'accueil en dépendent.
 */

import { describe, expect, it } from 'vitest';
import {
  BLOCK_DIE_FACES,
  BLOCK_DIE_FACE_INFO,
  blockResultDescriptionFr,
  blockResultNameEn,
  blockResultNameFr,
} from './block-dice-faces';
import { blockResultFromRoll, rollBlockDice } from '../utils/dice';
import type { BlockResult, RNG } from '../core/types';

describe('table des faces du dé de blocage', () => {
  it('compte six faces', () => {
    expect(BLOCK_DIE_FACES).toHaveLength(6);
  });

  it('porte deux Repoussé et une seule face pour les quatre autres', () => {
    const counts = BLOCK_DIE_FACES.reduce<Record<string, number>>((acc, f) => {
      acc[f] = (acc[f] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts).toEqual({
      PLAYER_DOWN: 1,
      BOTH_DOWN: 1,
      PUSH_BACK: 2,
      STUMBLE: 1,
      POW: 1,
    });
  });

  it('déclare le même nombre de faces dans `BLOCK_DIE_FACE_INFO`', () => {
    for (const info of Object.values(BLOCK_DIE_FACE_INFO)) {
      const actual = BLOCK_DIE_FACES.filter((f) => f === info.result).length;
      expect(info.faces, info.nameFr).toBe(actual);
    }
    const total = Object.values(BLOCK_DIE_FACE_INFO).reduce((s, f) => s + f.faces, 0);
    expect(total).toBe(6);
  });

  it('porte les noms du livre', () => {
    expect(blockResultNameFr('PLAYER_DOWN')).toBe('Attaquant Plaqué');
    expect(blockResultNameFr('BOTH_DOWN')).toBe('Les Deux Plaqués');
    expect(blockResultNameFr('PUSH_BACK')).toBe('Repoussé');
    expect(blockResultNameFr('STUMBLE')).toBe('Bousculé');
    expect(blockResultNameFr('POW')).toBe('Défenseur Plaqué');

    expect(blockResultNameEn('PLAYER_DOWN')).toBe('Attacker Down');
    expect(blockResultNameEn('POW')).toBe('Defender Down');
  });

  it('décrit chaque résultat sans laisser de texte vide', () => {
    for (const info of Object.values(BLOCK_DIE_FACE_INFO)) {
      expect(info.effectFr.length, info.nameFr).toBeGreaterThan(40);
      expect(info.effectEn.length, info.nameEn).toBeGreaterThan(40);
    }
    expect(blockResultDescriptionFr('POW')).toMatch(/^Défenseur Plaqué — /);
  });
});

describe('blockResultFromRoll', () => {
  it('associe chaque valeur du D6 à la face correspondante', () => {
    for (let roll = 1; roll <= 6; roll += 1) {
      expect(blockResultFromRoll(roll), `D6 = ${roll}`).toBe(BLOCK_DIE_FACES[roll - 1]);
    }
  });

  it('retombe sur Repoussé hors de 1-6 (défensif)', () => {
    expect(blockResultFromRoll(0)).toBe('PUSH_BACK');
    expect(blockResultFromRoll(7)).toBe('PUSH_BACK');
  });
});

describe('rollBlockDice', () => {
  it('reproduit la distribution 1/1/2/1/1 sur les six valeurs du D6', () => {
    const counts: Record<string, number> = {};
    for (let roll = 1; roll <= 6; roll += 1) {
      // RNG qui force exactement cette face : Math.floor(rng() * 6) + 1.
      const rng: RNG = () => (roll - 1) / 6;
      const result: BlockResult = rollBlockDice(rng);
      counts[result] = (counts[result] ?? 0) + 1;
    }
    expect(counts).toEqual({
      PLAYER_DOWN: 1,
      BOTH_DOWN: 1,
      PUSH_BACK: 2,
      STUMBLE: 1,
      POW: 1,
    });
  });
});
