import { describe, it, expect } from 'vitest';
import {
  APOTHECARY_FORBIDDEN_ROSTERS,
  canRosterHaveApothecary,
} from './apothecary-access';

describe('apothecary-access', () => {
  describe('APOTHECARY_FORBIDDEN_ROSTERS', () => {
    it('contient exactement les 4 rosters mort-vivants canoniques', () => {
      expect([...APOTHECARY_FORBIDDEN_ROSTERS].sort()).toEqual([
        'necromantic_horror',
        'nurgle',
        'tomb_kings',
        'undead',
      ]);
    });
  });

  describe('canRosterHaveApothecary — équipes interdites (slugs canoniques)', () => {
    it.each([
      'necromantic_horror',
      'undead',
      'tomb_kings',
      'nurgle',
    ])('refuse %s', (slug) => {
      expect(canRosterHaveApothecary(slug)).toBe(false);
    });
  });

  describe('canRosterHaveApothecary — alias legacy', () => {
    it.each([
      ['necromantic', 'necromantic_horror'],
      ['tombkings', 'tomb_kings'],
    ] as const)('résout %s vers %s puis refuse', (legacy) => {
      expect(canRosterHaveApothecary(legacy)).toBe(false);
    });
  });

  describe('canRosterHaveApothecary — équipes autorisées', () => {
    it.each([
      'human',
      'vampire',
      'orc',
      'skaven',
      'lizardmen',
    ])('autorise %s', (slug) => {
      expect(canRosterHaveApothecary(slug)).toBe(true);
    });

    it('autorise un roster inconnu (fail-open hors mort-vivant)', () => {
      expect(canRosterHaveApothecary('unknown_roster')).toBe(true);
    });
  });
});
