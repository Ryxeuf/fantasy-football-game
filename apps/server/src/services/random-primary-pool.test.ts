/**
 * Pool de l'amélioration « Compétence Principale au hasard » résolu en base :
 * la table officielle 2D6 donne la liste, `Skill` la filtre.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: { skill: { findMany: vi.fn() } },
}));

import { RANDOM_PRIMARY_SKILL_TABLE_2025 } from "@bb/game-engine";
import { prisma } from "../prisma";
import { resolveRandomPrimaryPool } from "./random-primary-pool";

const skillFindMany = prisma.skill.findMany as unknown as ReturnType<
  typeof vi.fn
>;

/** Lignes `Skill` « conformes » pour toute la table d'une catégorie. */
function rowsFor(code: "G" | "A" | "S" | "P" | "M" | "K", category: string) {
  return RANDOM_PRIMARY_SKILL_TABLE_2025[code].map((slug) => ({
    slug,
    category,
    excludedFromSelection: false,
  }));
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("resolveRandomPrimaryPool", () => {
  it("sert la table officielle quand la base est alignée", async () => {
    skillFindMany.mockResolvedValue(rowsFor("G", "General"));
    const pool = await resolveRandomPrimaryPool("G", "season_3");
    expect(pool).toEqual(RANDOM_PRIMARY_SKILL_TABLE_2025.G);
  });

  it("retire une compétence recatégorisée en admin", async () => {
    const rows = rowsFor("G", "General");
    // L'admin a déplacé « provocation » vers les Scélérates : elle ne doit
    // plus être tirée en Générale, sinon le contrôle d'accès la refuse après
    // le tirage.
    rows.find((r) => r.slug === "provocation")!.category = "Scélérates";
    skillFindMany.mockResolvedValue(rows);

    const pool = await resolveRandomPrimaryPool("G", "season_3");
    expect(pool).not.toContain("provocation");
    expect(pool).toHaveLength(RANDOM_PRIMARY_SKILL_TABLE_2025.G.length - 1);
  });

  it("retire une compétence marquée excludedFromSelection", async () => {
    const rows = rowsFor("S", "Strength");
    rows.find((r) => r.slug === "guard")!.excludedFromSelection = true;
    skillFindMany.mockResolvedValue(rows);

    const pool = await resolveRandomPrimaryPool("S", "season_3");
    expect(pool).not.toContain("guard");
  });

  it("retire une compétence absente du ruleset ciblé", async () => {
    skillFindMany.mockResolvedValue(
      rowsFor("A", "Agility").filter((r) => r.slug !== "hit-and-run"),
    );
    const pool = await resolveRandomPrimaryPool("A", "season_3");
    expect(pool).not.toContain("hit-and-run");
  });

  it("préserve l'ordre officiel du tableau p.121", async () => {
    skillFindMany.mockResolvedValue(
      // Ordre DB volontairement inversé : c'est la table qui ordonne.
      [...rowsFor("M", "Mutation")].reverse(),
    );
    const pool = await resolveRandomPrimaryPool("M", "season_3");
    expect(pool).toEqual(RANDOM_PRIMARY_SKILL_TABLE_2025.M);
  });

  it("n'ajoute pas une compétence que la base classe dans la catégorie", async () => {
    // `mighty-blow-2` est bien en Force en base, mais la table 2D6 n'a que
    // 12 lignes : le filtre ne fait que retirer, jamais ajouter.
    skillFindMany.mockResolvedValue([
      ...rowsFor("S", "Strength"),
      {
        slug: "mighty-blow-2",
        category: "Strength",
        excludedFromSelection: false,
      },
    ]);
    const pool = await resolveRandomPrimaryPool("S", "season_3");
    expect(pool).not.toContain("mighty-blow-2");
  });

  it("retombe sur la table officielle si la base est injoignable", async () => {
    skillFindMany.mockRejectedValue(new Error("no db"));
    const pool = await resolveRandomPrimaryPool("P", "season_3");
    expect(pool).toEqual(RANDOM_PRIMARY_SKILL_TABLE_2025.P);
  });

  it("retombe sur la table officielle si le ruleset n'est pas seedé", async () => {
    skillFindMany.mockResolvedValue([]);
    const pool = await resolveRandomPrimaryPool("K", "season_2");
    expect(pool).toEqual(RANDOM_PRIMARY_SKILL_TABLE_2025.K);
  });
});
