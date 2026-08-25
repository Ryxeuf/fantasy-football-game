/**
 * Regression — la suppression commissaire (DELETE sans corps) doit
 * passer la validation. Avant le fix, `req.body` undefined faisait
 * echouer `z.object` ("expected object, received undefined").
 */

import { describe, it, expect } from "vitest";
import {
  commissionerRemovalSchema,
  updateRegionalLeagueSchema,
  updateStaffSchema,
} from "./commissioner-team-edit.schemas";

describe("commissionerRemovalSchema", () => {
  it("accepte un corps absent (DELETE sans body) → objet vide", () => {
    const res = commissionerRemovalSchema.safeParse(undefined);
    expect(res.success).toBe(true);
    if (res.success) expect(res.data).toEqual({});
  });

  it("accepte un corps vide", () => {
    const res = commissionerRemovalSchema.safeParse({});
    expect(res.success).toBe(true);
  });

  it("accepte un motif fourni", () => {
    const res = commissionerRemovalSchema.safeParse({ reason: "doublon" });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.reason).toBe("doublon");
  });

  it("rejette un motif trop long", () => {
    const res = commissionerRemovalSchema.safeParse({
      reason: "x".repeat(501),
    });
    expect(res.success).toBe(false);
  });
});

describe("updateStaffSchema", () => {
  it("accepte une édition partielle", () => {
    const res = updateStaffSchema.safeParse({ rerolls: 3 });
    expect(res.success).toBe(true);
  });

  it("rejette un corps sans aucun élément de staff", () => {
    expect(updateStaffSchema.safeParse({ reason: "rien" }).success).toBe(false);
    expect(updateStaffSchema.safeParse({ chargeTreasury: true }).success).toBe(
      false,
    );
  });

  it("rejette un compte négatif ou non entier", () => {
    expect(updateStaffSchema.safeParse({ rerolls: -1 }).success).toBe(false);
    expect(updateStaffSchema.safeParse({ cheerleaders: 1.5 }).success).toBe(
      false,
    );
  });

  it("exige au moins un fan dévoué", () => {
    expect(updateStaffSchema.safeParse({ dedicatedFans: 0 }).success).toBe(
      false,
    );
    expect(updateStaffSchema.safeParse({ dedicatedFans: 1 }).success).toBe(true);
  });
});

describe("updateRegionalLeagueSchema", () => {
  it("accepte un slug", () => {
    const res = updateRegionalLeagueSchema.safeParse({
      regionalLeague: "chaos_clash",
    });
    expect(res.success).toBe(true);
  });

  it("accepte null (retrait du choix)", () => {
    const res = updateRegionalLeagueSchema.safeParse({ regionalLeague: null });
    expect(res.success).toBe(true);
  });

  it("rejette un champ manquant ou vide", () => {
    expect(updateRegionalLeagueSchema.safeParse({}).success).toBe(false);
    expect(
      updateRegionalLeagueSchema.safeParse({ regionalLeague: "  " }).success,
    ).toBe(false);
  });
});
