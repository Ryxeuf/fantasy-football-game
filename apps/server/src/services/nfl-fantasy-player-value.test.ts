import { describe, expect, it } from "vitest";

import {
  computeDynamicValue,
  computeValueDelta,
} from "./nfl-fantasy-player-value";

describe("computeDynamicValue", () => {
  it("retourne 50 pour un rookie (0 weeks jouees)", () => {
    expect(
      computeDynamicValue({ seasonSpp: 0, recentSpp: 0, weeksPlayed: 0 }),
    ).toBe(50);
  });

  it("plancher 50 TV pour un joueur a 0 SPP", () => {
    expect(
      computeDynamicValue({ seasonSpp: 0, recentSpp: 0, weeksPlayed: 5 }),
    ).toBe(50);
  });

  it("valorise un joueur regulier (mid-tier)", () => {
    // 100 SPP en 10 weeks = 10/week. Pas de forme particulière.
    // 0.6 * 10 * 17 + 0.4 * (40/4) * 17 = 102 + 68 = 170 SPP projete
    // * 5 = 850 TV
    const v = computeDynamicValue({
      seasonSpp: 100,
      recentSpp: 40,
      weeksPlayed: 10,
    });
    expect(v).toBeGreaterThan(700);
    expect(v).toBeLessThan(1000);
  });

  it("recompense la forme recente vs saison faible", () => {
    // Joueur saison faible (50 SPP en 10 weeks = 5/week) mais forme
    // recente forte (40 SPP en 4 weeks = 10/week)
    const cold = computeDynamicValue({
      seasonSpp: 50,
      recentSpp: 0,
      weeksPlayed: 10,
    });
    const hot = computeDynamicValue({
      seasonSpp: 50,
      recentSpp: 40,
      weeksPlayed: 10,
    });
    expect(hot).toBeGreaterThan(cold);
  });

  it("plafonne a 3000 TV pour les superstars", () => {
    const v = computeDynamicValue({
      seasonSpp: 500,
      recentSpp: 200,
      weeksPlayed: 10,
    });
    expect(v).toBe(3000);
  });

  it("deterministe", () => {
    const a = computeDynamicValue({
      seasonSpp: 75,
      recentSpp: 25,
      weeksPlayed: 8,
    });
    const b = computeDynamicValue({
      seasonSpp: 75,
      recentSpp: 25,
      weeksPlayed: 8,
    });
    expect(a).toBe(b);
  });
});

describe("computeValueDelta", () => {
  it("delta positif si hausse", () => {
    const { delta, deltaPct } = computeValueDelta(500, 750);
    expect(delta).toBe(250);
    expect(deltaPct).toBe(50);
  });

  it("delta negatif si baisse", () => {
    const { delta, deltaPct } = computeValueDelta(800, 600);
    expect(delta).toBe(-200);
    expect(deltaPct).toBe(-25);
  });

  it("delta nul si pas de variation", () => {
    const { delta, deltaPct } = computeValueDelta(500, 500);
    expect(delta).toBe(0);
    expect(deltaPct).toBe(0);
  });

  it("deltaPct = 0 si previous = 0 (protection division)", () => {
    const { delta, deltaPct } = computeValueDelta(0, 500);
    expect(delta).toBe(500);
    expect(deltaPct).toBe(0);
  });

  it("arrondit deltaPct a 1 decimale", () => {
    const { deltaPct } = computeValueDelta(300, 350);
    expect(deltaPct).toBeCloseTo(16.7, 1);
  });
});
