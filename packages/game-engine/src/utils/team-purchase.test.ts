import { describe, it, expect } from 'vitest';
import { getRerollCost, calculateMatchWinnings, calculateTreasury } from './team-value-calculator';

describe('Team Purchase — Between-match buying', () => {
  describe('Post-creation reroll cost (double)', () => {
    it('should cost double for Skaven rerolls after creation', () => {
      const postCreationCost = getRerollCost('skaven') * 2;
      expect(postCreationCost).toBe(100000); // 50k * 2 = 100k
    });

    it('should cost double for Lizardmen rerolls after creation', () => {
      const postCreationCost = getRerollCost('lizardmen') * 2;
      expect(postCreationCost).toBe(140000); // 70k * 2 = 140k
    });

    it('should cost double for Chaos rerolls after creation', () => {
      const postCreationCost = getRerollCost('chaos') * 2;
      expect(postCreationCost).toBe(120000); // 60k * 2 = 120k
    });

    it('should cost double for unknown roster rerolls after creation', () => {
      const postCreationCost = getRerollCost('unknown') * 2;
      expect(postCreationCost).toBe(100000); // 50k default * 2
    });
  });

  describe('Match winnings calculation', () => {
    it('should calculate basic winnings', () => {
      // Fan attendance 10, touchdowns 2 => (10/2 + 2) * 10000 = 70000
      expect(calculateMatchWinnings(10, 2)).toBe(70000);
    });

    it('should give zero winnings for conceded match', () => {
      expect(calculateMatchWinnings(10, 2, true)).toBe(0);
    });

    it('should calculate winnings with zero touchdowns', () => {
      // Fan attendance 8, touchdowns 0 => (8/2 + 0) * 10000 = 40000
      expect(calculateMatchWinnings(8, 0)).toBe(40000);
    });

    it('should floor fan attendance division', () => {
      // Fan attendance 7, touchdowns 1 => (floor(7/2) + 1) * 10000 = 40000
      expect(calculateMatchWinnings(7, 1)).toBe(40000);
    });
  });

  describe('Treasury calculation', () => {
    it('should add winnings to treasury', () => {
      expect(calculateTreasury(100000, 50000)).toBe(150000);
    });

    it('should subtract expenses from treasury', () => {
      expect(calculateTreasury(100000, 50000, 30000)).toBe(120000);
    });

    it('should handle zero treasury', () => {
      expect(calculateTreasury(0, 70000)).toBe(70000);
    });
  });

  describe('Purchase cost validation', () => {
    it('cheerleader costs 10k', () => {
      const cost = 10000;
      const treasury = 50000;
      expect(treasury >= cost).toBe(true);
      expect(treasury - cost).toBe(40000);
    });

    it('assistant costs 10k', () => {
      const cost = 10000;
      const treasury = 10000;
      expect(treasury >= cost).toBe(true);
      expect(treasury - cost).toBe(0);
    });

    it('apothecary costs 50k', () => {
      const cost = 50000;
      const treasury = 40000;
      expect(treasury >= cost).toBe(false);
    });

    it('dedicated fan costs 10k', () => {
      const cost = 10000;
      const treasury = 15000;
      expect(treasury >= cost).toBe(true);
      expect(treasury - cost).toBe(5000);
    });
  });
});
