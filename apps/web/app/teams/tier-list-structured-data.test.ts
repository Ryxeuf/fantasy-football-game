import { describe, it, expect } from "vitest";
import { buildTierListSchema, sortByTier } from "./tier-list-structured-data";

const BASE = "https://nufflearena.fr";
const ITEMS = [
  { slug: "goblin", name: "Gobelins", tier: "IV" },
  { slug: "skaven", name: "Skavens", tier: "II" },
  { slug: "amazon", name: "Amazones", tier: "I" },
  { slug: "dwarf", name: "Nains", tier: "I" },
];

function graph(schema: Record<string, unknown>) {
  return schema["@graph"] as Array<Record<string, unknown>>;
}

describe("sortByTier", () => {
  it("trie par tier croissant puis par nom", () => {
    const sorted = sortByTier(ITEMS).map((i) => i.slug);
    expect(sorted).toEqual(["amazon", "dwarf", "skaven", "goblin"]);
  });

  it("ne mute pas le tableau d'entrée", () => {
    const copy = [...ITEMS];
    sortByTier(ITEMS);
    expect(ITEMS).toEqual(copy);
  });
});

describe("buildTierListSchema", () => {
  it("émet CollectionPage + ItemList + BreadcrumbList", () => {
    const schema = buildTierListSchema({ items: ITEMS, baseUrl: BASE });
    const types = graph(schema).map((n) => n["@type"]);
    expect(types).toContain("CollectionPage");
    expect(types).toContain("ItemList");
    expect(types).toContain("BreadcrumbList");
  });

  it("ordonne l'ItemList par tier et pointe vers les pages détail", () => {
    const schema = buildTierListSchema({ items: ITEMS, baseUrl: BASE });
    const list = graph(schema).find((n) => n["@type"] === "ItemList")!;
    expect(list.numberOfItems).toBe(4);
    const els = list.itemListElement as Array<Record<string, unknown>>;
    expect(els[0]).toMatchObject({ position: 1, url: `${BASE}/teams/amazon` });
    expect(els[3]).toMatchObject({ position: 4, url: `${BASE}/teams/goblin` });
  });

  it("relie la CollectionPage à l'ItemList et à l'Organization", () => {
    const schema = buildTierListSchema({ items: ITEMS, baseUrl: BASE });
    const page = graph(schema).find((n) => n["@type"] === "CollectionPage")!;
    expect(page.url).toBe(`${BASE}/teams/tier-list`);
    expect((page.mainEntity as Record<string, unknown>)["@id"]).toBe(
      `${BASE}/teams/tier-list#item-list`,
    );
    expect((page.isPartOf as Record<string, unknown>)["@id"]).toBe(
      `${BASE}#organization`,
    );
  });
});
