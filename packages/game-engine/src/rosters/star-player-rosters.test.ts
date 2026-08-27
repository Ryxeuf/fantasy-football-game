import { describe, it, expect } from "vitest";
import {
  getRosterSlugsForRuleset,
  getRostersForHirableBy,
  getRostersForStarPlayer,
  getRostersForStarPlayerSlug,
  isStarPlayerHirableByRoster,
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

describe("getRosterSlugsForRuleset", () => {
  it("retourne tout l'univers de rosters de l'édition, trié", () => {
    for (const ruleset of ["season_2", "season_3"] as const) {
      const slugs = getRosterSlugsForRuleset(ruleset);
      expect(slugs).toEqual(
        Object.keys(TEAM_ROSTERS_BY_RULESET[ruleset]).sort(),
      );
      expect(slugs).toEqual([...slugs].sort());
    }
  });

  it("suit la saison (les Bretonniens n'existent qu'en saison 3)", () => {
    expect(getRosterSlugsForRuleset("season_3")).toContain("bretonnian");
    expect(getRosterSlugsForRuleset("season_2")).not.toContain("bretonnian");
  });

  it("utilise l'édition par défaut sans argument", () => {
    expect(getRosterSlugsForRuleset()).toEqual(
      getRosterSlugsForRuleset("season_3"),
    );
  });
});

describe("isStarPlayerHirableByRoster", () => {
  it("est équivalent à l'index inverse, pour tout Star Player et tout roster", () => {
    for (const ruleset of ["season_2", "season_3"] as const) {
      const rosters = getRosterSlugsForRuleset(ruleset);
      for (const starPlayer of Object.values(STAR_PLAYERS_BY_RULESET[ruleset])) {
        const expected = new Set(
          getRostersForStarPlayer(starPlayer, ruleset),
        );
        for (const rosterSlug of rosters) {
          expect(
            isStarPlayerHirableByRoster(
              starPlayer.hirableBy,
              rosterSlug,
              ruleset,
            ),
          ).toBe(expected.has(rosterSlug));
        }
      }
    }
  });

  it("accepte un mercenaire universel", () => {
    expect(isStarPlayerHirableByRoster(["all"], "skaven", "season_3")).toBe(
      true,
    );
  });

  it("accepte un slug de roster brut (forme remontée par la base)", () => {
    expect(isStarPlayerHirableByRoster(["skaven"], "skaven", "season_3")).toBe(
      true,
    );
    expect(isStarPlayerHirableByRoster(["skaven"], "orc", "season_3")).toBe(
      false,
    );
  });

  it("refuse un roster absent de l'édition, même pour un mercenaire universel", () => {
    expect(isStarPlayerHirableByRoster(["all"], "bretonnian", "season_2")).toBe(
      false,
    );
    expect(isStarPlayerHirableByRoster(["all"], "bretonnian", "season_3")).toBe(
      true,
    );
    expect(isStarPlayerHirableByRoster(["all"], "inconnu", "season_3")).toBe(
      false,
    );
  });

  it("retourne false pour une liste de critères vide ou nulle", () => {
    expect(isStarPlayerHirableByRoster([], "skaven", "season_3")).toBe(false);
    expect(isStarPlayerHirableByRoster(null, "skaven", "season_3")).toBe(false);
    expect(isStarPlayerHirableByRoster(undefined, "skaven", "season_3")).toBe(
      false,
    );
  });
});
