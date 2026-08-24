/**
 * Ligues DÉCLARÉES par un roster : c'est la même liste qui doit alimenter la
 * fiche publique, la console admin et le choix de Ligue proposé à la
 * création d'une équipe.
 */

import { describe, it, expect } from "vitest";

import {
  effectiveRegionalRules,
  parseSlugList,
} from "./roster-regional-rules";

describe("parseSlugList", () => {
  it("accepte tableau natif, JSON sérialisé et CSV historique", () => {
    expect(parseSlugList(["a", " b ", "", 2])).toEqual(["a", "b"]);
    expect(parseSlugList('["a","b"]')).toEqual(["a", "b"]);
    expect(parseSlugList("a, b")).toEqual(["a", "b"]);
    expect(parseSlugList(null)).toEqual([]);
  });
});

describe("effectiveRegionalRules", () => {
  it("préfère la valeur en base", () => {
    expect(
      effectiveRegionalRules(
        JSON.stringify(["halfling_thimble_cup", "woodland_league"]),
        "halfling",
        "season_3",
      ),
    ).toEqual({
      rules: ["halfling_thimble_cup", "woodland_league"],
      source: "db",
    });
  });

  it("retombe sur le catalogue du moteur quand la colonne est vide", () => {
    const out = effectiveRegionalRules(null, "halfling", "season_3");
    expect(out.source).toBe("roster-defaults");
    expect(out.rules).toContain("old_world_classic");
  });
});
