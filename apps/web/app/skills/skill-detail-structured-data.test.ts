import { describe, it, expect } from "vitest";
import { buildSkillDetailSchema, type SkillDetailInput } from "./skill-detail-structured-data";

const SKILL: SkillDetailInput = {
  slug: "blocage",
  nameFr: "Blocage",
  nameEn: "Block",
  description: "Permet d'utiliser tous les résultats du dé de blocage.",
  descriptionEn: "Lets you use every block die result.",
  category: "General",
  ruleset: "season_3",
};

const BASE = "https://nufflearena.fr";

describe("buildSkillDetailSchema", () => {
  it("émet un DefinedTerm et un BreadcrumbList", () => {
    const schema = buildSkillDetailSchema({ skill: SKILL, baseUrl: BASE });
    const graph = schema["@graph"] as Array<Record<string, unknown>>;
    const types = graph.map((n) => n["@type"]);
    expect(types).toContain("DefinedTerm");
    expect(types).toContain("BreadcrumbList");
  });

  it("réutilise le @id canonique de la page liste (même entité)", () => {
    const schema = buildSkillDetailSchema({ skill: SKILL, baseUrl: BASE });
    const term = (schema["@graph"] as Array<Record<string, unknown>>).find(
      (n) => n["@type"] === "DefinedTerm",
    )!;
    expect(term["@id"]).toBe(`${BASE}/skills#term-blocage`);
    expect(term.url).toBe(`${BASE}/skills/blocage`);
    expect(term.identifier).toBe("blocage");
    expect(term.termCode).toBe("General");
  });

  it("utilise les libellés FR par défaut, EN sur demande", () => {
    const fr = buildSkillDetailSchema({ skill: SKILL, baseUrl: BASE });
    const en = buildSkillDetailSchema({ skill: SKILL, baseUrl: BASE, lang: "en" });
    const frTerm = (fr["@graph"] as Array<Record<string, unknown>>)[0];
    const enTerm = (en["@graph"] as Array<Record<string, unknown>>)[0];
    expect(frTerm.name).toBe("Blocage");
    expect(frTerm.description).toContain("dé de blocage");
    expect(enTerm.name).toBe("Block");
    expect(enTerm.description).toContain("block die");
  });

  it("rattache la competence au DefinedTermSet du bon ruleset", () => {
    const s2 = buildSkillDetailSchema({
      skill: { ...SKILL, ruleset: "season_2" },
      baseUrl: BASE,
    });
    const term = (s2["@graph"] as Array<Record<string, unknown>>)[0];
    const set = term.inDefinedTermSet as Record<string, unknown>;
    expect(set["@id"]).toBe(`${BASE}/skills#defined-term-set-season_2`);
  });

  it("breadcrumb : Accueil > Compétences > nom", () => {
    const schema = buildSkillDetailSchema({ skill: SKILL, baseUrl: BASE });
    const crumb = (schema["@graph"] as Array<Record<string, unknown>>).find(
      (n) => n["@type"] === "BreadcrumbList",
    )!;
    const items = crumb.itemListElement as Array<Record<string, unknown>>;
    expect(items).toHaveLength(3);
    expect(items[2].name).toBe("Blocage");
    expect(items[2].item).toBe(`${BASE}/skills/blocage`);
  });
});
