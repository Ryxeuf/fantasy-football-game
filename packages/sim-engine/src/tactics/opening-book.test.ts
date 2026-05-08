/**
 * Tests pour `opening-book.ts` (Lot 3.A.0.c).
 */

import { describe, expect, it } from 'vitest';

import {
  RACE_OPENING_BOOKS,
  getOpeningBookForRace,
  openingBookBonus,
  openingBookBonusForRace,
} from './opening-book';

describe('opening book — Lot 3.A.0.c', () => {
  it('expose un book pour chaque race Pro League majeure', () => {
    const races = RACE_OPENING_BOOKS.map((b) => b.race);
    // 14 races déclarées au minimum (toutes les Pro League teams).
    expect(races.length).toBeGreaterThanOrEqual(14);
    expect(races).toContain('Wood Elf');
    expect(races).toContain('Orc');
    expect(races).toContain('Halfling');
    expect(races).toContain('Skaven');
    expect(races).toContain('Dwarf');
  });

  it('getOpeningBookForRace retourne un book existant ou undefined', () => {
    const wood = getOpeningBookForRace('Wood Elf');
    expect(wood).toBeDefined();
    expect(wood?.race).toBe('Wood Elf');

    const unknown = getOpeningBookForRace('Imaginary Race');
    expect(unknown).toBeUndefined();
  });

  it('openingBookBonus retourne 0 quand book est undefined', () => {
    expect(openingBookBonus(undefined, 1, 'PASS')).toBe(0);
    expect(openingBookBonus(undefined, 5, 'BLOCK')).toBe(0);
  });

  it('Wood Elves ont un bonus PASS positif au tour 1-3', () => {
    const wood = getOpeningBookForRace('Wood Elf');
    expect(openingBookBonus(wood, 1, 'PASS')).toBeGreaterThan(0);
    expect(openingBookBonus(wood, 2, 'PASS')).toBeGreaterThan(0);
    expect(openingBookBonus(wood, 3, 'PASS')).toBeGreaterThan(0);
  });

  it('Wood Elves perdent leur bonus PASS au tour 5', () => {
    const wood = getOpeningBookForRace('Wood Elf');
    expect(openingBookBonus(wood, 5, 'PASS')).toBe(0);
  });

  it('Orcs ont un malus PASS au début (les Orcs ne lancent pas)', () => {
    expect(openingBookBonusForRace('Orc', 1, 'PASS')).toBeLessThan(0);
    expect(openingBookBonusForRace('Orc', 2, 'PASS')).toBeLessThan(0);
  });

  it('Orcs ont un bonus BLOCK au tour 1-5', () => {
    expect(openingBookBonusForRace('Orc', 1, 'BLOCK')).toBeGreaterThan(0);
    expect(openingBookBonusForRace('Orc', 5, 'BLOCK')).toBeGreaterThan(0);
    expect(openingBookBonusForRace('Orc', 7, 'BLOCK')).toBe(0);
  });

  it('Halflings ont un bonus négatif sur END_TURN (incite à jouer)', () => {
    expect(openingBookBonusForRace('Halfling', 1, 'END_TURN')).toBeLessThan(0);
    expect(openingBookBonusForRace('Halfling', 8, 'END_TURN')).toBeLessThan(0);
  });

  it('cumul de plusieurs règles applicables au même type de move', () => {
    // Skaven : turn 1, MOVE → règle [1,2] applicable → bonus > 0.
    expect(openingBookBonusForRace('Skaven', 1, 'MOVE')).toBeGreaterThan(0);
  });

  it('aucune règle ne match → 0 (pas de biais)', () => {
    expect(openingBookBonusForRace('Wood Elf', 1, 'FOUL')).toBe(0);
    expect(openingBookBonusForRace('Wood Elf', 8, 'PASS')).toBe(0);
  });

  it('toutes les règles ont un turnRange valide (start <= end, start >= 1)', () => {
    for (const book of RACE_OPENING_BOOKS) {
      for (const rule of book.rules) {
        expect(rule.turnRange[0]).toBeLessThanOrEqual(rule.turnRange[1]);
        expect(rule.turnRange[0]).toBeGreaterThanOrEqual(1);
        expect(rule.turnRange[1]).toBeLessThanOrEqual(8);
      }
    }
  });

  it('aucun bonus de plus de ±25 (anti-overwrite scoring)', () => {
    for (const book of RACE_OPENING_BOOKS) {
      for (const rule of book.rules) {
        expect(Math.abs(rule.bonus)).toBeLessThanOrEqual(25);
      }
    }
  });
});
