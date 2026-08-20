import { describe, expect, it } from "vitest";
import {
  budgetHeadroom,
  playerCostRange,
  startingElevenCost,
} from "./roster-stats";

// Roster façon Amazon S3 : que des min à 0, une position bon marché large.
const AMAZON_LIKE = [
  { cost: 50, min: 0, max: 12 }, // Trois-Quarts
  { cost: 90, min: 0, max: 2 },
  { cost: 105, min: 0, max: 2 },
  { cost: 110, min: 0, max: 4 },
];

describe("playerCostRange", () => {
  it("donne la fourchette de coût unitaire", () => {
    expect(playerCostRange(AMAZON_LIKE)).toEqual({ min: 50, max: 110 });
  });

  it("renvoie null sans positions", () => {
    expect(playerCostRange([])).toBeNull();
  });
});

describe("startingElevenCost", () => {
  it("complète au poste le moins cher quand aucun minimum n'est imposé", () => {
    // 11 × 50k : tout au Trois-Quarts.
    expect(startingElevenCost(AMAZON_LIKE)).toBe(550);
  });

  it("paie d'abord les minimums obligatoires, puis complète au moins cher", () => {
    const roster = [
      { cost: 140, min: 2, max: 2 }, // 2 obligatoires à 140k
      { cost: 60, min: 0, max: 16 },
    ];
    // 2×140 + 9×60 = 280 + 540
    expect(startingElevenCost(roster)).toBe(820);
  });

  it("déborde sur le poste suivant quand le moins cher est plafonné", () => {
    const roster = [
      { cost: 40, min: 0, max: 6 },
      { cost: 70, min: 0, max: 16 },
    ];
    // 6×40 + 5×70 = 240 + 350
    expect(startingElevenCost(roster)).toBe(590);
  });

  it("compte les minimums déjà au-delà de onze", () => {
    const roster = [{ cost: 50, min: 12, max: 16 }];
    // 12 joueurs obligatoires : le onze de départ coûte les 12.
    expect(startingElevenCost(roster)).toBe(600);
  });

  it("renvoie null quand le roster ne peut pas aligner onze joueurs", () => {
    expect(startingElevenCost([{ cost: 50, min: 0, max: 10 }])).toBeNull();
    expect(startingElevenCost([])).toBeNull();
  });
});

describe("budgetHeadroom", () => {
  it("calcule la marge sur le budget standard de 1000k", () => {
    expect(budgetHeadroom(AMAZON_LIKE)).toBe(450);
  });

  it("ne descend jamais sous zéro", () => {
    const expensive = [{ cost: 200, min: 0, max: 16 }]; // 11×200 = 2200k
    expect(budgetHeadroom(expensive)).toBe(0);
  });

  it("propage l'impossibilité d'aligner onze joueurs", () => {
    expect(budgetHeadroom([])).toBeNull();
  });
});
