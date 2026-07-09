import { describe, it, expect } from "vitest";
import {
  getRostersForRegionalLeague,
  getRegionalLeaguesWithRosters,
} from "./regional-league-rosters";
import { TEAM_REGIONAL_RULES } from "./star-players";
import { REGIONAL_LEAGUES } from "./regional-leagues";

describe("getRostersForRegionalLeague", () => {
  it("retourne les rosters d'une Ligue, triés et cohérents avec TEAM_REGIONAL_RULES", () => {
    const elven = getRostersForRegionalLeague("elven_kingdoms_league");
    // Tous les rosters elfes officiels sont mappés sur cette Ligue.
    expect(elven).toContain("wood_elf");
    expect(elven).toContain("dark_elf");
    expect(elven).toContain("high_elf");
    expect(elven).toContain("elven_union");
    // Ordre déterministe (tri par slug).
    expect([...elven]).toEqual([...elven].sort());
    // Inverse exact de la table source.
    const expected = Object.entries(TEAM_REGIONAL_RULES)
      .filter(([, leagues]) => leagues.includes("elven_kingdoms_league"))
      .map(([slug]) => slug)
      .sort();
    expect(elven).toEqual(expected);
  });

  it("inclut un roster multi-Ligues dans chacune de ses Ligues", () => {
    // chaos_dwarf appartient à 3 Ligues régionales.
    expect(getRostersForRegionalLeague("badlands_brawl")).toContain(
      "chaos_dwarf",
    );
    expect(getRostersForRegionalLeague("worlds_edge_superleague")).toContain(
      "chaos_dwarf",
    );
    expect(getRostersForRegionalLeague("chaos_clash")).toContain("chaos_dwarf");
  });

  it("retourne un tableau vide pour un slug de Ligue inconnu", () => {
    expect(getRostersForRegionalLeague("ligue_inexistante")).toEqual([]);
  });
});

describe("getRegionalLeaguesWithRosters", () => {
  it("n'expose que les Ligues regroupant au moins un roster", () => {
    const leagues = getRegionalLeaguesWithRosters();
    expect(leagues.length).toBeGreaterThan(0);
    for (const league of leagues) {
      expect(league.rosterSlugs.length).toBeGreaterThan(0);
      // Conserve la définition (nom + description) de la Ligue source.
      const def = REGIONAL_LEAGUES.find((l) => l.slug === league.slug);
      expect(def).toBeDefined();
      expect(league.nameFr).toBe(def?.nameFr);
    }
  });
});
