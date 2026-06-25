import { describe, it, expect } from "vitest";
import { defaultStaffConfig } from "./staff-config";
import { getRerollCost } from "./reroll-costs";

describe("staff-config — defaultStaffConfig", () => {
  describe("bb11 reproduit l'historique codé en dur (rétro-compat)", () => {
    it("dérive les coûts po depuis FORMAT_CONSTRAINTS (kpo) + getRerollCost", () => {
      const cfg = defaultStaffConfig("human", "bb11");
      expect(cfg.rerollCost).toBe(getRerollCost("human")); // ×1 en bb11
      expect(cfg.maxRerolls).toBe(8);
      expect(cfg.apothecaryAllowed).toBe(true);
      expect(cfg.apothecaryCost).toBe(50_000); // 50 kpo → po
      expect(cfg.maxCheerleaders).toBe(12);
      expect(cfg.cheerleaderCost).toBe(10_000);
      expect(cfg.maxAssistants).toBe(6);
      expect(cfg.assistantCost).toBe(10_000);
      expect(cfg.maxDedicatedFans).toBe(6);
      expect(cfg.dedicatedFanCost).toBe(10_000);
    });

    it("respecte le coût de relance par roster", () => {
      expect(defaultStaffConfig("lizardmen", "bb11").rerollCost).toBe(70_000);
      expect(defaultStaffConfig("skaven", "bb11").rerollCost).toBe(50_000);
    });
  });

  describe("sevens applique les tarifs du livre Blood Bowl à Sept", () => {
    it("relance ×2, staff à 20k, apothicaire à 80k", () => {
      const cfg = defaultStaffConfig("human", "sevens");
      expect(cfg.rerollCost).toBe(getRerollCost("human") * 2); // multiplicateur Sevens
      expect(cfg.maxRerolls).toBe(6);
      expect(cfg.apothecaryCost).toBe(80_000);
      expect(cfg.maxCheerleaders).toBe(6);
      expect(cfg.cheerleaderCost).toBe(20_000);
      expect(cfg.maxAssistants).toBe(3);
      expect(cfg.assistantCost).toBe(20_000);
      expect(cfg.dedicatedFanCost).toBe(20_000);
    });
  });

  describe("apothecaryAllowed suit la règle par roster", () => {
    it("interdit pour les morts-vivants", () => {
      expect(defaultStaffConfig("undead", "bb11").apothecaryAllowed).toBe(false);
      expect(defaultStaffConfig("necromantic_horror", "sevens").apothecaryAllowed).toBe(false);
      expect(defaultStaffConfig("nurgle", "bb11").apothecaryAllowed).toBe(false);
    });

    it("autorisé pour les autres", () => {
      expect(defaultStaffConfig("human", "bb11").apothecaryAllowed).toBe(true);
      expect(defaultStaffConfig("orc", "sevens").apothecaryAllowed).toBe(true);
    });
  });
});
