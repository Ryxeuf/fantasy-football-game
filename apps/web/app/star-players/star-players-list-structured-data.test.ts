import { describe, it, expect } from "vitest";
import { buildStarPlayersListSchema } from "./star-players-list-structured-data";

const BASE = "https://nufflearena.fr";
const ITEMS = [
  { slug: "griff_oberwald", name: "Griff Oberwald" },
  { slug: "morg_n_thorg", name: "Morg 'n' Thorg" },
];

describe("buildStarPlayersListSchema", () => {
  it("émet CollectionPage + ItemList + BreadcrumbList", () => {
    const schema = buildStarPlayersListSchema({ items: ITEMS, baseUrl: BASE });
    const types = (schema["@graph"] as Array<Record<string, unknown>>).map((n) => n["@type"]);
    expect(types).toContain("CollectionPage");
    expect(types).toContain("ItemList");
    expect(types).toContain("BreadcrumbList");
  });

  it("ordonne les Star Players avec URL canonique", () => {
    const schema = buildStarPlayersListSchema({ items: ITEMS, baseUrl: BASE });
    const list = (schema["@graph"] as Array<Record<string, unknown>>).find(
      (n) => n["@type"] === "ItemList",
    )!;
    expect(list.numberOfItems).toBe(2);
    const els = list.itemListElement as Array<Record<string, unknown>>;
    expect(els[0]).toMatchObject({ position: 1, name: "Griff Oberwald", url: `${BASE}/star-players/griff_oberwald` });
  });
});
