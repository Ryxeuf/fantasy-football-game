import { describe, it, expect } from "vitest";
import {
  getNextAdvancementPspCost,
  calculateAdvancementsSurcharge,
  calculatePlayerCurrentValue,
  isRandomAdvancement,
  getCategoryAccessType,
  SURCHARGE_PER_ADVANCEMENT,
  type AdvancementType,
} from "@bb/game-engine";
import {
  getPositionCategoryAccess,
  type SkillCategory,
} from "@bb/game-engine";

describe("Level-up advancement system", () => {
  describe("SPP cost validation", () => {
    it("first primary advancement costs 6 SPP", () => {
      expect(getNextAdvancementPspCost(0, "primary")).toBe(6);
    });

    it("first secondary advancement costs 12 SPP", () => {
      expect(getNextAdvancementPspCost(0, "secondary")).toBe(12);
    });

    it("first random-primary advancement costs 3 SPP", () => {
      expect(getNextAdvancementPspCost(0, "random-primary")).toBe(3);
    });

    it("first random-secondary advancement costs 6 SPP", () => {
      expect(getNextAdvancementPspCost(0, "random-secondary")).toBe(6);
    });

    it("SPP cost increases with each advancement", () => {
      const costs = [0, 1, 2, 3, 4, 5].map((n) =>
        getNextAdvancementPspCost(n, "primary")
      );
      // Each cost should be >= the previous one
      for (let i = 1; i < costs.length; i++) {
        expect(costs[i]).toBeGreaterThanOrEqual(costs[i - 1]);
      }
    });

    it("random advancements cost less than chosen", () => {
      for (let i = 0; i <= 5; i++) {
        expect(getNextAdvancementPspCost(i, "random-primary")).toBeLessThan(
          getNextAdvancementPspCost(i, "primary")
        );
      }
    });
  });

  describe("Team value surcharge", () => {
    it("primary skill adds 20k", () => {
      expect(SURCHARGE_PER_ADVANCEMENT.primary).toBe(20000);
    });

    it("secondary skill adds 40k", () => {
      expect(SURCHARGE_PER_ADVANCEMENT.secondary).toBe(40000);
    });

    it("random-primary adds 10k", () => {
      expect(SURCHARGE_PER_ADVANCEMENT["random-primary"]).toBe(10000);
    });

    it("random-secondary adds 20k", () => {
      expect(SURCHARGE_PER_ADVANCEMENT["random-secondary"]).toBe(20000);
    });

    it("calculates total surcharge for multiple advancements", () => {
      const advancements: AdvancementType[] = [
        "primary",
        "secondary",
        "random-primary",
      ];
      expect(calculateAdvancementsSurcharge(advancements)).toBe(
        20000 + 40000 + 10000
      );
    });

    it("calculates player current value correctly", () => {
      expect(
        calculatePlayerCurrentValue(85000, ["primary", "secondary"])
      ).toBe(85000 + 20000 + 40000);
    });
  });

  describe("Category access validation", () => {
    it("skaven_lineman has General as primary", () => {
      const access = getPositionCategoryAccess("skaven_lineman");
      expect(access.primary).toContain("General");
    });

    it("skaven_gutter_runner has Agility as primary", () => {
      const access = getPositionCategoryAccess("skaven_gutter_runner");
      expect(access.primary).toContain("Agility");
    });

    it("unknown position falls back to all categories", () => {
      const access = getPositionCategoryAccess("nonexistent_position");
      expect(access.primary.length).toBeGreaterThan(0);
      expect(access.secondary.length).toBeGreaterThan(0);
    });
  });

  describe("Advancement type helpers", () => {
    it("identifies random advancements", () => {
      expect(isRandomAdvancement("random-primary")).toBe(true);
      expect(isRandomAdvancement("random-secondary")).toBe(true);
      expect(isRandomAdvancement("primary")).toBe(false);
      expect(isRandomAdvancement("secondary")).toBe(false);
    });

    it("maps advancement type to category access", () => {
      expect(getCategoryAccessType("primary")).toBe("primary");
      expect(getCategoryAccessType("random-primary")).toBe("primary");
      expect(getCategoryAccessType("secondary")).toBe("secondary");
      expect(getCategoryAccessType("random-secondary")).toBe("secondary");
    });
  });

  describe("Level-up eligibility", () => {
    it("player with 6 SPP can afford first primary advancement", () => {
      const spp = 6;
      const cost = getNextAdvancementPspCost(0, "primary");
      expect(spp >= cost).toBe(true);
    });

    it("player with 5 SPP cannot afford first primary advancement", () => {
      const spp = 5;
      const cost = getNextAdvancementPspCost(0, "primary");
      expect(spp >= cost).toBe(false);
    });

    it("player with 3 SPP can afford first random-primary advancement", () => {
      const spp = 3;
      const cost = getNextAdvancementPspCost(0, "random-primary");
      expect(spp >= cost).toBe(true);
    });

    it("max 6 advancements per player", () => {
      // After 6 advancements, getNextAdvancementPspCost still returns a value
      // but the server should block at 6
      const cost = getNextAdvancementPspCost(5, "primary");
      expect(cost).toBe(30); // 6th advancement costs 30 SPP
    });
  });
});
