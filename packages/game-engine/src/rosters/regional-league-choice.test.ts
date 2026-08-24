/**
 * Choix de la Ligue régionale : options par roster, alignements
 * conditionnels et règles effectives.
 */

import { describe, it, expect } from "vitest";
import {
  getDefaultRegionalLeague,
  getRegionalLeagueOptions,
  isRegionalLeagueAllowed,
  isRegionalLeagueChoiceRequired,
  isRegionalLeagueSlug,
  resolveTeamRegionalRules,
} from "./regional-league-choice";
import { getRegionalRulesForTeam } from "./star-players";

describe("isRegionalLeagueSlug", () => {
  it("distingue une Ligue d'un alignement « Favori de… »", () => {
    expect(isRegionalLeagueSlug("badlands_brawl")).toBe(true);
    expect(isRegionalLeagueSlug("chaos_clash")).toBe(true);
    expect(isRegionalLeagueSlug("favoured_of_khorne")).toBe(false);
  });
});

describe("getRegionalLeagueOptions", () => {
  it("ne propose que des Ligues, jamais un alignement", () => {
    for (const roster of ["norse", "khorne", "chaos_dwarf", "orc", "dwarf"]) {
      for (const option of getRegionalLeagueOptions(roster)) {
        expect(isRegionalLeagueSlug(option.slug)).toBe(true);
      }
    }
  });

  it("Nordiques : Classique du Vieux Monde ou Clash du Chaos", () => {
    expect(getRegionalLeagueOptions("norse", "season_3")).toEqual([
      { slug: "old_world_classic", grants: [] },
      { slug: "chaos_clash", grants: ["favoured_of_khorne"] },
    ]);
  });

  it("porte l'alignement du roster sur chaque option quand il est inconditionnel", () => {
    // Nains du Chaos : Hashut fait partie de leur identité, quelle que soit
    // la Ligue rejointe.
    const options = getRegionalLeagueOptions("chaos_dwarf", "season_3");
    expect(options.length).toBeGreaterThan(1);
    for (const option of options) {
      expect(option.grants).toContain("favoured_of_hashut");
    }
  });

  it("un seul choix pour un roster mono-ligue", () => {
    expect(getRegionalLeagueOptions("orc", "season_3")).toEqual([
      { slug: "badlands_brawl", grants: [] },
    ]);
  });
});

describe("isRegionalLeagueChoiceRequired / getDefaultRegionalLeague", () => {
  it("demande un choix quand plusieurs Ligues sont ouvertes", () => {
    expect(isRegionalLeagueChoiceRequired("norse", "season_3")).toBe(true);
    expect(getDefaultRegionalLeague("norse", "season_3")).toBeNull();
  });

  it("assigne d'office la Ligue unique d'un roster", () => {
    expect(isRegionalLeagueChoiceRequired("orc", "season_3")).toBe(false);
    expect(getDefaultRegionalLeague("orc", "season_3")).toBe("badlands_brawl");
  });
});

describe("isRegionalLeagueAllowed", () => {
  it("refuse une Ligue étrangère au roster", () => {
    expect(isRegionalLeagueAllowed("orc", "badlands_brawl", "season_3")).toBe(true);
    expect(isRegionalLeagueAllowed("orc", "chaos_clash", "season_3")).toBe(false);
  });
});

describe("resolveTeamRegionalRules", () => {
  it("Nordiques + Clash du Chaos ⇒ Favori de Khorne", () => {
    expect(resolveTeamRegionalRules("norse", "season_3", "chaos_clash")).toEqual([
      "chaos_clash",
      "favoured_of_khorne",
    ]);
  });

  it("Nordiques + Classique du Vieux Monde ⇒ pas de Khorne", () => {
    expect(
      resolveTeamRegionalRules("norse", "season_3", "old_world_classic"),
    ).toEqual(["old_world_classic"]);
  });

  it("restreint un roster multi-ligues à la seule Ligue choisie", () => {
    expect(
      resolveTeamRegionalRules("dwarf", "season_3", "worlds_edge_superleague"),
    ).toEqual(["worlds_edge_superleague"]);
  });

  it("retombe sur l'union historique sans choix enregistré", () => {
    expect(resolveTeamRegionalRules("dwarf", "season_3", null)).toEqual(
      getRegionalRulesForTeam("dwarf", "season_3"),
    );
    expect(resolveTeamRegionalRules("dwarf", "season_3")).toEqual(
      getRegionalRulesForTeam("dwarf", "season_3"),
    );
  });

  it("retombe sur l'union historique si le choix n'est plus valide", () => {
    expect(
      resolveTeamRegionalRules("dwarf", "season_3", "elven_kingdoms_league"),
    ).toEqual(getRegionalRulesForTeam("dwarf", "season_3"));
  });
});
