import { describe, it, expect } from "vitest";
import {
  getPlaysForCardLines,
  getPlaysForRosters,
  toPlaysForRosters,
} from "./plays-for";

describe("toPlaysForRosters", () => {
  it("met en forme les slugs servis par l'API (nom FR, tri, dédup)", () => {
    const rosters = toPlaysForRosters(["norse", "dwarf", "norse"]);
    expect(rosters.map((r) => r.slug)).toEqual(["dwarf", "norse"]);
    expect(rosters.map((r) => r.name)).toEqual(["Nains", "Nordiques"]);
  });
});

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

describe("getPlaysForCardLines (carte exportable)", () => {
  it("remplace la sentinelle all par un libellé unique bilingue", () => {
    expect(getPlaysForCardLines(["all"], "fr")).toEqual(["Toutes les équipes"]);
    expect(getPlaysForCardLines(["all"], "en")).toEqual(["All teams"]);
  });

  it("liste les équipes telles quelles quand elles tiennent sur la carte", () => {
    const lines = getPlaysForCardLines(["elven_kingdoms_league"], "fr", "season_3");
    expect(lines).toEqual([
      "Elfes noirs",
      "Elfes sylvains",
      "Hauts elfes",
      "Union elfique",
    ]);
  });

  it("coupe les longues listes avec un « + N autres équipes »", () => {
    const lines = getPlaysForCardLines(["old_world_classic"], "fr", "season_3");
    const total = getPlaysForRosters(["old_world_classic"], "season_3").length;
    expect(total).toBeGreaterThan(6);
    expect(lines).toHaveLength(6);
    expect(lines[5]).toBe(`+ ${total - 5} autres équipes`);
  });

  it("retourne une liste vide sans critère exploitable", () => {
    expect(getPlaysForCardLines([], "fr")).toEqual([]);
    expect(getPlaysForCardLines(null, "en")).toEqual([]);
  });
});
