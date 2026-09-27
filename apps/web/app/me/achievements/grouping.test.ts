import { describe, it, expect } from "vitest";
import { groupAchievements } from "./grouping";

const ach = (slug: string, category: string) => ({ slug, category });

describe("groupAchievements", () => {
  it("range par catégorie, dans l'ordre d'affichage, sans groupe vide", () => {
    const groups = groupAchievements([
      ach("oracle", "predictions"),
      ach("first-match", "matches"),
      ach("exact", "predictions"),
    ]);
    expect(groups.map((g) => g.key)).toEqual(["matches", "predictions"]);
    expect(groups[1].label).toBe("Pronostics");
    expect(groups[1].items.map((a) => a.slug)).toEqual(["oracle", "exact"]);
  });

  it("une catégorie inconnue tombe dans « Autres » au lieu de planter", () => {
    const groups = groupAchievements([
      ach("future", "tournaments"),
      ach("first-match", "matches"),
    ]);
    expect(groups.map((g) => [g.key, g.label])).toEqual([
      ["matches", "Matchs"],
      ["other", "Autres"],
    ]);
  });
});
