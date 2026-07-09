import { describe, it, expect } from "vitest";
import {
  EXPENSIVE_MISTAKES_THRESHOLD,
  expensiveMistakeBand,
  expensiveMistakeOutcome,
  possibleExpensiveMistakeOutcomes,
  expensiveMistakeLoss,
} from "./expensive-mistakes";

// FR16 — table officielle S2025 des Erreurs Coûteuses
// (référence interne : docs/regles-bb-2025/page-11.md).

describe("expensiveMistakeBand", () => {
  it("aucun jet sous 100 000 po", () => {
    expect(expensiveMistakeBand(0)).toBeNull();
    expect(expensiveMistakeBand(99_999)).toBeNull();
    expect(EXPENSIVE_MISTAKES_THRESHOLD).toBe(100_000);
  });

  it("tranches de 100k, plafonnées à 600k+", () => {
    expect(expensiveMistakeBand(100_000)).toBe(0);
    expect(expensiveMistakeBand(195_000)).toBe(0);
    expect(expensiveMistakeBand(200_000)).toBe(1);
    expect(expensiveMistakeBand(395_000)).toBe(2);
    expect(expensiveMistakeBand(499_000)).toBe(3);
    expect(expensiveMistakeBand(595_000)).toBe(4);
    expect(expensiveMistakeBand(600_000)).toBe(5);
    expect(expensiveMistakeBand(2_000_000)).toBe(5);
  });
});

describe("expensiveMistakeOutcome — coins du tableau officiel", () => {
  it("colonne 100-195k : Incident Mineur seulement sur 1", () => {
    expect(expensiveMistakeOutcome(150_000, 1)).toBe("minor_incident");
    for (const d6 of [2, 3, 4, 5, 6]) {
      expect(expensiveMistakeOutcome(150_000, d6)).toBe("crisis_averted");
    }
  });

  it("colonne 600k+ : Catastrophe sur 1-2, rien de pire qu'un Incident Mineur sur 6", () => {
    expect(expensiveMistakeOutcome(700_000, 1)).toBe("catastrophe");
    expect(expensiveMistakeOutcome(700_000, 2)).toBe("catastrophe");
    expect(expensiveMistakeOutcome(700_000, 3)).toBe("major_incident");
    expect(expensiveMistakeOutcome(700_000, 6)).toBe("minor_incident");
  });

  it("colonne 500-595k : Catastrophe sur 2, Crise Évitée sur 6", () => {
    expect(expensiveMistakeOutcome(550_000, 2)).toBe("catastrophe");
    expect(expensiveMistakeOutcome(550_000, 5)).toBe("minor_incident");
    expect(expensiveMistakeOutcome(550_000, 6)).toBe("crisis_averted");
  });

  it("null sous le seuil, D6 invalide rejeté", () => {
    expect(expensiveMistakeOutcome(50_000, 1)).toBeNull();
    expect(() => expensiveMistakeOutcome(150_000, 0)).toThrow();
    expect(() => expensiveMistakeOutcome(150_000, 7)).toThrow();
  });
});

describe("possibleExpensiveMistakeOutcomes", () => {
  it("liste dédupliquée du plus clément au plus grave", () => {
    expect(possibleExpensiveMistakeOutcomes(50_000)).toEqual([]);
    expect(possibleExpensiveMistakeOutcomes(150_000)).toEqual([
      "crisis_averted",
      "minor_incident",
    ]);
    expect(possibleExpensiveMistakeOutcomes(450_000)).toEqual([
      "crisis_averted",
      "minor_incident",
      "major_incident",
    ]);
    expect(possibleExpensiveMistakeOutcomes(650_000)).toEqual([
      "minor_incident",
      "major_incident",
      "catastrophe",
    ]);
  });
});

describe("expensiveMistakeLoss", () => {
  it("Crise Évitée : aucune perte", () => {
    expect(expensiveMistakeLoss(300_000, "crisis_averted")).toBe(0);
  });

  it("Incident Mineur : D3 × 10 000, plafonné à la trésorerie", () => {
    expect(expensiveMistakeLoss(300_000, "minor_incident", { d3: 2 })).toBe(
      20_000,
    );
    expect(() => expensiveMistakeLoss(300_000, "minor_incident")).toThrow();
    expect(() =>
      expensiveMistakeLoss(300_000, "minor_incident", { d3: 4 }),
    ).toThrow();
  });

  it("Incident Majeur : moitié restante arrondie aux 5 000 inférieurs", () => {
    // 450 000 / 2 = 225 000 → reste 225 000 → perte 225 000.
    expect(expensiveMistakeLoss(450_000, "major_incident")).toBe(225_000);
    // 415 000 / 2 = 207 500 → reste arrondi 205 000 → perte 210 000.
    expect(expensiveMistakeLoss(415_000, "major_incident")).toBe(210_000);
  });

  it("Catastrophe : tout part sauf 2D6 × 10 000", () => {
    expect(expensiveMistakeLoss(700_000, "catastrophe", { twoD6: 7 })).toBe(
      630_000,
    );
    // On ne « gagne » jamais : garde plafonnée à la trésorerie.
    expect(expensiveMistakeLoss(110_000, "catastrophe", { twoD6: 12 })).toBe(
      0,
    );
    expect(() => expensiveMistakeLoss(700_000, "catastrophe")).toThrow();
  });
});
