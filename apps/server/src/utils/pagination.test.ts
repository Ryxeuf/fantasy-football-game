/**
 * Tests pour `parsePagination` (tâche O.7 — Sprint 22+).
 *
 * Vérifie le parsing des paramètres `limit`, `offset`, `page` depuis
 * `req.query` avec valeurs par défaut, plafonds, et calculs cohérents
 * (skip/page/limit pour Prisma + meta `ApiMeta`).
 */

import { describe, it, expect } from "vitest";
import { parsePagination, buildApiMeta } from "./pagination";

describe("parsePagination", () => {
  it("retourne les valeurs par défaut quand la query est vide", () => {
    const r = parsePagination({});
    expect(r.limit).toBe(50);
    expect(r.offset).toBe(0);
    expect(r.page).toBe(1);
  });

  it("respecte une `limit` valide", () => {
    const r = parsePagination({ limit: "25" });
    expect(r.limit).toBe(25);
  });

  it("plafonne `limit` au max (par défaut 100)", () => {
    const r = parsePagination({ limit: "5000" });
    expect(r.limit).toBe(100);
  });

  it("respecte un `maxLimit` personnalisé", () => {
    const r = parsePagination({ limit: "750" }, { maxLimit: 500 });
    expect(r.limit).toBe(500);
  });

  it("rejette les `limit` invalides et applique le défaut", () => {
    expect(parsePagination({ limit: "abc" }).limit).toBe(50);
    expect(parsePagination({ limit: "-3" }).limit).toBe(50);
    expect(parsePagination({ limit: "0" }).limit).toBe(50);
  });

  it("respecte un `defaultLimit` personnalisé", () => {
    const r = parsePagination({}, { defaultLimit: 20 });
    expect(r.limit).toBe(20);
  });

  it("respecte un `offset` valide", () => {
    const r = parsePagination({ offset: "30" });
    expect(r.offset).toBe(30);
  });

  it("interprète `page` (1-based) en offset", () => {
    const r = parsePagination({ page: "3", limit: "20" });
    expect(r.offset).toBe(40);
    expect(r.page).toBe(3);
  });

  it("priorise `offset` sur `page` quand les deux sont fournis", () => {
    const r = parsePagination({ offset: "15", page: "9", limit: "10" });
    expect(r.offset).toBe(15);
  });

  it("clamp `offset` négatif à 0", () => {
    const r = parsePagination({ offset: "-50" });
    expect(r.offset).toBe(0);
  });

  it("clamp `page` < 1 à 1", () => {
    const r = parsePagination({ page: "0", limit: "10" });
    expect(r.page).toBe(1);
    expect(r.offset).toBe(0);
  });

  it("ignore les valeurs non-string (Express multi-values)", () => {
    const r = parsePagination({ limit: ["20", "30"] as unknown as string });
    expect(r.limit).toBe(50);
  });
});

describe("buildApiMeta", () => {
  it("calcule la `page` à partir de `offset` et `limit`", () => {
    expect(buildApiMeta({ total: 250, limit: 50, offset: 100 })).toEqual({
      total: 250,
      limit: 50,
      page: 3,
    });
  });

  it("normalise la première page (offset 0)", () => {
    expect(buildApiMeta({ total: 7, limit: 10, offset: 0 })).toEqual({
      total: 7,
      limit: 10,
      page: 1,
    });
  });

  it("ne descend jamais sous la page 1", () => {
    expect(buildApiMeta({ total: 5, limit: 10, offset: -10 }).page).toBe(1);
  });

  it("fonctionne pour total = 0", () => {
    expect(buildApiMeta({ total: 0, limit: 50, offset: 0 })).toEqual({
      total: 0,
      limit: 50,
      page: 1,
    });
  });
});
