import { describe, it, expect } from "vitest";
import { getPushDirections } from "@bb/game-engine";

/**
 * Règle BB : la poussée ÉLOIGNE le défenseur de l'attaquant, sur les trois
 * cases situées à l'opposé de celui-ci.
 *
 * Ces tests décrivaient les directions par la position de l'ATTAQUANT (« au
 * nord » ⇒ poussée vers le nord) et attendaient donc les vecteurs inversés :
 * le défenseur revenait sur son attaquant. On nomme désormais les cases
 * d'ARRIVÉE du défenseur, ce que le vecteur désigne réellement.
 *
 * Repère : y croît vers le SUD.
 */
describe("Règles de poussée Blood Bowl", () => {
  describe("Directions de poussée selon la position relative", () => {
    it("attaquant au nord du défenseur : poussée vers le sud", () => {
      const attacker = { x: 5, y: 4 }; // Nord du défenseur
      const target = { x: 5, y: 5 };

      const directions = getPushDirections(attacker, target);
      expect(directions).toHaveLength(3);

      expect(directions).toContainEqual({ x: 0, y: 1 }); // Sud
      expect(directions).toContainEqual({ x: 1, y: 1 }); // Sud-Est
      expect(directions).toContainEqual({ x: -1, y: 1 }); // Sud-Ouest
    });

    it("attaquant au sud du défenseur : poussée vers le nord", () => {
      const attacker = { x: 5, y: 6 }; // Sud du défenseur
      const target = { x: 5, y: 5 };

      const directions = getPushDirections(attacker, target);
      expect(directions).toHaveLength(3);

      expect(directions).toContainEqual({ x: 0, y: -1 }); // Nord
      expect(directions).toContainEqual({ x: 1, y: -1 }); // Nord-Est
      expect(directions).toContainEqual({ x: -1, y: -1 }); // Nord-Ouest
    });

    it("attaquant à l'est du défenseur : poussée vers l'ouest", () => {
      const attacker = { x: 6, y: 5 }; // Est du défenseur
      const target = { x: 5, y: 5 };

      const directions = getPushDirections(attacker, target);
      expect(directions).toHaveLength(3);

      expect(directions).toContainEqual({ x: -1, y: 0 }); // Ouest
      expect(directions).toContainEqual({ x: -1, y: -1 }); // Nord-Ouest
      expect(directions).toContainEqual({ x: -1, y: 1 }); // Sud-Ouest
    });

    it("attaquant à l'ouest du défenseur : poussée vers l'est", () => {
      const attacker = { x: 4, y: 5 }; // Ouest du défenseur
      const target = { x: 5, y: 5 };

      const directions = getPushDirections(attacker, target);
      expect(directions).toHaveLength(3);

      expect(directions).toContainEqual({ x: 1, y: 0 }); // Est
      expect(directions).toContainEqual({ x: 1, y: -1 }); // Nord-Est
      expect(directions).toContainEqual({ x: 1, y: 1 }); // Sud-Est
    });

    it("attaquant au nord-est du défenseur : poussée vers le sud-ouest", () => {
      const attacker = { x: 6, y: 4 }; // Nord-Est du défenseur
      const target = { x: 5, y: 5 };

      const directions = getPushDirections(attacker, target);
      expect(directions).toHaveLength(3);

      expect(directions).toContainEqual({ x: -1, y: 1 }); // Sud-Ouest
      expect(directions).toContainEqual({ x: -1, y: 0 }); // Ouest
      expect(directions).toContainEqual({ x: 0, y: 1 }); // Sud
    });

    it("attaquant au sud-ouest du défenseur : poussée vers le nord-est", () => {
      const attacker = { x: 4, y: 6 }; // Sud-Ouest du défenseur
      const target = { x: 5, y: 5 };

      const directions = getPushDirections(attacker, target);
      expect(directions).toHaveLength(3);

      expect(directions).toContainEqual({ x: 1, y: -1 }); // Nord-Est
      expect(directions).toContainEqual({ x: 1, y: 0 }); // Est
      expect(directions).toContainEqual({ x: 0, y: -1 }); // Nord
    });
  });
});
