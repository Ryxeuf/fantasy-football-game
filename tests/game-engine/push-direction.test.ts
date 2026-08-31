import { describe, it, expect } from "vitest";
import { getPushDirections, getPushDirection } from "@bb/game-engine";

/**
 * Règle BB : une poussée éloigne la cible de l'attaquant. Le vecteur va donc
 * de l'ATTAQUANT VERS LA CIBLE, et le moteur l'ajoute à la position de la
 * cible (`target.pos + dir`, cf. `blocking.ts`).
 *
 * Ces tests attendaient les vecteurs INVERSÉS — la cible revenait sur
 * l'attaquant. Le commentaire « opposée à l'attaquant » désigne la case
 * située à l'opposé DE l'attaquant, pas le vecteur opposé.
 */
describe("Directions de poussée", () => {
  describe("getPushDirection", () => {
    it("devrait calculer la direction directe", () => {
      const attacker = { x: 5, y: 5 };
      const target = { x: 6, y: 5 };

      const direction = getPushDirection(attacker, target);
      expect(direction).toEqual({ x: 1, y: 0 });
    });

    it("devrait calculer la direction diagonale", () => {
      const attacker = { x: 5, y: 5 };
      const target = { x: 6, y: 6 };

      const direction = getPushDirection(attacker, target);
      expect(direction).toEqual({ x: 1, y: 1 });
    });
  });

  describe("getPushDirections", () => {
    it("devrait retourner 3 directions pour un blocage horizontal", () => {
      const attacker = { x: 5, y: 5 };
      const target = { x: 6, y: 5 };

      const directions = getPushDirections(attacker, target);
      expect(directions).toHaveLength(3);

      // Case directement à l'opposé de l'attaquant : la cible s'éloigne.
      expect(directions[0]).toEqual({ x: 1, y: 0 });

      // Directions à 45° (diagonales)
      expect(directions[1]).toEqual({ x: 1, y: 1 });
      expect(directions[2]).toEqual({ x: 1, y: -1 });
    });

    it("devrait retourner 3 directions pour un blocage vertical", () => {
      const attacker = { x: 5, y: 5 };
      const target = { x: 5, y: 6 };

      const directions = getPushDirections(attacker, target);
      expect(directions).toHaveLength(3);

      // Case directement à l'opposé de l'attaquant : la cible s'éloigne.
      expect(directions[0]).toEqual({ x: 0, y: 1 });

      // Directions à 45° (diagonales)
      expect(directions[1]).toEqual({ x: 1, y: 1 });
      expect(directions[2]).toEqual({ x: -1, y: 1 });
    });

    it("devrait retourner 3 directions pour un blocage diagonal", () => {
      const attacker = { x: 5, y: 5 };
      const target = { x: 6, y: 6 };

      const directions = getPushDirections(attacker, target);
      expect(directions).toHaveLength(3);

      // Case directement à l'opposé de l'attaquant : la cible s'éloigne.
      expect(directions[0]).toEqual({ x: 1, y: 1 });

      // Directions à 45° (cardinales)
      expect(directions[1]).toEqual({ x: 1, y: 0 });
      expect(directions[2]).toEqual({ x: 0, y: 1 });
    });

    it("devrait gérer les directions négatives", () => {
      const attacker = { x: 5, y: 5 };
      const target = { x: 4, y: 5 };

      const directions = getPushDirections(attacker, target);
      expect(directions).toHaveLength(3);

      // Case directement à l'opposé de l'attaquant : la cible s'éloigne.
      expect(directions[0]).toEqual({ x: -1, y: 0 });

      // Directions à 45° (diagonales)
      expect(directions[1]).toEqual({ x: -1, y: 1 });
      expect(directions[2]).toEqual({ x: -1, y: -1 });
    });

    // Garde-fou de sens : appliquée à la cible, chaque direction doit
    // l'ÉLOIGNER de l'attaquant (distance de Tchebychev qui augmente).
    it("éloigne toujours la cible de l'attaquant", () => {
      const attacker = { x: 5, y: 5 };
      for (const target of [
        { x: 6, y: 5 },
        { x: 4, y: 5 },
        { x: 5, y: 6 },
        { x: 5, y: 4 },
        { x: 6, y: 6 },
        { x: 4, y: 4 },
      ]) {
        const before = Math.max(
          Math.abs(target.x - attacker.x),
          Math.abs(target.y - attacker.y),
        );
        for (const dir of getPushDirections(attacker, target)) {
          const after = Math.max(
            Math.abs(target.x + dir.x - attacker.x),
            Math.abs(target.y + dir.y - attacker.y),
          );
          expect(
            after,
            `poussée ${JSON.stringify(dir)} depuis ${JSON.stringify(target)}`,
          ).toBeGreaterThanOrEqual(before);
        }
      }
    });
  });
});
