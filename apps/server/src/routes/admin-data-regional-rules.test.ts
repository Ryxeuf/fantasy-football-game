/**
 * Admin — ligues régionales effectives d'un roster.
 *
 * Le seed n'écrit `Roster.regionalRules` que pour les définitions qui le
 * portent (une seule en season_3) : la colonne est NULL pour la quasi-
 * totalité des rosters, alors que les pages publiques affichent bien des
 * ligues grâce au repli sur le catalogue game-engine. L'admin doit cocher
 * la même chose, sinon la fiche paraît vide.
 */

import { describe, it, expect, vi } from "vitest";

// Le module de routes importe `prisma` au chargement : on le neutralise,
// la fonction testee est pure.
vi.mock("../prisma", () => ({ prisma: {} }));

import { effectiveRegionalRules } from "./admin-data";

describe("effectiveRegionalRules", () => {
  it("prend la valeur en base quand elle est renseignée (JSON sérialisé)", () => {
    const out = effectiveRegionalRules(
      JSON.stringify(["elven_kingdoms_league"]),
      "wood_elf",
      "season_3",
    );
    expect(out).toEqual({
      rules: ["elven_kingdoms_league"],
      source: "db",
    });
  });

  it("accepte un tableau natif (PostgreSQL)", () => {
    const out = effectiveRegionalRules(
      ["old_world_classic"],
      "human",
      "season_3",
    );
    expect(out).toEqual({ rules: ["old_world_classic"], source: "db" });
  });

  it("tolère un CSV historique au lieu de faire échouer la fiche", () => {
    const out = effectiveRegionalRules(
      "badlands_brawl, underworld_challenge",
      "goblin",
      "season_2",
    );
    expect(out).toEqual({
      rules: ["badlands_brawl", "underworld_challenge"],
      source: "db",
    });
  });

  it("retombe sur le catalogue du roster quand la colonne est NULL", () => {
    const out = effectiveRegionalRules(null, "wood_elf", "season_3");
    expect(out.source).toBe("roster-defaults");
    // season_3 ajoute la Ligue Sylvestre aux Elfes Sylvains.
    expect(out.rules).toContain("elven_kingdoms_league");
    expect(out.rules).toContain("woodland_league");
  });

  it("respecte le ruleset dans le repli", () => {
    const s2 = effectiveRegionalRules(null, "wood_elf", "season_2");
    const s3 = effectiveRegionalRules(null, "wood_elf", "season_3");
    expect(s2.rules).toEqual(["elven_kingdoms_league"]);
    expect(s3.rules).not.toEqual(s2.rules);
  });

  it("retombe sur une liste vide pour un roster inconnu", () => {
    expect(effectiveRegionalRules(null, "not_a_roster", "season_3")).toEqual({
      rules: [],
      source: "roster-defaults",
    });
  });

  it("traite une chaîne vide comme absente", () => {
    const out = effectiveRegionalRules("   ", "orc", "season_3");
    expect(out.source).toBe("roster-defaults");
    expect(out.rules).toContain("badlands_brawl");
  });
});
