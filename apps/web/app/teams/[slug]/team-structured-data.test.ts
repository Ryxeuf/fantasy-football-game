/**
 * Tests pour `buildTeamSchema` (Q.10 — Sprint 23).
 *
 * Helper pur qui produit le JSON-LD `SportsTeam` + `BreadcrumbList`
 * pour la page `/teams/[slug]`. Doit etre :
 *  - serializable JSON
 *  - resilient aux donnees partielles (description absente, etc.)
 *  - canonique (URL absolue, dateModified ISO 8601)
 */

import { describe, it, expect } from "vitest";
import { buildTeamSchema } from "./team-structured-data";

const BASE_ROSTER = {
  name: "Skavens",
  budget: 1000,
  tier: "I" as const,
  naf: true,
  descriptionFr:
    "Les Skavens sont une race de rats humanoides agiles et rapides.",
  descriptionEn: "Skaven are agile and fast humanoid rats.",
  positions: [
    {
      slug: "skaven_lineman",
      displayName: "Lineman",
      cost: 50,
      min: 0,
      max: 16,
      ma: 7,
      st: 3,
      ag: 3,
      pa: 4,
      av: 8,
      skills: "",
    },
    {
      slug: "skaven_thrower",
      displayName: "Thrower",
      cost: 80,
      min: 0,
      max: 2,
      ma: 7,
      st: 3,
      ag: 3,
      pa: 2,
      av: 8,
      skills: "pass,sure-hands",
    },
  ],
};

