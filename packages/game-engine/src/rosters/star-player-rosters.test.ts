import { describe, it, expect } from "vitest";
import {
  getRostersForHirableBy,
  getRostersForStarPlayer,
  getRostersForStarPlayerSlug,
} from "./star-player-rosters";
import {
  STAR_PLAYERS_BY_RULESET,
  getAvailableStarPlayers,
  getRegionalRulesForTeam,
} from "./star-players";
import { TEAM_ROSTERS_BY_RULESET } from "./positions";

describe("getRostersForHirableBy", () => {
  it("retourne tous les rosters de l'édition pour un mercenaire universel", () => {
    const rosters = getRostersForHirableBy(["all"], "season_3");
    expect(rosters).toEqual(
      Object.keys(TEAM_ROSTERS_BY_RULESET.season_3).sort(),
    );
    expect(rosters).toContain("bretonnian");
  });

  it("résout un slug de Ligue régionale en rosters rattachés", () => {
    const rosters = getRostersForHirableBy(
      ["elven_kingdoms_league"],
      "season_3",
    );
    expect(rosters).toEqual(
      ["dark_elf", "elven_union", "high_elf", "wood_elf"].sort(),
    );
  });

  it("cumule plusieurs critères sans doublon et trie par slug", () => {
    const rosters = getRostersForHirableBy(
      ["halfling_thimble_cup", "woodland_league"],
      "season_3",
    );
    // gnome + halfling appartiennent aux deux Ligues : une seule occurrence.
    expect(rosters).toEqual(["gnome", "halfling", "wood_elf"]);
    expect([...rosters]).toEqual([...rosters].sort());
  });

  it("accepte un slug de roster brut (forme remontée par la base)", () => {
    expect(getRostersForHirableBy(["skaven"], "season_3")).toEqual(["skaven"]);
  });

  it("dépend du ruleset (les Ligues 2025 n'existent pas en saison 2)", () => {
    expect(getRostersForHirableBy(["woodland_league"], "season_2")).toEqual([]);
    expect(getRostersForHirableBy(["woodland_league"], "season_3")).toEqual([
      "gnome",
      "halfling",
      "wood_elf",
    ]);
  });

  it("retourne un tableau vide pour une liste vide, nulle ou inconnue", () => {
    expect(getRostersForHirableBy([], "season_3")).toEqual([]);
    expect(getRostersForHirableBy(null, "season_3")).toEqual([]);
    expect(getRostersForHirableBy(undefined, "season_3")).toEqual([]);
    expect(getRostersForHirableBy(["ligue_inexistante"], "season_3")).toEqual(
      [],
    );
  });
});

describe("getRostersForStarPlayer", () => {
  it("est l'inverse exact de getAvailableStarPlayers", () => {
    for (const ruleset of ["season_2", "season_3"] as const) {
      const rosters = Object.keys(TEAM_ROSTERS_BY_RULESET[ruleset]);
      for (const starPlayer of Object.values(STAR_PLAYERS_BY_RULESET[ruleset])) {
        const expected = rosters
          .filter((rosterSlug) =>
            getAvailableStarPlayers(
              rosterSlug,
              getRegionalRulesForTeam(rosterSlug, ruleset),
              ruleset,
            ).some((sp) => sp.slug === starPlayer.slug),
          )
          .sort();
        expect(getRostersForStarPlayer(starPlayer, ruleset)).toEqual(expected);
      }
    }
  });

  it("tolère une valeur nulle", () => {
    expect(getRostersForStarPlayer(null)).toEqual([]);
    expect(getRostersForStarPlayer(undefined)).toEqual([]);
  });
});

describe("getRostersForStarPlayerSlug", () => {
  it("résout un Star Player du catalogue statique", () => {
    // Anqi Panqi : Super-ligue de Lustrie.
    expect(getRostersForStarPlayerSlug("anqi_panqi", "season_3")).toEqual(
      ["amazon", "lizardmen", "slann"].sort(),
    );
  });

  it("retourne un tableau vide pour un slug inconnu", () => {
    expect(getRostersForStarPlayerSlug("joueur_inexistant")).toEqual([]);
  });
});
