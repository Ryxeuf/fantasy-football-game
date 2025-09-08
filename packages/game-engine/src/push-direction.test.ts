import { describe, it, expect } from 'vitest';
import { getPushDirections, getPushDirection } from './index';

describe('Directions de poussée', () => {
  describe('getPushDirection', () => {
    it('devrait calculer la direction directe', () => {
      const attacker = { x: 5, y: 5 };
      const target = { x: 6, y: 5 };
      
      const direction = getPushDirection(attacker, target);
      expect(direction).toEqual({ x: 1, y: 0 });
    });

    it('devrait calculer la direction diagonale', () => {
      const attacker = { x: 5, y: 5 };
      const target = { x: 6, y: 6 };
      
      const direction = getPushDirection(attacker, target);
      expect(direction).toEqual({ x: 1, y: 1 });
    });
  });

  describe('getPushDirections', () => {
    it('devrait retourner 3 directions pour un blocage horizontal', () => {
      const attacker = { x: 5, y: 5 };
      const target = { x: 6, y: 5 };
      
      const directions = getPushDirections(attacker, target);
      expect(directions).toHaveLength(3);
      
      // Direction directe
      expect(directions[0]).toEqual({ x: 1, y: 0 });
      
      // Directions à 45° (diagonales)
      expect(directions[1]).toEqual({ x: 1, y: 1 });
      expect(directions[2]).toEqual({ x: 1, y: -1 });
    });

    it('devrait retourner 3 directions pour un blocage vertical', () => {
      const attacker = { x: 5, y: 5 };
      const target = { x: 5, y: 6 };
      
      const directions = getPushDirections(attacker, target);
      expect(directions).toHaveLength(3);
      
      // Direction directe
      expect(directions[0]).toEqual({ x: 0, y: 1 });
      
      // Directions à 45° (diagonales)
      expect(directions[1]).toEqual({ x: 1, y: 1 });
      expect(directions[2]).toEqual({ x: -1, y: 1 });
    });

    it('devrait retourner 3 directions pour un blocage diagonal', () => {
      const attacker = { x: 5, y: 5 };
      const target = { x: 6, y: 6 };
      
      const directions = getPushDirections(attacker, target);
      expect(directions).toHaveLength(3);
      
      // Direction directe
      expect(directions[0]).toEqual({ x: 1, y: 1 });
      
      // Directions à 45° (cardinales)
      expect(directions[1]).toEqual({ x: 1, y: 0 });
      expect(directions[2]).toEqual({ x: 0, y: 1 });
    });

    it('devrait gérer les directions négatives', () => {
      const attacker = { x: 5, y: 5 };
      const target = { x: 4, y: 5 };
      
      const directions = getPushDirections(attacker, target);
      expect(directions).toHaveLength(3);
      
      // Direction directe
      expect(directions[0]).toEqual({ x: -1, y: 0 });
      
      // Directions à 45° (diagonales)
      expect(directions[1]).toEqual({ x: -1, y: 1 });
      expect(directions[2]).toEqual({ x: -1, y: -1 });
    });
  });
});
