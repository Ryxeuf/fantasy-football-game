import { describe, it, expect } from "vitest";
import { isAdminUser, normalizeUserRoles } from "./user-roles";

describe("normalizeUserRoles", () => {
  it("accepte un tableau de rôles", () => {
    expect(normalizeUserRoles({ roles: ["user", "admin"] })).toEqual([
      "user",
      "admin",
    ]);
  });

  it("accepte un rôle unique en chaîne", () => {
    expect(normalizeUserRoles({ role: "admin" })).toEqual(["admin"]);
  });

  it("accepte un tableau sérialisé en JSON", () => {
    expect(normalizeUserRoles({ roles: '["user","admin"]' })).toEqual([
      "user",
      "admin",
    ]);
  });

  it("préfère `roles` à `role` quand les deux sont présents", () => {
    expect(normalizeUserRoles({ roles: ["admin"], role: "user" })).toEqual([
      "admin",
    ]);
  });

  it("rend une liste vide sur les formes vides ou inattendues", () => {
    expect(normalizeUserRoles(null)).toEqual([]);
    expect(normalizeUserRoles(undefined)).toEqual([]);
    expect(normalizeUserRoles({})).toEqual([]);
    expect(normalizeUserRoles({ roles: "" })).toEqual([]);
    expect(normalizeUserRoles({ roles: 42 })).toEqual([]);
  });

  it("retombe sur le rôle unique quand le JSON est malformé", () => {
    expect(normalizeUserRoles({ role: "[admin" })).toEqual(["[admin"]);
  });

  it("ignore les entrées non-chaînes d'un tableau", () => {
    expect(normalizeUserRoles({ roles: ["admin", 7, null] })).toEqual([
      "admin",
    ]);
  });
});

describe("isAdminUser", () => {
  it("reconnaît l'admin sous ses trois formes", () => {
    expect(isAdminUser({ roles: ["admin"] })).toBe(true);
    expect(isAdminUser({ role: "admin" })).toBe(true);
    expect(isAdminUser({ roles: '["user","admin"]' })).toBe(true);
  });

  it("refuse tout le reste", () => {
    expect(isAdminUser({ roles: ["user"] })).toBe(false);
    expect(isAdminUser({ role: "moderator" })).toBe(false);
    expect(isAdminUser(null)).toBe(false);
    expect(isAdminUser({})).toBe(false);
  });

  it("ne confond pas un rôle qui contient « admin »", () => {
    expect(isAdminUser({ role: "administrateur" })).toBe(false);
    expect(isAdminUser({ role: "subadmin" })).toBe(false);
  });
});
