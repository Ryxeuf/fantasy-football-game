/**
 * Tests unitaires des résolveurs A11 de `public-rosters.ts` :
 * - `parseSlugList` : parser tolérant (array PG / JSON string sqlite / CSV / null) ;
 * - `resolveSpecialRules` : règles spéciales d'équipe localisées, slugs inconnus ignorés ;
 * - `resolveRegionalLeagues` : ligues régionales depuis la colonne DB avec
 *   fallback sur la table canonique `getRegionalRulesForTeam` (cas Saison 3).
 *
 * Le module importe `prisma` au chargement → on le mock (aucune I/O ici).
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    roster: { findMany: vi.fn(), findFirst: vi.fn() },
  },
}));

import {
  parseSlugList,
  resolveSpecialRules,
  resolveRegionalLeagues,
} from "./public-rosters";

describe("parseSlugList", () => {
  it("accepte un tableau natif (PostgreSQL) en filtrant le bruit", () => {
    expect(parseSlugList(["a", "  b  ", "", 3, null])).toEqual(["a", "b"]);
  });

  it("parse une chaîne JSON sérialisée (mirror sqlite)", () => {
    expect(parseSlugList('["badlands_brawl","old_world_classic"]')).toEqual([
      "badlands_brawl",
      "old_world_classic",
    ]);
  });

  it("retombe sur un split CSV quand ce n'est pas du JSON", () => {
    expect(parseSlugList("old_world_classic, worlds_edge_superleague")).toEqual([
      "old_world_classic",
      "worlds_edge_superleague",
    ]);
  });

  it("renvoie un tableau vide pour null/undefined/chaîne vide", () => {
    expect(parseSlugList(null)).toEqual([]);
    expect(parseSlugList(undefined)).toEqual([]);
    expect(parseSlugList("   ")).toEqual([]);
  });
});

describe("resolveSpecialRules", () => {
  it("ignore proprement la sentinelle 'NONE' et null (aucune règle mappée)", () => {
    expect(resolveSpecialRules("NONE", false)).toEqual([]);
    expect(resolveSpecialRules(null, false)).toEqual([]);
  });

  it("résout un slug de règle connu et localise selon la langue", () => {
    const fr = resolveSpecialRules("bagarreurs_brutaux", false);
    expect(fr).toHaveLength(1);
    expect(fr[0].slug).toBe("bagarreurs_brutaux");
    expect(fr[0].name).toBe("Bagarreurs Brutaux");
    expect(fr[0].description.length).toBeGreaterThan(0);

    const en = resolveSpecialRules("bagarreurs_brutaux", true);
    expect(en[0].name).toBe("Bruisers");
  });

  it("ignore les slugs inconnus sans planter", () => {
    expect(resolveSpecialRules("slug_inexistant", false)).toEqual([]);
  });
});

describe("resolveRegionalLeagues", () => {
  it("résout depuis la colonne DB (JSON array de slugs)", () => {
    const out = resolveRegionalLeagues(
      JSON.stringify(["badlands_brawl"]),
      "orc",
      "season_2",
      false,
    );
    expect(out).toEqual([
      { slug: "badlands_brawl", name: "Bagarre des Terres Arides" },
    ]);
  });

  it("localise les noms de ligue en anglais", () => {
    const out = resolveRegionalLeagues(
      JSON.stringify(["badlands_brawl"]),
      "orc",
      "season_2",
      true,
    );
    expect(out[0].name).toBe("Badlands Brawl");
  });

  it("retombe sur la table canonique quand la colonne est vide (Saison 3)", () => {
    // En S3 la colonne regionalRules est null → fallback getRegionalRulesForTeam.
    const out = resolveRegionalLeagues(null, "orc", "season_3", false);
    expect(out.map((l) => l.slug)).toContain("badlands_brawl");
  });

  it("dédoublonne et ignore les slugs de ligue inconnus", () => {
    const out = resolveRegionalLeagues(
      ["badlands_brawl", "badlands_brawl", "ligue_bidon"],
      "orc",
      "season_2",
      false,
    );
    expect(out).toHaveLength(1);
    expect(out[0].slug).toBe("badlands_brawl");
  });
});
