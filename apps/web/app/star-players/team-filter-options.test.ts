import { describe, it, expect } from "vitest";
import { getRosterSlugsForRuleset } from "@bb/game-engine";
import { buildTeamFilterOptions } from "./team-filter-options";

describe("buildTeamFilterOptions", () => {
  it("mappe les lignes de /api/rosters et trie par nom localisé", () => {
    const options = buildTeamFilterOptions(
      [
        { slug: "orc", name: "Orques" },
        { slug: "amazon", name: "Amazones" },
        { slug: "dwarf", name: "Nains" },
      ],
      "season_3",
    );
    expect(options).toEqual([
      { slug: "amazon", name: "Amazones" },
      { slug: "dwarf", name: "Nains" },
      { slug: "orc", name: "Orques" },
    ]);
  });

  it("déduplique par slug (première occurrence gagnante)", () => {
    const options = buildTeamFilterOptions([
      { slug: "orc", name: "Orques" },
      { slug: "orc", name: "Doublon" },
    ]);
    expect(options).toEqual([{ slug: "orc", name: "Orques" }]);
  });

  it("ignore les lignes sans slug exploitable", () => {
    const options = buildTeamFilterOptions([
      { slug: "orc", name: "Orques" },
      { slug: "   ", name: "Vide" },
      { name: "Sans slug" },
      { slug: 42 as unknown as string, name: "Slug non-string" },
    ]);
    expect(options).toEqual([{ slug: "orc", name: "Orques" }]);
  });

  it("retombe sur le nom FR du catalogue quand l'API n'en fournit pas", () => {
    expect(buildTeamFilterOptions([{ slug: "wood_elf" }])).toEqual([
      { slug: "wood_elf", name: "Elfes sylvains" },
    ]);
  });

  it("retombe sur le slug pour un roster inconnu du catalogue", () => {
    expect(buildTeamFilterOptions([{ slug: "roster_maison" }])).toEqual([
      { slug: "roster_maison", name: "roster_maison" },
    ]);
  });

  it("sert TOUTES les équipes de l'édition quand l'API est indisponible", () => {
    const season3 = buildTeamFilterOptions([], "season_3");
    expect(season3.map((o) => o.slug).sort()).toEqual(
      getRosterSlugsForRuleset("season_3"),
    );
    // Le filtre codé en dur d'avant ne proposait que 5 équipes.
    expect(season3.length).toBeGreaterThan(20);
    for (const option of season3) expect(option.name).not.toBe("");
  });

  it("le repli suit la saison demandée", () => {
    const slugs3 = buildTeamFilterOptions(null, "season_3").map((o) => o.slug);
    const slugs2 = buildTeamFilterOptions(undefined, "season_2").map(
      (o) => o.slug,
    );
    expect(slugs3).toContain("bretonnian");
    expect(slugs2).not.toContain("bretonnian");
  });
});
