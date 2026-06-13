import { describe, it, expect } from "vitest";
import { buildComparisonSchema } from "./comparison-structured-data";

const BASE = "https://nufflearena.fr";
const TEAMS = [
  { slug: "skaven", name: "Skavens" },
  { slug: "orc", name: "Orques" },
] as const;

function graph(schema: Record<string, unknown>) {
  return schema["@graph"] as Array<Record<string, unknown>>;
}

describe("buildComparisonSchema", () => {
  it("émet CollectionPage + ItemList + BreadcrumbList", () => {
    const schema = buildComparisonSchema({ teams: TEAMS, baseUrl: BASE });
    const types = graph(schema).map((n) => n["@type"]);
    expect(types).toContain("CollectionPage");
    expect(types).toContain("ItemList");
    expect(types).toContain("BreadcrumbList");
  });

  it("liste les deux équipes avec position + URL détail", () => {
    const schema = buildComparisonSchema({ teams: TEAMS, baseUrl: BASE });
    const list = graph(schema).find((n) => n["@type"] === "ItemList")!;
    expect(list.numberOfItems).toBe(2);
    const els = list.itemListElement as Array<Record<string, unknown>>;
    expect(els[0]).toMatchObject({
      position: 1,
      name: "Skavens",
      url: `${BASE}/teams/skaven`,
    });
    expect(els[1]).toMatchObject({
      position: 2,
      name: "Orques",
      url: `${BASE}/teams/orc`,
    });
  });

  it("utilise toujours l'URL canonique (ordre alphabétique des slugs)", () => {
    // Skaven d'abord, mais l'URL canonique doit trier orc < skaven.
    const schema = buildComparisonSchema({ teams: TEAMS, baseUrl: BASE });
    const page = graph(schema).find((n) => n["@type"] === "CollectionPage")!;
    expect(page.url).toBe(`${BASE}/teams/comparer/orc-vs-skaven`);
  });

  it("relie la CollectionPage à l'ItemList et à l'Organization", () => {
    const schema = buildComparisonSchema({ teams: TEAMS, baseUrl: BASE });
    const page = graph(schema).find((n) => n["@type"] === "CollectionPage")!;
    expect((page.mainEntity as Record<string, unknown>)["@id"]).toBe(
      `${BASE}/teams/comparer/orc-vs-skaven#item-list`,
    );
    expect((page.isPartOf as Record<string, unknown>)["@id"]).toBe(
      `${BASE}#organization`,
    );
  });

  it("construit un fil d'Ariane à 4 niveaux", () => {
    const schema = buildComparisonSchema({ teams: TEAMS, baseUrl: BASE });
    const bc = graph(schema).find((n) => n["@type"] === "BreadcrumbList")!;
    const els = bc.itemListElement as Array<Record<string, unknown>>;
    expect(els).toHaveLength(4);
    expect(els[2]).toMatchObject({ name: "Comparer", item: `${BASE}/teams/comparer` });
    expect(els[3].item).toBe(`${BASE}/teams/comparer/orc-vs-skaven`);
  });

  it("traduit les libellés en anglais", () => {
    const schema = buildComparisonSchema({ teams: TEAMS, baseUrl: BASE, lang: "en" });
    const bc = graph(schema).find((n) => n["@type"] === "BreadcrumbList")!;
    const els = bc.itemListElement as Array<Record<string, unknown>>;
    expect(els[0].name).toBe("Home");
    expect(els[1].name).toBe("Teams");
    expect(els[2].name).toBe("Compare");
  });
});
