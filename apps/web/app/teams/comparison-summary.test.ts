import { describe, it, expect } from "vitest";
import { buildComparisonSummary, type SummaryTeam } from "./comparison-summary";

const ORC: SummaryTeam = {
  name: "Orques",
  tier: "II",
  difficulty: "beginner",
  playStyle: "bash",
};
const WOOD_ELF: SummaryTeam = {
  name: "Elfes Sylvains",
  tier: "I",
  difficulty: "advanced",
  playStyle: "agile",
};

describe("buildComparisonSummary (fr)", () => {
  it("désigne l'équipe au meilleur tier comme plus compétitive", () => {
    const text = buildComparisonSummary(ORC, WOOD_ELF);
    expect(text).toContain("Elfes Sylvains (Tier I) est généralement jugée plus compétitive");
  });

  it("oppose les styles de jeu différents", () => {
    const text = buildComparisonSummary(ORC, WOOD_ELF);
    expect(text.toLowerCase()).toContain("bagarre");
    expect(text.toLowerCase()).toContain("agile");
  });

  it("désigne l'équipe la plus accessible aux débutants", () => {
    const text = buildComparisonSummary(ORC, WOOD_ELF);
    expect(text).toContain("Orques est plus accessible aux débutants");
  });

  it("gère deux équipes de même tier", () => {
    const text = buildComparisonSummary(ORC, {
      ...WOOD_ELF,
      name: "Skavens",
      tier: "II",
    });
    expect(text).toContain("appartiennent toutes deux au Tier II");
  });

  it("gère un style partagé", () => {
    const text = buildComparisonSummary(ORC, {
      ...ORC,
      name: "Nains",
      tier: "I",
    });
    expect(text).toContain("privilégient un jeu bagarre");
  });
});

describe("buildComparisonSummary (en)", () => {
  it("produit un résumé anglais cohérent", () => {
    const text = buildComparisonSummary(ORC, WOOD_ELF, "en");
    expect(text).toContain("Elfes Sylvains (Tier I) is generally rated more competitive");
    expect(text).toContain("Orques is friendlier to newcomers");
  });
});
