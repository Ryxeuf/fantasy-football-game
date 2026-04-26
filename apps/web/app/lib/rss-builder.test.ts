/**
 * Tests pour le builder RSS pur (Q.16 — Sprint 23).
 *
 * Genere un flux RSS 2.0 valide a partir des entrees du changelog.
 * Pure : pas de fetch ni d'I/O.
 */
import { describe, it, expect } from "vitest";
import { buildRssFeed, type RssFeedInput } from "./rss-builder";
import type { ChangelogEntry } from "./changelog-parser";

const sampleEntry: ChangelogEntry = {
  version: "1.72.0",
  date: "2026-04-23",
  compareUrl: "https://github.com/x/y/releases/tag/v1.72.0",
  sections: [
    {
      title: "Features",
      items: ["**auth:** add discord ([d425697](https://github.com/x/y/commit/d425697))"],
    },
  ],
};

const baseInput: RssFeedInput = {
  siteUrl: "https://nufflearena.fr",
  entries: [sampleEntry],
  language: "fr",
};

describe("buildRssFeed", () => {
  it("produit un document XML qui commence par la declaration", () => {
    const xml = buildRssFeed(baseInput);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });

  it("emet un element <rss version=\"2.0\"> avec le namespace atom", () => {
    const xml = buildRssFeed(baseInput);
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain('xmlns:atom="http://www.w3.org/2005/Atom"');
  });

  it("inclut un channel avec title, link et description bases sur siteUrl", () => {
    const xml = buildRssFeed(baseInput);
    expect(xml).toMatch(/<channel>[\s\S]*<title>[^<]+<\/title>/);
    expect(xml).toContain("<link>https://nufflearena.fr</link>");
    expect(xml).toContain("<description>");
    expect(xml).toContain("Nuffle Arena");
  });

  it("expose un atom:link self vers feed.xml", () => {
    const xml = buildRssFeed(baseInput);
    expect(xml).toContain('href="https://nufflearena.fr/feed.xml"');
    expect(xml).toContain('rel="self"');
  });

  it("expose un item par entree avec title, link, guid, pubDate", () => {
    const xml = buildRssFeed(baseInput);
    expect(xml).toContain("<item>");
    expect(xml).toContain("<title>Nuffle Arena 1.72.0</title>");
    expect(xml).toContain("<link>https://github.com/x/y/releases/tag/v1.72.0</link>");
    expect(xml).toContain("<guid");
    expect(xml).toContain(">v1.72.0<");
    // RFC 822 date
    expect(xml).toMatch(/<pubDate>[^<]*\d{4}[^<]*<\/pubDate>/);
  });

  it("inclut le contenu des sections dans la description avec CDATA", () => {
    const xml = buildRssFeed(baseInput);
    expect(xml).toContain("<![CDATA[");
    expect(xml).toContain("]]>");
    expect(xml).toContain("Features");
    expect(xml).toContain("auth");
  });

  it("echappe les entites XML dans les attributs et balises hors CDATA", () => {
    const xml = buildRssFeed({
      ...baseInput,
      siteUrl: "https://example.com/path?a=b&c=d",
    });
    // L'URL passe en attribut atom:link doit avoir l'esperluette echappee.
    expect(xml).toContain("https://example.com/path?a=b&amp;c=d/feed.xml");
  });

  it("retourne un flux vide (zero items) sans crasher", () => {
    const xml = buildRssFeed({ ...baseInput, entries: [] });
    expect(xml).toContain("<channel>");
    expect(xml).not.toContain("<item>");
  });

  it("est deterministe", () => {
    expect(buildRssFeed(baseInput)).toBe(buildRssFeed(baseInput));
  });

  it("limite a maxItems quand fourni", () => {
    const entries = Array.from({ length: 5 }, (_, i) => ({
      ...sampleEntry,
      version: `1.0.${i}`,
    }));
    const xml = buildRssFeed({ ...baseInput, entries, maxItems: 2 });
    const itemCount = (xml.match(/<item>/g) || []).length;
    expect(itemCount).toBe(2);
  });
});
