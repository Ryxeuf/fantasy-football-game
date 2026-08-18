import { describe, it, expect } from "vitest";
import { getPlaysForRosters } from "./plays-for";

describe("getPlaysForRosters", () => {
  it("résout une Ligue régionale en équipes, triées par nom FR", () => {
    const rosters = getPlaysForRosters(["elven_kingdoms_league"], "season_3");
    expect(rosters.map((r) => r.slug)).toEqual([
      "dark_elf",
      "wood_elf",
      "high_elf",
      "elven_union",
    ]);
    expect(rosters.map((r) => r.name)).toEqual([
      "Elfes noirs",
      "Elfes sylvains",
      "Hauts elfes",
      "Union elfique",
    ]);
  });

  it("liste toutes les équipes pour un mercenaire universel", () => {
    const rosters = getPlaysForRosters(["all"], "season_3");
    expect(rosters.length).toBeGreaterThan(20);
    expect(rosters.map((r) => r.slug)).toContain("skaven");
    // Tri français : pas de doublon et ordre stable sur les noms.
    const names = rosters.map((r) => r.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "fr")));
  });

  it("dédoublonne les critères qui pointent vers la même équipe", () => {
    const rosters = getPlaysForRosters(
      ["halfling_thimble_cup", "woodland_league"],
      "season_3",
    );
    expect(rosters.map((r) => r.slug)).toEqual([
      "wood_elf",
      "gnome",
      "halfling",
    ]);
  });

  it("retourne une liste vide sans critère exploitable", () => {
    expect(getPlaysForRosters([], "season_3")).toEqual([]);
    expect(getPlaysForRosters(null, "season_3")).toEqual([]);
    expect(getPlaysForRosters(["inconnu"], "season_3")).toEqual([]);
  });
});
