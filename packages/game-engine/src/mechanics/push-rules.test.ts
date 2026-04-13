import { describe, it, expect } from 'vitest';
import { getPushDirections } from '../index';

describe('Règles de poussée Blood Bowl', () => {
  describe('Directions de poussée selon la position relative', () => {
    it("devrait pousser vers le sud quand l'attaquant est au nord du défenseur", () => {
      // Attaquant au nord (y=4), défenseur au sud (y=5)
      // Poussée = loin de l'attaquant = vers le sud
      const attacker = { x: 5, y: 4 };
      const target = { x: 5, y: 5 };

      const directions = getPushDirections(attacker, target);
      expect(directions).toHaveLength(3);

      expect(directions).toContainEqual({ x: 0, y: 1 }); // Sud
      expect(directions).toContainEqual({ x: 1, y: 1 }); // Sud-Est
      expect(directions).toContainEqual({ x: -1, y: 1 }); // Sud-Ouest
    });

    it("devrait pousser vers le nord quand l'attaquant est au sud du défenseur", () => {
      // Attaquant au sud (y=6), défenseur au nord (y=5)
      // Poussée = loin de l'attaquant = vers le nord
      const attacker = { x: 5, y: 6 };
      const target = { x: 5, y: 5 };

      const directions = getPushDirections(attacker, target);
      expect(directions).toHaveLength(3);

      expect(directions).toContainEqual({ x: 0, y: -1 }); // Nord
      expect(directions).toContainEqual({ x: 1, y: -1 }); // Nord-Est
      expect(directions).toContainEqual({ x: -1, y: -1 }); // Nord-Ouest
    });

    it("devrait pousser vers l'ouest quand l'attaquant est à l'est du défenseur", () => {
      // Attaquant à l'est (x=6), défenseur à l'ouest (x=5)
      // Poussée = loin de l'attaquant = vers l'ouest
      const attacker = { x: 6, y: 5 };
      const target = { x: 5, y: 5 };

      const directions = getPushDirections(attacker, target);
      expect(directions).toHaveLength(3);

      expect(directions).toContainEqual({ x: -1, y: 0 }); // Ouest
      expect(directions).toContainEqual({ x: -1, y: -1 }); // Nord-Ouest
      expect(directions).toContainEqual({ x: -1, y: 1 }); // Sud-Ouest
    });

    it("devrait pousser vers l'est quand l'attaquant est à l'ouest du défenseur", () => {
      // Attaquant à l'ouest (x=4), défenseur à l'est (x=5)
      // Poussée = loin de l'attaquant = vers l'est
      const attacker = { x: 4, y: 5 };
      const target = { x: 5, y: 5 };

      const directions = getPushDirections(attacker, target);
      expect(directions).toHaveLength(3);

      expect(directions).toContainEqual({ x: 1, y: 0 }); // Est
      expect(directions).toContainEqual({ x: 1, y: -1 }); // Nord-Est
      expect(directions).toContainEqual({ x: 1, y: 1 }); // Sud-Est
    });

    it("devrait pousser vers le sud-ouest quand l'attaquant est au nord-est du défenseur", () => {
      // Attaquant au nord-est (x=6, y=4), défenseur (x=5, y=5)
      // Poussée = loin de l'attaquant = vers le sud-ouest
      const attacker = { x: 6, y: 4 };
      const target = { x: 5, y: 5 };

      const directions = getPushDirections(attacker, target);
      expect(directions).toHaveLength(3);

      expect(directions).toContainEqual({ x: -1, y: 1 }); // Sud-Ouest
      expect(directions).toContainEqual({ x: 0, y: 1 }); // Sud
      expect(directions).toContainEqual({ x: -1, y: 0 }); // Ouest
    });

    it("devrait pousser vers le nord-est quand l'attaquant est au sud-ouest du défenseur", () => {
      // Attaquant au sud-ouest (x=4, y=6), défenseur (x=5, y=5)
      // Poussée = loin de l'attaquant = vers le nord-est
      const attacker = { x: 4, y: 6 };
      const target = { x: 5, y: 5 };

      const directions = getPushDirections(attacker, target);
      expect(directions).toHaveLength(3);

      expect(directions).toContainEqual({ x: 1, y: -1 }); // Nord-Est
      expect(directions).toContainEqual({ x: 0, y: -1 }); // Nord
      expect(directions).toContainEqual({ x: 1, y: 0 }); // Est
    });
  });
});
