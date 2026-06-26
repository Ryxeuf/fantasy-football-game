/**
 * Non-régression : résolution des règles spéciales d'équipe (CSV de slugs ->
 * vues localisées) exposée par le builder / la fiche d'équipe. Garantit que
 * les slugs connus sont résolus, les inconnus ignorés, et la localisation
 * FR/EN correcte.
 */
import { describe, it, expect } from "vitest";
import { resolveSpecialRulesCsv } from "./roster-helpers";

describe("resolveSpecialRulesCsv", () => {
  it("résout un CSV de slugs connus en FR", () => {
    const rules = resolveSpecialRulesCsv(
      "bagarreurs_brutaux,chantage_et_corruption",
      false,
    );
    expect(rules.map((r) => r.slug)).toEqual([
      "bagarreurs_brutaux",
      "chantage_et_corruption",
    ]);
    expect(rules[0].name).toBe("Bagarreurs Brutaux");
    expect(rules[0].description.length).toBeGreaterThan(0);
  });

  it("localise nom + description en anglais", () => {
    const [rule] = resolveSpecialRulesCsv("bagarreurs_brutaux", true);
    expect(rule.name).toBe("Bruisers");
    expect(rule.description).toContain("League play");
  });

  it("ignore les slugs inconnus (ex: sentinelle NONE)", () => {
    expect(resolveSpecialRulesCsv("NONE", false)).toEqual([]);
    expect(resolveSpecialRulesCsv("bagarreurs_brutaux,inconnu", false)).toHaveLength(
      1,
    );
  });

  it("tolère null / vide / espaces", () => {
    expect(resolveSpecialRulesCsv(null, false)).toEqual([]);
    expect(resolveSpecialRulesCsv("", false)).toEqual([]);
    expect(resolveSpecialRulesCsv("  ", false)).toEqual([]);
  });
});
