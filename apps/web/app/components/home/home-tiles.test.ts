import { describe, it, expect } from "vitest";
import { buildHomeTiles } from "./home-tiles";
import fr from "../../i18n/locales/fr.json";
import en from "../../i18n/locales/en.json";

describe("buildHomeTiles", () => {
  it("donne un lien a chaque tuile, sans doublon", () => {
    const tiles = buildHomeTiles({ offlineMatchEnabled: true });
    for (const tile of tiles) expect(tile.href.startsWith("/")).toBe(true);
    expect(new Set(tiles.map((t) => t.href)).size).toBe(tiles.length);
  });

  it("expose les pages de reference auparavant absentes de la home", () => {
    const hrefs = buildHomeTiles({ offlineMatchEnabled: false }).map((t) => t.href);
    expect(hrefs).toEqual(
      expect.arrayContaining(["/compendium", "/aide-de-jeu", "/teams/tier-list"]),
    );
  });

  it("n'annonce les parties offline que si la brique est active", () => {
    const off = buildHomeTiles({ offlineMatchEnabled: false }).map((t) => t.key);
    const on = buildHomeTiles({ offlineMatchEnabled: true }).map((t) => t.key);
    expect(off).not.toContain("localMatches");
    expect(on).toContain("localMatches");
  });

  it("chaque tuile a un titre et une ligne dans les deux langues", () => {
    for (const tile of buildHomeTiles({ offlineMatchEnabled: true })) {
      for (const locale of [fr, en]) {
        const text = locale.home.tiles[tile.key];
        expect(text.title.length).toBeGreaterThan(0);
        expect(text.desc.length).toBeGreaterThan(0);
      }
    }
  });
});
