import { describe, expect, it } from "vitest";

import { buildProLeagueSchema } from "./pro-league-schema";

describe("buildProLeagueSchema — sprint 1.F.3", () => {
  const schema = buildProLeagueSchema({
    baseUrl: "https://nufflearena.fr",
  });

  it("declare @context schema.org au top level", () => {
    expect(schema["@context"]).toBe("https://schema.org");
  });

  it("contient un graph avec SportsLeague + FAQPage", () => {
    const graph = schema["@graph"] as Array<Record<string, unknown>>;
    expect(graph).toHaveLength(2);
    const types = graph.map((g) => g["@type"]);
    expect(types).toContain("SportsLeague");
    expect(types).toContain("FAQPage");
  });

  it("SportsLeague pointe vers /pro-league avec 16 teams", () => {
    const graph = schema["@graph"] as Array<Record<string, unknown>>;
    const league = graph.find((g) => g["@type"] === "SportsLeague")!;
    expect(league.url).toBe("https://nufflearena.fr/pro-league");
    expect(league.numberOfTeams).toBe(16);
    expect(league.name).toBe("Old World League");
  });

  it("SportsLeague hooke sur l'Organization Nuffle Arena", () => {
    const graph = schema["@graph"] as Array<Record<string, unknown>>;
    const league = graph.find((g) => g["@type"] === "SportsLeague")!;
    const parent = league.parentOrganization as Record<string, unknown>;
    expect(parent["@id"]).toBe("https://nufflearena.fr#organization");
  });

  it("FAQPage contient au moins 4 questions", () => {
    const graph = schema["@graph"] as Array<Record<string, unknown>>;
    const faq = graph.find((g) => g["@type"] === "FAQPage")!;
    const questions = faq.mainEntity as Array<Record<string, unknown>>;
    expect(questions.length).toBeGreaterThanOrEqual(4);
    for (const q of questions) {
      expect(q["@type"]).toBe("Question");
      expect(typeof q.name).toBe("string");
      const answer = q.acceptedAnswer as Record<string, unknown>;
      expect(answer["@type"]).toBe("Answer");
      expect(typeof answer.text).toBe("string");
      expect((answer.text as string).length).toBeGreaterThan(40);
    }
  });

  it("FAQ couvre les 4 sujets cles : league, betting, gazette, hall of fame", () => {
    const graph = schema["@graph"] as Array<Record<string, unknown>>;
    const faq = graph.find((g) => g["@type"] === "FAQPage")!;
    const questions = faq.mainEntity as Array<Record<string, unknown>>;
    const names = questions.map((q) => q.name as string).join(" ");
    expect(names).toMatch(/Pro League/i);
    expect(names).toMatch(/parier/i);
    expect(names).toMatch(/Gazette/i);
    expect(names).toMatch(/Hall of Fame/i);
  });

  it("propage baseUrl custom aux ids", () => {
    const custom = buildProLeagueSchema({
      baseUrl: "https://staging.example.com",
    });
    const graph = custom["@graph"] as Array<Record<string, unknown>>;
    const league = graph.find((g) => g["@type"] === "SportsLeague")!;
    expect(league["@id"]).toBe("https://staging.example.com/pro-league#league");
    expect(league.url).toBe("https://staging.example.com/pro-league");
  });
});
