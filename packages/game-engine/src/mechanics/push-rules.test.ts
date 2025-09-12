import { describe, it, expect } from 'vitest';
import { getPushDirections } from '../index';

describe('Règles de poussée Blood Bowl', () => {
  describe('Directions de poussée selon la position relative', () => {
    it("devrait donner les bonnes directions quand l'attaquant est au nord du défenseur", () => {
      // Attaquant au nord du défenseur
      const attacker = { x: 5, y: 4 }; // Nord
      const target = { x: 5, y: 5 };

      const directions = getPushDirections(attacker, target);
      expect(directions).toHaveLength(3);

      // Les directions possibles devraient être : Nord, Nord-Est, Nord-Ouest
      expect(directions).toContainEqual({ x: 0, y: -1 }); // Nord
      expect(directions).toContainEqual({ x: 1, y: -1 }); // Nord-Est
      expect(directions).toContainEqual({ x: -1, y: -1 }); // Nord-Ouest
    });

    it("devrait donner les bonnes directions quand l'attaquant est au sud du défenseur", () => {
      // Attaquant au sud du défenseur
      const attacker = { x: 5, y: 6 }; // Sud
      const target = { x: 5, y: 5 };

      const directions = getPushDirections(attacker, target);
      expect(directions).toHaveLength(3);

      // Les directions possibles devraient être : Sud, Sud-Est, Sud-Ouest
      expect(directions).toContainEqual({ x: 0, y: 1 }); // Sud
      expect(directions).toContainEqual({ x: 1, y: 1 }); // Sud-Est
      expect(directions).toContainEqual({ x: -1, y: 1 }); // Sud-Ouest
    });

    it("devrait donner les bonnes directions quand l'attaquant est à l'est du défenseur", () => {
      // Attaquant à l'est du défenseur
      const attacker = { x: 6, y: 5 }; // Est
      const target = { x: 5, y: 5 };

      const directions = getPushDirections(attacker, target);
      expect(directions).toHaveLength(3);

      // Les directions possibles devraient être : Est, Nord-Est, Sud-Est
      expect(directions).toContainEqual({ x: 1, y: 0 }); // Est
      expect(directions).toContainEqual({ x: 1, y: -1 }); // Nord-Est
      expect(directions).toContainEqual({ x: 1, y: 1 }); // Sud-Est
    });

    it("devrait donner les bonnes directions quand l'attaquant est à l'ouest du défenseur", () => {
      // Attaquant à l'ouest du défenseur
      const attacker = { x: 4, y: 5 }; // Ouest
      const target = { x: 5, y: 5 };

      const directions = getPushDirections(attacker, target);
      expect(directions).toHaveLength(3);

      // Les directions possibles devraient être : Ouest, Nord-Ouest, Sud-Ouest
      expect(directions).toContainEqual({ x: -1, y: 0 }); // Ouest
      expect(directions).toContainEqual({ x: -1, y: -1 }); // Nord-Ouest
      expect(directions).toContainEqual({ x: -1, y: 1 }); // Sud-Ouest
    });

    it("devrait donner les bonnes directions quand l'attaquant est au nord-est du défenseur", () => {
      // Attaquant au nord-est du défenseur
      const attacker = { x: 6, y: 4 }; // Nord-Est
      const target = { x: 5, y: 5 };

      const directions = getPushDirections(attacker, target);
      expect(directions).toHaveLength(3);

      // Les directions possibles devraient être : Nord-Est, Nord, Est
      expect(directions).toContainEqual({ x: 1, y: -1 }); // Nord-Est
      expect(directions).toContainEqual({ x: 0, y: -1 }); // Nord
      expect(directions).toContainEqual({ x: 1, y: 0 }); // Est
    });

    it("devrait donner les bonnes directions quand l'attaquant est au sud-ouest du défenseur", () => {
      // Attaquant au sud-ouest du défenseur
      const attacker = { x: 4, y: 6 }; // Sud-Ouest
      const target = { x: 5, y: 5 };

      const directions = getPushDirections(attacker, target);
      expect(directions).toHaveLength(3);

      // Les directions possibles devraient être : Sud-Ouest, Sud, Ouest
      expect(directions).toContainEqual({ x: -1, y: 1 }); // Sud-Ouest
      expect(directions).toContainEqual({ x: 0, y: 1 }); // Sud
      expect(directions).toContainEqual({ x: -1, y: 0 }); // Ouest
    });
  });
});
