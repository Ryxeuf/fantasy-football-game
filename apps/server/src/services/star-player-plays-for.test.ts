import { describe, it, expect, vi } from "vitest";
import {
  loadRosterRegionalRules,
  playsForWithFallback,
  resolvePlaysFor,
} from "./star-player-plays-for";

// Rosters Saison 3 tels qu'en base (source de vérité) : Halflings et Nains
// du Chaos n'y ont PLUS les Ligues Saison 2 (Old World Classic / Worlds Edge).
const S3 = [
  { slug: "dwarf", regionalRules: ["worlds_edge_superleague"] },
  { slug: "halfling", regionalRules: ["halfling_thimble_cup", "woodland_league"] },
  { slug: "chaos_dwarf", regionalRules: ["badlands_brawl", "favoured_of_hashut", "chaos_clash"] },
  { slug: "norse", regionalRules: ["old_world_classic", "chaos_clash"] },
  { slug: "human", regionalRules: ["old_world_classic"] },
];

describe("resolvePlaysFor", () => {
  it("résout les Ligues du Star Player en rosters du MÊME ruleset (Thorsson S3)", () => {
    const rosters = resolvePlaysFor(
      ["old_world_classic", "worlds_edge_superleague"],
      S3,
    );
    expect(rosters).toEqual(["dwarf", "human", "norse"]);
    expect(rosters).not.toContain("halfling");
    expect(rosters).not.toContain("chaos_dwarf");
  });

  it("accepte un slug de roster explicite dans hirableBy", () => {
    expect(resolvePlaysFor(["halfling"], S3)).toEqual(["halfling"]);
  });

  it("« all » = tous les rosters du ruleset", () => {
    expect(resolvePlaysFor(["all"], S3)).toEqual(
      ["chaos_dwarf", "dwarf", "halfling", "human", "norse"],
    );
  });

  it("hirableBy vide = personne", () => {
    expect(resolvePlaysFor([], S3)).toEqual([]);
  });
});

describe("loadRosterRegionalRules", () => {
  it("lit les rosters du ruleset avec les Ligues effectives (base > catalogue)", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { slug: "halfling", regionalRules: '["halfling_thimble_cup","woodland_league"]' },
      // Colonne vide : repli sur le catalogue du moteur pour ce roster.
      { slug: "human", regionalRules: null },
    ]);
    const rows = await loadRosterRegionalRules({ roster: { findMany } }, "season_3");

    expect(findMany).toHaveBeenCalledWith({
      where: { ruleset: "season_3" },
      select: { slug: true, regionalRules: true },
    });
    expect(rows[0]).toEqual({
      slug: "halfling",
      regionalRules: ["halfling_thimble_cup", "woodland_league"],
    });
    expect(rows[1]?.regionalRules).toContain("old_world_classic");
  });

  it("retourne [] sur un client sans modèle roster", async () => {
    await expect(loadRosterRegionalRules({}, "season_3")).resolves.toEqual([]);
  });
});

describe("playsForWithFallback", () => {
  it("préfère la base quand elle a des rosters", () => {
    expect(
      playsForWithFallback(["worlds_edge_superleague"], S3, "season_3"),
    ).toEqual(["dwarf"]);
  });

  it("retombe sur le catalogue du moteur sans rosters en base", () => {
    const rosters = playsForWithFallback(["elven_kingdoms_league"], [], "season_3");
    expect(rosters).toContain("wood_elf");
    expect(rosters).toContain("high_elf");
  });
});
