import { describe, it, expect } from "vitest";
import {
  buildPositionDetailSchema,
  type PositionDetailInput,
} from "./position-detail-structured-data";

const POSITION: PositionDetailInput = {
  rosterSlug: "skaven",
  rosterName: "Skavens",
  segment: "gutter_runner",
  name: "Gutter Runner",
  cost: 85,
  ma: 9,
  st: 2,
  ag: 2,
  pa: 4,
  av: 8,
};

const BASE = "https://nufflearena.fr";

describe("buildPositionDetailSchema", () => {
  const schema = buildPositionDetailSchema({
    position: POSITION,
    baseUrl: BASE,
  });
  const graph = schema["@graph"] as Array<Record<string, unknown>>;

  it("emet un @graph DefinedTerm + BreadcrumbList", () => {
    expect(schema["@context"]).toBe("https://schema.org");
    expect(graph).toHaveLength(2);
    expect(graph[0]["@type"]).toBe("DefinedTerm");
    expect(graph[1]["@type"]).toBe("BreadcrumbList");
  });

  it("pointe la position vers son URL detail canonique", () => {
    expect(graph[0].name).toBe("Gutter Runner");
    expect(graph[0].url).toBe(`${BASE}/teams/skaven/gutter_runner`);
    expect(graph[0].identifier).toBe("skaven_gutter_runner");
    const set = graph[0].inDefinedTermSet as Record<string, unknown>;
    expect(set.url).toBe(`${BASE}/teams/skaven`);
  });

  it("encode les stats dans la description (citabilite)", () => {
    expect(String(graph[0].description)).toContain("MA 9");
    expect(String(graph[0].description)).toContain("85k po");
  });

  it("construit un fil d'Ariane a 4 niveaux", () => {
    const items = graph[1].itemListElement as Array<Record<string, unknown>>;
    expect(items).toHaveLength(4);
    expect(items.map((i) => i.name)).toEqual([
      "Accueil",
      "Équipes",
      "Skavens",
      "Gutter Runner",
    ]);
    expect(items[3].item).toBe(`${BASE}/teams/skaven/gutter_runner`);
  });
});
