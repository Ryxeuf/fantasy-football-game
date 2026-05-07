/**
 * S27.6.3 — Tests pour `parseAuditLogQuery` (helper du route handler
 * `GET /admin/audit-log`).
 */
import { describe, it, expect } from "vitest";
import { parseAuditLogQuery } from "./admin";

describe("parseAuditLogQuery", () => {
  it("retourne les defaults sur input vide", () => {
    const r = parseAuditLogQuery({});
    expect(r.limit).toBe(50);
    expect(r.page).toBe(1);
    expect(r.skip).toBe(0);
    expect(r.where).toEqual({});
  });

  it("parse limit + page valides", () => {
    const r = parseAuditLogQuery({ limit: "20", page: "3" });
    expect(r.limit).toBe(20);
    expect(r.page).toBe(3);
    expect(r.skip).toBe(40);
  });

  it("clamp limit a [1, 200]", () => {
    expect(parseAuditLogQuery({ limit: "0" }).limit).toBe(1);
    expect(parseAuditLogQuery({ limit: "10000" }).limit).toBe(200);
    expect(parseAuditLogQuery({ limit: "-5" }).limit).toBe(1);
  });

  it("fallback page=1 sur valeurs invalides", () => {
    expect(parseAuditLogQuery({ page: "0" }).page).toBe(1);
    expect(parseAuditLogQuery({ page: "-3" }).page).toBe(1);
    expect(parseAuditLogQuery({ page: "abc" }).page).toBe(1);
  });

  it("propage userId/action/entity en filtres where", () => {
    const r = parseAuditLogQuery({
      userId: "admin-1",
      action: "user.role.update",
      entity: "User",
    });
    expect(r.where).toEqual({
      userId: "admin-1",
      action: "user.role.update",
      entity: "User",
    });
  });

  it("ignore les filtres vides ou non-string", () => {
    const r = parseAuditLogQuery({
      userId: "",
      action: 123 as unknown as string,
      entity: undefined,
    });
    expect(r.where).toEqual({});
  });

  it("supporte un filtre partiel (entity seul)", () => {
    const r = parseAuditLogQuery({ entity: "Match" });
    expect(r.where).toEqual({ entity: "Match" });
  });

  it("calcule skip = (page - 1) * limit", () => {
    expect(parseAuditLogQuery({ limit: "25", page: "4" }).skip).toBe(75);
    expect(parseAuditLogQuery({ limit: "10", page: "1" }).skip).toBe(0);
    expect(parseAuditLogQuery({ limit: "200", page: "5" }).skip).toBe(800);
  });
});
