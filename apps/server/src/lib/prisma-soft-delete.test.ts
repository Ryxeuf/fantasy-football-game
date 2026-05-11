/**
 * Lot P.A.2 — Tests du helper prisma-soft-delete.
 */

import { describe, it, expect } from "vitest";
import {
  whereActiveUser,
  whereDeletedUser,
  isActiveUser,
} from "./prisma-soft-delete";

describe("whereActiveUser", () => {
  it("retourne un fragment { deletedAt: null }", () => {
    expect(whereActiveUser()).toEqual({ deletedAt: null });
  });
});

describe("whereDeletedUser", () => {
  it("retourne un fragment { deletedAt: { not: null } }", () => {
    expect(whereDeletedUser()).toEqual({ deletedAt: { not: null } });
  });
});

describe("isActiveUser", () => {
  it("true si user existe avec deletedAt null", () => {
    expect(isActiveUser({ deletedAt: null })).toBe(true);
  });

  it("true si user existe sans deletedAt (champ absent)", () => {
    expect(isActiveUser({} as { deletedAt?: Date | null })).toBe(true);
  });

  it("false si user existe avec deletedAt set", () => {
    expect(isActiveUser({ deletedAt: new Date() })).toBe(false);
  });

  it("false si user est null", () => {
    expect(isActiveUser(null)).toBe(false);
  });
});
