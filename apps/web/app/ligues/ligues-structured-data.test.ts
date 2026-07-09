import { describe, it, expect } from "vitest";
import {
  buildLeaguesListSchema,
  buildLeagueDetailSchema,
} from "./ligues-structured-data";

const BASE = "https://nufflearena.fr";

describe("buildLeaguesListSchema", () => {
  it("produit un @graph CollectionPage + ItemList + BreadcrumbList", () => {
    const schema = buildLeaguesListSchema({
      baseUrl: BASE,
      items: [
        { slug: "badlands_brawl", name: "Bagarre des Terres Arides" },
        { slug: "chaos_clash", name: "Clash du Chaos" },
      ],
    });
    const graph = schema["@graph"] as Array<Record<string, unknown>>;
    const types = graph.map((g) => g["@type"]);
    expect(types).toContain("CollectionPage");
    expect(types).toContain("ItemList");
    expect(types).toContain("BreadcrumbList");

    const itemList = graph.find((g) => g["@type"] === "ItemList")!;
    expect(itemList.numberOfItems).toBe(2);
    const elements = itemList.itemListElement as Array<Record<string, unknown>>;
    expect(elements[0].url).toBe(`${BASE}/ligues/badlands_brawl`);
    expect(elements[0].position).toBe(1);
  });
});

describe("buildLeagueDetailSchema", () => {
  it("liste les rosters avec une URL vers leur fiche d'équipe", () => {
    const schema = buildLeagueDetailSchema({
      baseUrl: BASE,
      league: {
        slug: "elven_kingdoms_league",
        name: "Ligue des Royaumes Elfiques",
        description: "Le pinacle du Blood Bowl technique.",
      },
      rosters: [
        { slug: "wood_elf", name: "Elfes Sylvains" },
        { slug: "high_elf", name: "Hauts Elfes" },
      ],
    });
    const graph = schema["@graph"] as Array<Record<string, unknown>>;
    const itemList = graph.find((g) => g["@type"] === "ItemList")!;
    const elements = itemList.itemListElement as Array<Record<string, unknown>>;
    expect(elements).toHaveLength(2);
    expect(elements[0].url).toBe(`${BASE}/teams/wood_elf`);

    const breadcrumb = graph.find((g) => g["@type"] === "BreadcrumbList")!;
    const crumbs = breadcrumb.itemListElement as Array<Record<string, unknown>>;
    // Accueil → Ligues → <nom de la ligue>
    expect(crumbs).toHaveLength(3);
    expect(crumbs[2].item).toBe(`${BASE}/ligues/elven_kingdoms_league`);
  });
});
