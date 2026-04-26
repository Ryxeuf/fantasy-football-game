/**
 * Tests pour `buildSkillsSchema` (Q.12 — Sprint 23).
 *
 * Helper pur produisant le JSON-LD `DefinedTermSet` + `ItemList` +
 * `BreadcrumbList` pour la page `/skills` (130+ entries citables).
 *
 * Invariants :
 *  - chaque skill est emis comme `DefinedTerm` avec slug, nom, description,
 *    categorie (`termCode`)
 *  - le DefinedTermSet englobe tous les skills via `hasDefinedTerm[]`
 *  - l'ItemList fournit l'ordre canonique des skills
 *  - serializable JSON
 */

import { describe, it, expect } from "vitest";
import { buildSkillsSchema } from "./skills-structured-data";

const SKILLS = [
  {
    slug: "block",
    nameFr: "Blocage",
    nameEn: "Block",
    description: "Le joueur ignore le résultat 'Tomber Tous Les Deux'.",
    descriptionEn: "The player ignores the 'Both Down' result.",
    category: "General",
  },
  {
    slug: "dodge",
    nameFr: "Esquive",
    nameEn: "Dodge",
    description: "Permet de relancer un jet d'esquive raté.",
    descriptionEn: "Allows to reroll a failed dodge roll.",
    category: "Agility",
  },
  {
    slug: "stunty",
    nameFr: "Court sur Pattes",
    nameEn: "Stunty",
    description: "Ignore les zones de tacle pour l'esquive.",
    descriptionEn: "Ignores tackle zones for dodging.",
    category: "Trait",
  },
];

