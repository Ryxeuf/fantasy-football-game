import { describe, it, expect } from "vitest";
import { SEASON_THREE_ROSTERS } from "./season3-rosters";
import {
  DEFAULT_REROLL_COST,
  REROLL_COSTS,
  getAllRerollCosts,
  getRerollCost,
  resolveRosterSlugForReroll,
} from "./reroll-costs";

describe("reroll-costs", () => {
  it("couvre tous les rosters Season 3 avec un coût explicite", () => {
    for (const slug of Object.keys(SEASON_THREE_ROSTERS)) {
      expect(REROLL_COSTS[slug], `missing reroll cost for ${slug}`).toBeDefined();
    }
  });

  describe("getRerollCost — slugs canoniques", () => {
    it.each([
      ["skaven", 50_000],
      ["lizardmen", 70_000],
      ["black_orc", 60_000],
      ["dark_elf", 50_000],
      ["chaos_chosen", 60_000],
      ["imperial_nobility", 70_000],
      ["slann", 70_000],
    ] as const)("returns %i for %s", (slug, cost) => {
      expect(getRerollCost(slug)).toBe(cost);
    });

    it("retourne le coût par défaut pour un roster inconnu", () => {
      expect(getRerollCost("unknown")).toBe(DEFAULT_REROLL_COST);
    });
  });

  describe("getRerollCost — alias legacy", () => {
    it.each([
      ["blackorc", 60_000],
      ["darkelf", 50_000],
      ["chaos", 60_000],
      ["chaosrenegades", 60_000],
    ] as const)("résout %s vers le slug canonique", (legacy, cost) => {
      expect(getRerollCost(legacy)).toBe(cost);
      expect(resolveRosterSlugForReroll(legacy)).not.toBe(legacy);
    });
  });

  describe("getAllRerollCosts", () => {
    it("retourne la même référence que REROLL_COSTS", () => {
      expect(getAllRerollCosts()).toBe(REROLL_COSTS);
    });
  });
});
