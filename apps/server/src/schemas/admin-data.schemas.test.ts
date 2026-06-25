import { describe, it, expect } from "vitest";
import { updateRosterStaffConfigSchema } from "./admin-data.schemas";

const validFormat = {
  rerollCost: 50000,
  maxRerolls: 8,
  apothecaryAllowed: true,
  apothecaryCost: 50000,
  maxCheerleaders: 12,
  cheerleaderCost: 10000,
  maxAssistants: 6,
  assistantCost: 10000,
  maxDedicatedFans: 6,
  dedicatedFanCost: 10000,
};

describe("updateRosterStaffConfigSchema", () => {
  it("accepte une config valide pour les deux formats", () => {
    const r = updateRosterStaffConfigSchema.safeParse({
      bb11: validFormat,
      sevens: { ...validFormat, rerollCost: 100000, apothecaryCost: 80000 },
    });
    expect(r.success).toBe(true);
  });

  it("refuse un coût négatif", () => {
    const r = updateRosterStaffConfigSchema.safeParse({
      bb11: { ...validFormat, rerollCost: -1 },
      sevens: validFormat,
    });
    expect(r.success).toBe(false);
  });

  it("refuse un coût non entier", () => {
    const r = updateRosterStaffConfigSchema.safeParse({
      bb11: { ...validFormat, cheerleaderCost: 10.5 },
      sevens: validFormat,
    });
    expect(r.success).toBe(false);
  });

  it("exige les deux formats", () => {
    const r = updateRosterStaffConfigSchema.safeParse({ bb11: validFormat });
    expect(r.success).toBe(false);
  });

  it("refuse un champ manquant dans un format", () => {
    const { rerollCost, ...partial } = validFormat;
    const r = updateRosterStaffConfigSchema.safeParse({
      bb11: partial,
      sevens: validFormat,
    });
    expect(r.success).toBe(false);
  });
});
