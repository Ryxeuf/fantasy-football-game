/**
 * Regression — la suppression commissaire (DELETE sans corps) doit
 * passer la validation. Avant le fix, `req.body` undefined faisait
 * echouer `z.object` ("expected object, received undefined").
 */

import { describe, it, expect } from "vitest";
import { commissionerRemovalSchema } from "./commissioner-team-edit.schemas";

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
