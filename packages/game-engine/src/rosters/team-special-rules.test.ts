import { describe, it, expect } from "vitest";
import { getSpecialRulesForTeam } from "./team-special-rules";

// A53 — règles spéciales par roster depuis la source statique.
describe("getSpecialRulesForTeam (A53)", () => {
  it("renvoie les slugs CSV du roster (season_3 par défaut)", () => {
    expect(getSpecialRulesForTeam("goblin")).toEqual([
      "chantage_et_corruption",
    ]);
    expect(getSpecialRulesForTeam("dwarf")).toEqual([
      "bagarreurs_brutaux",
      "chantage_et_corruption",
    ]);
    expect(getSpecialRulesForTeam("undead")).toContain(
      "maitres_de_la_non_vie",
    );
  });

  it("renvoie [] pour un roster sans règle ou inconnu", () => {
    expect(getSpecialRulesForTeam("skaven")).toEqual([]);
    expect(getSpecialRulesForTeam("nope_team")).toEqual([]);
  });
});
