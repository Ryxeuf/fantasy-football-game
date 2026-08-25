/**
 * Régression : une équipe Nordique créée avec la Ligue « Clash du Chaos »
 * n'affichait aucune règle spéciale alors qu'elle gagne l'alignement
 * Favori de Khorne (la fiche ne lisait que `Roster.specialRules`).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const findFirst = vi.fn();
vi.mock("../prisma", () => ({
  prisma: { roster: { findFirst: (args: unknown) => findFirst(args) } },
}));

import { getTeamSpecialRules } from "./team-special-rules";

describe("getTeamSpecialRules", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("ajoute Favori de Khorne à une équipe Nordique au Clash du Chaos", async () => {
    findFirst.mockResolvedValue({
      slug: "norse",
      specialRules: null,
      regionalRules: null,
    });
    const rules = await getTeamSpecialRules({
      roster: "norse",
      ruleset: "season_3",
      regionalLeague: "chaos_clash",
    });
    expect(rules).toHaveLength(1);
    expect(rules[0].slug).toBe("favori_de");
    expect(rules[0].name).toBe("Favori de Khorne");
    expect(rules[0].alignment).toBe("favoured_of_khorne");
    expect(rules[0].description.length).toBeGreaterThan(0);
  });

  it("localise l'alignement en anglais", async () => {
    findFirst.mockResolvedValue({
      slug: "norse",
      specialRules: null,
      regionalRules: null,
    });
    const rules = await getTeamSpecialRules(
      { roster: "norse", ruleset: "season_3", regionalLeague: "chaos_clash" },
      true,
    );
    expect(rules[0].name).toBe("Favoured of Khorne");
  });

  it("n'attribue rien de plus à une Nordique restée au Vieux Monde", async () => {
    findFirst.mockResolvedValue({
      slug: "norse",
      specialRules: null,
      regionalRules: null,
    });
    const rules = await getTeamSpecialRules({
      roster: "norse",
      ruleset: "season_3",
      regionalLeague: "old_world_classic",
    });
    expect(rules).toEqual([]);
  });

  it("conserve les règles déclarées par le roster", async () => {
    findFirst.mockResolvedValue({
      slug: "khorne",
      specialRules: "bagarreurs_brutaux,favori_de",
      regionalRules: null,
    });
    const rules = await getTeamSpecialRules({
      roster: "khorne",
      ruleset: "season_3",
      regionalLeague: "chaos_clash",
    });
    expect(rules.map((r) => r.slug)).toEqual(["bagarreurs_brutaux", "favori_de"]);
    expect(rules[1].name).toBe("Favori de Khorne");
  });

  it("reste servi quand la lecture du roster échoue", async () => {
    findFirst.mockRejectedValue(new Error("db down"));
    const rules = await getTeamSpecialRules({
      roster: "norse",
      ruleset: "season_3",
      regionalLeague: "chaos_clash",
    });
    expect(rules.map((r) => r.slug)).toEqual(["favori_de"]);
  });
});
