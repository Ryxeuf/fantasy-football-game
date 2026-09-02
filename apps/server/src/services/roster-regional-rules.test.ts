/**
 * Ligues DÉCLARÉES par un roster : c'est la même liste qui doit alimenter la
 * fiche publique, la console admin et le choix de Ligue proposé à la
 * création d'une équipe.
 */

import { describe, it, expect } from "vitest";

import {
  displayedRegionalLeagues,
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

describe("displayedRegionalLeagues (A159 — roster de la section Ligue)", () => {
  const norse = [
    { slug: "old_world_classic", name: "Old World Classic" },
    { slug: "chaos_clash", name: "Clash du Chaos" },
    { slug: "favoured_of_khorne", name: "Favoris de Khorne" },
  ];

  it("n'affiche QUE la Ligue retenue par l'équipe", () => {
    expect(displayedRegionalLeagues(norse, "chaos_clash")).toEqual([
      { slug: "chaos_clash", name: "Clash du Chaos" },
    ]);
  });

  it("affiche toutes les Ligues du roster sans choix enregistré", () => {
    expect(displayedRegionalLeagues(norse, null)).toEqual(norse);
    expect(displayedRegionalLeagues(norse, undefined)).toEqual(norse);
    expect(displayedRegionalLeagues(norse, "")).toEqual(norse);
  });

  it("retombe sur la liste complète si le choix n'est plus au catalogue", () => {
    expect(displayedRegionalLeagues(norse, "ligue_disparue")).toEqual(norse);
  });

  it("ne mute pas la liste reçue", () => {
    const input = [...norse];
    const out = displayedRegionalLeagues(input, "chaos_clash");
    expect(input).toEqual(norse);
    expect(out).not.toBe(input);
  });

  it("gère un roster sans Ligue", () => {
    expect(displayedRegionalLeagues([], "chaos_clash")).toEqual([]);
  });
});
