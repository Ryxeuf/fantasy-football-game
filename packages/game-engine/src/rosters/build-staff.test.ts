import { describe, expect, it } from "vitest";
import {
  EMPTY_BUILD_STAFF,
  buildStaffCostPo,
  normalizeBuildStaff,
  validateBuildStaff,
} from "./build-staff";
import { defaultStaffConfig } from "./staff-config";

const orc = defaultStaffConfig("orc", "bb11");

describe("normalizeBuildStaff", () => {
  it("champs absents = aucun staff", () => {
    expect(normalizeBuildStaff(undefined)).toEqual(EMPTY_BUILD_STAFF);
    expect(normalizeBuildStaff({ dedicatedFans: 2 })).toEqual({
      ...EMPTY_BUILD_STAFF,
      dedicatedFans: 2,
    });
  });
});

describe("buildStaffCostPo", () => {
  it("aucun staff : 0 po", () => {
    expect(buildStaffCostPo(EMPTY_BUILD_STAFF, orc)).toBe(0);
  });

  it("chaque Fan Dévoué est payé à la construction (aucun offert)", () => {
    expect(buildStaffCostPo({ ...EMPTY_BUILD_STAFF, dedicatedFans: 1 }, orc)).toBe(
      orc.dedicatedFanCost,
    );
    expect(buildStaffCostPo({ ...EMPTY_BUILD_STAFF, dedicatedFans: 3 }, orc)).toBe(
      3 * orc.dedicatedFanCost,
    );
  });

  it("somme relances, apothicaire, pom-pom girls, assistants et fans", () => {
    const sel = {
      rerolls: 2,
      cheerleaders: 1,
      assistants: 1,
      apothecary: true,
      dedicatedFans: 2,
    };
    expect(buildStaffCostPo(sel, orc)).toBe(
      2 * orc.rerollCost +
        orc.cheerleaderCost +
        orc.assistantCost +
        orc.apothecaryCost +
        2 * orc.dedicatedFanCost,
    );
  });
});

describe("validateBuildStaff", () => {
  it("accepte une sélection dans les plafonds", () => {
    expect(
      validateBuildStaff({ ...EMPTY_BUILD_STAFF, rerolls: 3, dedicatedFans: 6, apothecary: true }, orc),
    ).toEqual({ valid: true });
  });

  it("refuse au-delà des plafonds", () => {
    expect(validateBuildStaff({ ...EMPTY_BUILD_STAFF, dedicatedFans: 7 }, orc)).toEqual({
      valid: false,
      error: "Maximum 6 fans dévoués dans ce format",
    });
    expect(validateBuildStaff({ ...EMPTY_BUILD_STAFF, rerolls: 9 }, orc).valid).toBe(false);
  });

  it("refuse l'apothicaire à une équipe qui n'y a pas droit", () => {
    const noApo = { ...orc, apothecaryAllowed: false };
    expect(validateBuildStaff({ ...EMPTY_BUILD_STAFF, apothecary: true }, noApo)).toEqual({
      valid: false,
      error: "L'apothicaire n'est pas autorisé pour cette équipe",
    });
  });

  it("refuse un compte négatif ou fractionnaire", () => {
    expect(validateBuildStaff({ ...EMPTY_BUILD_STAFF, dedicatedFans: -1 }, orc).valid).toBe(false);
    expect(validateBuildStaff({ ...EMPTY_BUILD_STAFF, rerolls: 1.5 }, orc).valid).toBe(false);
  });
});
