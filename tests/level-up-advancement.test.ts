import { describe, it, expect } from "vitest";
import {
  getNextAdvancementPspCost,
  calculateAdvancementsSurcharge,
  calculatePlayerCurrentValue,
  surchargeForAdvancement,
  isRandomAdvancement,
  getCategoryAccessType,
  applyCharacteristicImprovement,
  SURCHARGE_PER_ADVANCEMENT,
  CHARACTERISTIC_VALUE_INCREASE,
  type AdvancementSurchargeInput,
} from "@bb/game-engine";
import { getPositionCategoryAccess } from "@bb/game-engine";

describe("Level-up advancement system (BB2025 / Saison 3)", () => {
  describe("SPP cost validation", () => {
    it("first primary advancement costs 6 SPP (inchangé)", () => {
      expect(getNextAdvancementPspCost(0, "primary")).toBe(6);
    });

    it("first secondary advancement costs 10 SPP (S3 : 10 et non plus 12)", () => {
      expect(getNextAdvancementPspCost(0, "secondary")).toBe(10);
    });

    it("first random-primary advancement costs 3 SPP", () => {
      expect(getNextAdvancementPspCost(0, "random-primary")).toBe(3);
    });

    it("first characteristic advancement costs 14 SPP (S3)", () => {
      expect(getNextAdvancementPspCost(0, "characteristic")).toBe(14);
    });

    it("SPP cost increases with each advancement", () => {
      const costs = [0, 1, 2, 3, 4, 5].map((n) =>
        getNextAdvancementPspCost(n, "secondary")
      );
      for (let i = 1; i < costs.length; i++) {
        expect(costs[i]).toBeGreaterThanOrEqual(costs[i - 1]);
      }
    });

    it("random-primary costs less than chosen primary", () => {
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

    it("characteristic surcharge depends on the stat", () => {
      expect(CHARACTERISTIC_VALUE_INCREASE.av).toBe(10000);
      expect(surchargeForAdvancement({ type: "characteristic", stat: "st" })).toBe(
        60000
      );
    });

    it("calculates total surcharge for multiple advancements", () => {
      const advancements: AdvancementSurchargeInput[] = [
        { type: "primary" },
        { type: "secondary" },
        { type: "random-primary" },
      ];
      expect(calculateAdvancementsSurcharge(advancements)).toBe(
        20000 + 40000 + 10000
      );
    });

    it("calculates player current value correctly (skills + carac)", () => {
      expect(
        calculatePlayerCurrentValue(85000, [
          { type: "primary" },
          { type: "characteristic", stat: "ma" },
        ])
      ).toBe(85000 + 20000 + 20000);
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
    it("only random-primary is a random advancement in S3", () => {
      expect(isRandomAdvancement("random-primary")).toBe(true);
      expect(isRandomAdvancement("primary")).toBe(false);
      expect(isRandomAdvancement("secondary")).toBe(false);
      expect(isRandomAdvancement("characteristic")).toBe(false);
    });

    it("maps advancement type to category access", () => {
      expect(getCategoryAccessType("primary")).toBe("primary");
      expect(getCategoryAccessType("random-primary")).toBe("primary");
      expect(getCategoryAccessType("secondary")).toBe("secondary");
    });
  });

  describe("Characteristic improvement", () => {
    it("increments MA/ST/AV and decrements AG/PA targets", () => {
      const base = { ma: 6, st: 3, ag: 3, pa: 4, av: 9 };
      expect(applyCharacteristicImprovement(base, "ma").ma).toBe(7);
      expect(applyCharacteristicImprovement(base, "ag").ag).toBe(2);
      expect(applyCharacteristicImprovement(base, "pa").pa).toBe(3);
    });
  });

  describe("Level-up eligibility", () => {
    it("player with 10 SPP can afford first secondary advancement (S3)", () => {
      const spp = 10;
      const cost = getNextAdvancementPspCost(0, "secondary");
      expect(spp >= cost).toBe(true);
    });

    it("player with 9 SPP cannot afford first secondary advancement (S3)", () => {
      const spp = 9;
      const cost = getNextAdvancementPspCost(0, "secondary");
      expect(spp >= cost).toBe(false);
    });

    it("max 6 advancements per player", () => {
      const cost = getNextAdvancementPspCost(5, "primary");
      expect(cost).toBe(30); // 6th primary advancement costs 30 SPP
    });
  });
});
