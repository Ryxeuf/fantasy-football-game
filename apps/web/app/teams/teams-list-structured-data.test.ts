import { describe, it, expect } from "vitest";
import { buildTeamsListSchema } from "./teams-list-structured-data";

const BASE = "https://nufflearena.fr";
const ITEMS = [
  { slug: "skaven", name: "Skavens" },
  { slug: "orc", name: "Orques" },
];

describe("buildTeamsListSchema", () => {
  it("émet CollectionPage + ItemList + BreadcrumbList", () => {
    const schema = buildTeamsListSchema({ items: ITEMS, baseUrl: BASE });
    const types = (schema["@graph"] as Array<Record<string, unknown>>).map((n) => n["@type"]);
    expect(types).toContain("CollectionPage");
    expect(types).toContain("ItemList");
    expect(types).toContain("BreadcrumbList");
  });

  it("ordonne les items avec position + URL canonique", () => {
    const schema = buildTeamsListSchema({ items: ITEMS, baseUrl: BASE });
    const list = (schema["@graph"] as Array<Record<string, unknown>>).find(
      (n) => n["@type"] === "ItemList",
    )!;
    expect(list.numberOfItems).toBe(2);
    const els = list.itemListElement as Array<Record<string, unknown>>;
    expect(els[0]).toMatchObject({ position: 1, name: "Skavens", url: `${BASE}/teams/skaven` });
    expect(els[1]).toMatchObject({ position: 2, url: `${BASE}/teams/orc` });
  });

  it("relie la CollectionPage à l'ItemList et à l'Organization", () => {
    const schema = buildTeamsListSchema({ items: ITEMS, baseUrl: BASE });
    const page = (schema["@graph"] as Array<Record<string, unknown>>).find(
      (n) => n["@type"] === "CollectionPage",
    )!;
    expect((page.mainEntity as Record<string, unknown>)["@id"]).toBe(`${BASE}/teams#item-list`);
    expect((page.isPartOf as Record<string, unknown>)["@id"]).toBe(`${BASE}#organization`);
  });
});
