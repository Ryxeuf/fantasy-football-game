/**
 * S26.6 — Tests des schemas Zod ligue, focalises sur les nouveaux
 * champs `theme` + `themeYear` du `createSeasonSchema`.
 *
 * Garde-fou : empeche un caller HTTP de creer une saison avec un
 * theme inconnu ou une annee invalide (la validation metier reste
 * dans `services/league.ts:createSeason`, mais le schema rejette
 * tot les payloads grossierement malformes).
 */

import { describe, it, expect } from "vitest";
import {
  createSeasonSchema,
  listSeasonsByThemeQuerySchema,
  updateSeasonConfigSchema,
} from "./league.schemas";

describe("createSeasonSchema (S26.6 theme/themeYear)", () => {
  it("accepte un payload sans theme (retro-compat)", () => {
    const parsed = createSeasonSchema.safeParse({ name: "Saison 1" });
    expect(parsed.success).toBe(true);
  });

  it("accepte le couple theme + themeYear quand le slug est canonique", () => {
    const parsed = createSeasonSchema.safeParse({
      name: "Skaven Cup 2026",
      theme: "skaven_cup",
      themeYear: 2026,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.theme).toBe("skaven_cup");
      expect(parsed.data.themeYear).toBe(2026);
    }
  });

  it("rejette un slug de theme inconnu", () => {
    const parsed = createSeasonSchema.safeParse({
      name: "Ghost Cup",
      theme: "ghost_league",
      themeYear: 2026,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejette une annee non entiere", () => {
    const parsed = createSeasonSchema.safeParse({
      name: "Skaven Cup",
      theme: "skaven_cup",
      themeYear: 2026.5,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejette une annee <= 0", () => {
    const parsed = createSeasonSchema.safeParse({
      name: "Skaven Cup",
      theme: "skaven_cup",
      themeYear: 0,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejette theme sans themeYear (couple obligatoire)", () => {
    const parsed = createSeasonSchema.safeParse({
      name: "Skaven Cup",
      theme: "skaven_cup",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejette themeYear sans theme (couple obligatoire)", () => {
    const parsed = createSeasonSchema.safeParse({
      name: "Some Cup",
      themeYear: 2026,
    });
    expect(parsed.success).toBe(false);
  });
});

describe("updateSeasonConfigSchema (L2.B.5 coup de mecene)", () => {
  it("accepte meceneEnabled=true", () => {
    const parsed = updateSeasonConfigSchema.safeParse({ meceneEnabled: true });
    expect(parsed.success).toBe(true);
  });

  it("accepte meceneEnabled=false", () => {
    const parsed = updateSeasonConfigSchema.safeParse({ meceneEnabled: false });
    expect(parsed.success).toBe(true);
  });

  it("rejette un payload vide (aucun champ a mettre a jour)", () => {
    const parsed = updateSeasonConfigSchema.safeParse({});
    expect(parsed.success).toBe(false);
  });

  it("rejette meceneEnabled non booleen", () => {
    const parsed = updateSeasonConfigSchema.safeParse({ meceneEnabled: "yes" });
    expect(parsed.success).toBe(false);
  });
});

describe("listSeasonsByThemeQuerySchema (S26.6b listing)", () => {
  it("accepte un theme seul (toutes annees)", () => {
    const parsed = listSeasonsByThemeQuerySchema.safeParse({
      theme: "skaven_cup",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepte un theme + themeYear (annee precise)", () => {
    const parsed = listSeasonsByThemeQuerySchema.safeParse({
      theme: "nordic_challenge",
      themeYear: "2026",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.themeYear).toBe(2026);
  });

  it("rejette un slug inconnu", () => {
    const parsed = listSeasonsByThemeQuerySchema.safeParse({
      theme: "ghost_league",
    });
    expect(parsed.success).toBe(false);
  });

  it("plafonne limit a 100 et defaut a 50", () => {
    const parsed = listSeasonsByThemeQuerySchema.safeParse({
      theme: "skaven_cup",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.limit).toBe(50);
      expect(parsed.data.offset).toBe(0);
    }
    const overLimit = listSeasonsByThemeQuerySchema.safeParse({
      theme: "skaven_cup",
      limit: "9999",
    });
    expect(overLimit.success).toBe(false);
  });
});
