/**
 * Tests pour `buildBreadcrumbSchema` (Q.13 — Sprint 23).
 *
 * Helper partage qui produit le JSON-LD `BreadcrumbList` autonome
 * (avec `@context`) pour les pages profondes du site.
 */

import { describe, it, expect } from "vitest";
import { buildBreadcrumbSchema } from "./breadcrumb-schema";

describe("buildBreadcrumbSchema", () => {
  it("retourne un schema avec @context et un BreadcrumbList", () => {
    const schema = buildBreadcrumbSchema({
      items: [
        { name: "Accueil", path: "/" },
        { name: "Tutoriels", path: "/tutoriel" },
      ],
      baseUrl: "https://nufflearena.fr",
    });
    expect(schema["@context"]).toBe("https://schema.org");
    expect(schema["@type"]).toBe("BreadcrumbList");
  });

  it("auto-numerote les positions a partir de 1", () => {
    const schema = buildBreadcrumbSchema({
      items: [
        { name: "Accueil", path: "/" },
        { name: "Tutoriels", path: "/tutoriel" },
        { name: "Mon Premier Match", path: "/tutoriel/mon-premier-match" },
      ],
      baseUrl: "https://nufflearena.fr",
    });
    const items = schema.itemListElement as Array<{
      position: number;
      name: string;
      item: string;
    }>;
    expect(items[0].position).toBe(1);
    expect(items[1].position).toBe(2);
    expect(items[2].position).toBe(3);
  });

  it("convertit les paths relatifs en URLs absolues avec baseUrl", () => {
    const schema = buildBreadcrumbSchema({
      items: [
        { name: "Accueil", path: "/" },
        { name: "Tutoriels", path: "/tutoriel" },
      ],
      baseUrl: "https://nufflearena.fr",
    });
    const items = schema.itemListElement as Array<{
      item: string;
    }>;
    expect(items[0].item).toBe("https://nufflearena.fr/");
    expect(items[1].item).toBe("https://nufflearena.fr/tutoriel");
  });

  it("preserve les URLs deja absolues", () => {
    const schema = buildBreadcrumbSchema({
      items: [
        { name: "Externe", path: "https://example.com/page" },
      ],
      baseUrl: "https://nufflearena.fr",
    });
    const items = schema.itemListElement as Array<{ item: string }>;
    expect(items[0].item).toBe("https://example.com/page");
  });

  it("emet le name de chaque item", () => {
    const schema = buildBreadcrumbSchema({
      items: [
        { name: "Accueil", path: "/" },
        { name: "Tutoriels", path: "/tutoriel" },
        { name: "Mon Premier Match", path: "/tutoriel/mon-premier-match" },
      ],
      baseUrl: "https://nufflearena.fr",
    });
    const items = schema.itemListElement as Array<{ name: string }>;
    expect(items.map((i) => i.name)).toEqual([
      "Accueil",
      "Tutoriels",
      "Mon Premier Match",
    ]);
  });

  it("emet `@type: ListItem` pour chaque element", () => {
    const schema = buildBreadcrumbSchema({
      items: [
        { name: "Accueil", path: "/" },
        { name: "Tutoriels", path: "/tutoriel" },
      ],
      baseUrl: "https://nufflearena.fr",
    });
    const items = schema.itemListElement as Array<{ "@type": string }>;
    expect(items.every((i) => i["@type"] === "ListItem")).toBe(true);
  });

  it("supporte un id stable optionnel", () => {
    const schema = buildBreadcrumbSchema({
      items: [
        { name: "Accueil", path: "/" },
        { name: "Tutoriels", path: "/tutoriel" },
      ],
      baseUrl: "https://nufflearena.fr",
      id: "https://nufflearena.fr/tutoriel#breadcrumb",
    });
    expect(schema["@id"]).toBe("https://nufflearena.fr/tutoriel#breadcrumb");
  });

  it("supporte une liste vide sans crasher", () => {
    const schema = buildBreadcrumbSchema({
      items: [],
      baseUrl: "https://nufflearena.fr",
    });
    expect(schema.itemListElement).toEqual([]);
  });

  it("le schema est entierement serializable JSON", () => {
    const schema = buildBreadcrumbSchema({
      items: [
        { name: "Accueil", path: "/" },
        { name: "Tutoriels", path: "/tutoriel" },
      ],
      baseUrl: "https://nufflearena.fr",
    });
    expect(() => JSON.stringify(schema)).not.toThrow();
  });
});
