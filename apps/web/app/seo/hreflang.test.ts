/**
 * Sprint R lot R.A.4 — tests du helper hreflang.
 */

import { describe, it, expect } from "vitest";

import {
  buildHreflangAlternates,
  sitemapEntryWithAlternates,
} from "./hreflang";

describe("buildHreflangAlternates", () => {
  it("retourne fr-FR + en + x-default pour la racine", () => {
    const alt = buildHreflangAlternates("/");
    expect(Object.keys(alt).sort()).toEqual(
      ["en", "fr-FR", "x-default"].sort(),
    );
  });

  it("toutes les URLs pointent vers le meme endpoint (pre-R.A.2 segments)", () => {
    const alt = buildHreflangAlternates("/teams");
    const urls = Object.values(alt);
    expect(new Set(urls).size).toBe(1);
    expect(urls[0]).toMatch(/\/teams$/);
  });

  it("normalize les paths sans leading slash", () => {
    const alt = buildHreflangAlternates("teams");
    expect(alt["fr-FR"]).toMatch(/\/teams$/);
  });

  it("path '/' retourne juste BASE_URL (pas BASE_URL/)", () => {
    const alt = buildHreflangAlternates("/");
    for (const url of Object.values(alt)) {
      expect(url).not.toMatch(/\/$/);
    }
  });

  it("x-default pointe vers le default locale", () => {
    const alt = buildHreflangAlternates("/teams");
    expect(alt["x-default"]).toBe(alt["fr-FR"]);
  });
});

describe("sitemapEntryWithAlternates", () => {
  it("genere un entry sitemap complet avec alternates.languages", () => {
    const entry = sitemapEntryWithAlternates("/teams", {
      lastModified: new Date("2026-05-12"),
      changeFrequency: "weekly",
      priority: 0.9,
    });
    expect(entry.url).toMatch(/\/teams$/);
    expect(entry.priority).toBe(0.9);
    expect(entry.changeFrequency).toBe("weekly");
    expect(entry.alternates?.languages).toBeDefined();
    expect(Object.keys(entry.alternates?.languages ?? {}).sort()).toEqual(
      ["en", "fr-FR", "x-default"].sort(),
    );
  });
});