describe("buildTeamSchema", () => {
  it("retourne un @graph contenant SportsTeam et BreadcrumbList", () => {
    const schema = buildTeamSchema({
      slug: "skaven",
      roster: BASE_ROSTER,
      ruleset: "season_3",
      baseUrl: "https://nufflearena.fr",
    });
    expect(schema["@context"]).toBe("https://schema.org");
    const graph = schema["@graph"] as Array<{ "@type": string }>;
    expect(graph).toBeDefined();
    const types = graph.map((n) => n["@type"]);
    expect(types).toContain("SportsTeam");
    expect(types).toContain("BreadcrumbList");
  });

  it("definit url, name et sport pour SportsTeam", () => {
    const schema = buildTeamSchema({
      slug: "skaven",
      roster: BASE_ROSTER,
      ruleset: "season_3",
      baseUrl: "https://nufflearena.fr",
    });
    const team = (schema["@graph"] as Array<Record<string, unknown>>).find(
      (n) => n["@type"] === "SportsTeam",
    )!;
    expect(team.name).toBe("Skavens");
    expect(team.url).toBe("https://nufflearena.fr/teams/skaven");
    expect(team.sport).toBe("Blood Bowl");
  });

  it("genere un identifier @id stable", () => {
    const schema = buildTeamSchema({
      slug: "skaven",
      roster: BASE_ROSTER,
      ruleset: "season_3",
      baseUrl: "https://nufflearena.fr",
    });
    const team = (schema["@graph"] as Array<Record<string, unknown>>).find(
      (n) => n["@type"] === "SportsTeam",
    )!;
    expect(team["@id"]).toBe(
      "https://nufflearena.fr/teams/skaven#sportsteam",
    );
  });

  it("preserve la description francaise quand lang=fr", () => {
    const schema = buildTeamSchema({
      slug: "skaven",
      roster: BASE_ROSTER,
      ruleset: "season_3",
      baseUrl: "https://nufflearena.fr",
      lang: "fr",
    });
    const team = (schema["@graph"] as Array<Record<string, unknown>>).find(
      (n) => n["@type"] === "SportsTeam",
    )!;
    expect(team.description).toContain("Skavens");
  });

  it("utilise la description anglaise quand lang=en", () => {
    const schema = buildTeamSchema({
      slug: "skaven",
      roster: BASE_ROSTER,
      ruleset: "season_3",
      baseUrl: "https://nufflearena.fr",
      lang: "en",
    });
    const team = (schema["@graph"] as Array<Record<string, unknown>>).find(
      (n) => n["@type"] === "SportsTeam",
    )!;
    expect(team.description).toContain("Skaven are agile");
  });

  it("retombe sur un fallback si la description est manquante", () => {
    const schema = buildTeamSchema({
      slug: "skaven",
      roster: { ...BASE_ROSTER, descriptionFr: undefined, descriptionEn: undefined },
      ruleset: "season_3",
      baseUrl: "https://nufflearena.fr",
    });
    const team = (schema["@graph"] as Array<Record<string, unknown>>).find(
      (n) => n["@type"] === "SportsTeam",
    )!;
    expect(team.description).toBeTypeOf("string");
    expect((team.description as string).length).toBeGreaterThan(0);
  });

  it("inclut tier comme additionalProperty", () => {
    const schema = buildTeamSchema({
      slug: "skaven",
      roster: BASE_ROSTER,
      ruleset: "season_3",
      baseUrl: "https://nufflearena.fr",
    });
    const team = (schema["@graph"] as Array<Record<string, unknown>>).find(
      (n) => n["@type"] === "SportsTeam",
    )!;
    const props = team.additionalProperty as Array<{
      name: string;
      value: string | number;
    }>;
    const tier = props.find((p) => p.name === "Tier");
    expect(tier).toBeDefined();
    expect(tier!.value).toBe("I");
  });

  it("inclut le budget en milliers de pieces d'or", () => {
    const schema = buildTeamSchema({
      slug: "skaven",
      roster: BASE_ROSTER,
      ruleset: "season_3",
      baseUrl: "https://nufflearena.fr",
    });
    const team = (schema["@graph"] as Array<Record<string, unknown>>).find(
      (n) => n["@type"] === "SportsTeam",
    )!;
    const props = team.additionalProperty as Array<{
      name: string;
      value: string | number;
    }>;
    expect(props.find((p) => p.name === "Budget")).toBeDefined();
  });

  it("liste les positions comme `athlete` (Person)", () => {
    const schema = buildTeamSchema({
      slug: "skaven",
      roster: BASE_ROSTER,
      ruleset: "season_3",
      baseUrl: "https://nufflearena.fr",
    });
    const team = (schema["@graph"] as Array<Record<string, unknown>>).find(
      (n) => n["@type"] === "SportsTeam",
    )!;
    const athletes = team.athlete as Array<{
      "@type": string;
      name: string;
    }>;
    expect(athletes.length).toBe(2);
    expect(athletes[0]["@type"]).toBe("Person");
    expect(athletes.map((a) => a.name)).toEqual(["Lineman", "Thrower"]);
  });

  it("breadcrumb : Accueil -> Equipes -> [equipe]", () => {
    const schema = buildTeamSchema({
      slug: "skaven",
      roster: BASE_ROSTER,
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
    expect(items.length).toBe(3);
    expect(items[0]).toMatchObject({ position: 1, name: "Accueil" });
    expect(items[1]).toMatchObject({ position: 2, name: "Equipes" });
    expect(items[2].position).toBe(3);
    expect(items[2].name).toBe("Skavens");
  });

  it("dateModified est au format ISO 8601 (date)", () => {
    const schema = buildTeamSchema({
      slug: "skaven",
      roster: BASE_ROSTER,
      ruleset: "season_3",
      baseUrl: "https://nufflearena.fr",
    });
    const team = (schema["@graph"] as Array<Record<string, unknown>>).find(
      (n) => n["@type"] === "SportsTeam",
    )!;
    expect(team.dateModified).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });

  it("le schema est entierement serializable JSON", () => {
    const schema = buildTeamSchema({
      slug: "skaven",
      roster: BASE_ROSTER,
      ruleset: "season_3",
      baseUrl: "https://nufflearena.fr",
    });
    expect(() => JSON.stringify(schema)).not.toThrow();
    const round = JSON.parse(JSON.stringify(schema));
    expect(round["@graph"]).toBeDefined();
  });
});
