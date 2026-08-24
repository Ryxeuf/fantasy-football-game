import { describe, it, expect } from "vitest";
import { defaultStaffConfig } from "@bb/game-engine";
import { computeStaffSpend } from "./staff-cost";

const BB11 = defaultStaffConfig("orc", "bb11");
const SEVENS = defaultStaffConfig("orc", "sevens");

describe("computeStaffSpend", () => {
  it("le premier fan dévoué est offert", () => {
    expect(computeStaffSpend({ dedicatedFans: 1 }, BB11).dedicatedFansCost).toBe(
      0,
    );
    expect(computeStaffSpend({ dedicatedFans: 3 }, BB11).dedicatedFansCost).toBe(
      2 * BB11.dedicatedFanCost,
    );
  });

  it("applique les coûts unitaires de la config fournie", () => {
    const spend = computeStaffSpend(
      {
        rerolls: 2,
        cheerleaders: 1,
        assistants: 1,
        apothecary: true,
        dedicatedFans: 2,
      },
      BB11,
    );
    expect(spend.rerollsCost).toBe(2 * BB11.rerollCost);
    expect(spend.staffCost).toBe(
      BB11.cheerleaderCost + BB11.assistantCost + BB11.apothecaryCost,
    );
    expect(spend.dedicatedFansCost).toBe(BB11.dedicatedFanCost);
    expect(spend.total).toBe(
      spend.rerollsCost + spend.staffCost + spend.dedicatedFansCost,
    );
  });

  it("suit la config du format (Sevens plus cher que BB11)", () => {
    const counts = { rerolls: 1, cheerleaders: 1, dedicatedFans: 2 };
    expect(computeStaffSpend(counts, SEVENS).total).toBeGreaterThan(
      computeStaffSpend(counts, BB11).total,
    );
  });

  it("ignore l'apothicaire non coché et les compteurs manquants", () => {
    expect(computeStaffSpend({}, BB11).total).toBe(0);
    expect(computeStaffSpend({ apothecary: false }, BB11).staffCost).toBe(0);
  });

  it("ne compte pas les valeurs négatives", () => {
    expect(computeStaffSpend({ rerolls: -2, dedicatedFans: 0 }, BB11).total).toBe(
      0,
    );
  });
});