describe("buildSkillsSchema", () => {
  it("retourne un @graph contenant DefinedTermSet, ItemList et BreadcrumbList", () => {
    const schema = buildSkillsSchema({
      skills: SKILLS,
      ruleset: "season_3",
      baseUrl: "https://nufflearena.fr",
    });
    expect(schema["@context"]).toBe("https://schema.org");
    const graph = schema["@graph"] as Array<Record<string, unknown>>;
    const types = graph.map((n) => n["@type"]);
    expect(types).toContain("DefinedTermSet");
    expect(types).toContain("ItemList");
    expect(types).toContain("BreadcrumbList");
  });

  it("DefinedTermSet contient tous les skills en hasDefinedTerm", () => {
    const schema = buildSkillsSchema({
      skills: SKILLS,
      ruleset: "season_3",
      baseUrl: "https://nufflearena.fr",
    });
    const set = (schema["@graph"] as Array<Record<string, unknown>>).find(
      (n) => n["@type"] === "DefinedTermSet",
    )!;
    const terms = set.hasDefinedTerm as Array<Record<string, unknown>>;
    expect(terms.length).toBe(3);
    expect(terms[0]["@type"]).toBe("DefinedTerm");
    expect(terms.map((t) => t.identifier)).toEqual(["block", "dodge", "stunty"]);
  });

  it("chaque DefinedTerm contient name, description, termCode et inDefinedTermSet", () => {
    const schema = buildSkillsSchema({
      skills: SKILLS,
      ruleset: "season_3",
      baseUrl: "https://nufflearena.fr",
    });
    const set = (schema["@graph"] as Array<Record<string, unknown>>).find(
      (n) => n["@type"] === "DefinedTermSet",
    )!;
    const term = (set.hasDefinedTerm as Array<Record<string, unknown>>)[0];
    expect(term.name).toBe("Blocage");
    expect(term.description).toContain("Tomber");
    expect(term.termCode).toBe("General");
    expect(term.inDefinedTermSet).toEqual({ "@id": set["@id"] });
  });

  it("utilise nameEn et descriptionEn quand lang=en", () => {
    const schema = buildSkillsSchema({
      skills: SKILLS,
      ruleset: "season_3",
      baseUrl: "https://nufflearena.fr",
      lang: "en",
    });
    const set = (schema["@graph"] as Array<Record<string, unknown>>).find(
      (n) => n["@type"] === "DefinedTermSet",
    )!;
    const term = (set.hasDefinedTerm as Array<Record<string, unknown>>)[0];
    expect(term.name).toBe("Block");
    expect(term.description).toContain("Both Down");
    expect(term.inLanguage).toBe("en");
  });

  it("retombe sur la version FR quand descriptionEn manque", () => {
    const schema = buildSkillsSchema({
      skills: [{ ...SKILLS[0], descriptionEn: null }],
      ruleset: "season_3",
      baseUrl: "https://nufflearena.fr",
      lang: "en",
    });
    const set = (schema["@graph"] as Array<Record<string, unknown>>).find(
      (n) => n["@type"] === "DefinedTermSet",
    )!;
    const term = (set.hasDefinedTerm as Array<Record<string, unknown>>)[0];
    expect(term.description).toContain("Tomber");
  });

  it("ItemList ordonne les skills (numberOfItems et itemListElement[])", () => {
    const schema = buildSkillsSchema({
      skills: SKILLS,
      ruleset: "season_3",
      baseUrl: "https://nufflearena.fr",
    });
    const list = (schema["@graph"] as Array<Record<string, unknown>>).find(
      (n) => n["@type"] === "ItemList",
    )!;
    expect(list.numberOfItems).toBe(3);
    const items = list.itemListElement as Array<{
      "@type": string;
      position: number;
      item: Record<string, unknown>;
    }>;
    expect(items.length).toBe(3);
    expect(items[0]["@type"]).toBe("ListItem");
    expect(items[0].position).toBe(1);
    // Chaque ListItem porte une reference vers le DefinedTerm
    expect((items[0].item as Record<string, unknown>)["@id"]).toMatch(/#term-block$/);
  });

  it("DefinedTermSet expose un name lisible et une URL canonique", () => {
    const schema = buildSkillsSchema({
      skills: SKILLS,
      ruleset: "season_3",
      baseUrl: "https://nufflearena.fr",
    });
    const set = (schema["@graph"] as Array<Record<string, unknown>>).find(
      (n) => n["@type"] === "DefinedTermSet",
    )!;
    expect(set.name).toMatch(/Blood Bowl|competences|skills/i);
    expect(set.url).toBe("https://nufflearena.fr/skills");
  });

  it("inclut un @id stable derive du ruleset", () => {
    const schema = buildSkillsSchema({
      skills: SKILLS,
      ruleset: "season_3",
      baseUrl: "https://nufflearena.fr",
    });
    const set = (schema["@graph"] as Array<Record<string, unknown>>).find(
      (n) => n["@type"] === "DefinedTermSet",
    )!;
    expect(set["@id"]).toBe(
      "https://nufflearena.fr/skills#defined-term-set-season_3",
    );
  });

  it("breadcrumb : Accueil -> Competences", () => {
    const schema = buildSkillsSchema({
      skills: SKILLS,
      ruleset: "season_3",
      baseUrl: "https://nufflearena.fr",
    });
    const breadcrumb = (
      schema["@graph"] as Array<Record<string, unknown>>
    ).find((n) => n["@type"] === "BreadcrumbList")!;
    const items = breadcrumb.itemListElement as Array<{
      position: number;
      name: string;
      item: string;
    }>;
    expect(items.length).toBe(2);
    expect(items[0]).toMatchObject({ position: 1, name: "Accueil" });
    expect(items[1].position).toBe(2);
    expect(items[1].name).toMatch(/competences|skills/i);
  });

  it("schema serializable JSON", () => {
    const schema = buildSkillsSchema({
      skills: SKILLS,
      ruleset: "season_3",
      baseUrl: "https://nufflearena.fr",
    });
    expect(() => JSON.stringify(schema)).not.toThrow();
  });

  it("supporte une liste vide sans crasher", () => {
    const schema = buildSkillsSchema({
      skills: [],
      ruleset: "season_3",
      baseUrl: "https://nufflearena.fr",
    });
    const set = (schema["@graph"] as Array<Record<string, unknown>>).find(
      (n) => n["@type"] === "DefinedTermSet",
    )!;
    expect((set.hasDefinedTerm as unknown[]).length).toBe(0);
    const list = (schema["@graph"] as Array<Record<string, unknown>>).find(
      (n) => n["@type"] === "ItemList",
    )!;
    expect(list.numberOfItems).toBe(0);
  });

  it("dateModified est ISO 8601", () => {
    const schema = buildSkillsSchema({
      skills: SKILLS,
      ruleset: "season_3",
      baseUrl: "https://nufflearena.fr",
    });
    const set = (schema["@graph"] as Array<Record<string, unknown>>).find(
      (n) => n["@type"] === "DefinedTermSet",
    )!;
    expect(set.dateModified).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });
});
