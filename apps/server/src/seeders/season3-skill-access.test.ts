/**
 * Tests du réimport idempotent des accès S3 (prisma mocké). Vérifie qu'on
 * écrit `primary/secondarySkills` canoniques par position, qu'on saute les
 * positions sans entrée d'accès, et qu'on compte correctement le résultat.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    roster: { findMany: vi.fn() },
    position: { update: vi.fn() },
  },
}));

// Source d'accès canonique : on fige une entrée connue + une absente pour
// piloter le test sans dépendre de l'intégralité de la map réelle.
vi.mock(
  "../../../../packages/game-engine/src/rosters/skill-access-season3",
  () => ({
    SKILL_ACCESS_SEASON3: {
      high_elf_trois_quart_haut_elfe: { primary: "G,A", secondary: "S" },
      underworld_gobelin_des_bas_fond: { primary: "A,M,K", secondary: "G,S,P" },
      animal_position: { primary: "", secondary: "A" },
    },
  }),
);

import { prisma } from "../prisma";
import { reimportSeason3SkillAccess } from "./season3-skill-access";

type MockFn = ReturnType<typeof vi.fn>;
const findMany = prisma.roster.findMany as MockFn;
const update = prisma.position.update as MockFn;

beforeEach(() => {
  vi.resetAllMocks();
  update.mockResolvedValue({});
});

describe("reimportSeason3SkillAccess", () => {
  it("écrit les accès canoniques par position et compte les mises à jour", async () => {
    findMany.mockResolvedValue([
      {
        id: "r1",
        positions: [
          { id: "p1", slug: "high_elf_trois_quart_haut_elfe" },
          { id: "p2", slug: "underworld_gobelin_des_bas_fond" },
        ],
      },
      {
        id: "r2",
        positions: [{ id: "p3", slug: "animal_position" }],
      },
    ]);

    const result = await reimportSeason3SkillAccess();

    expect(result).toEqual({
      rosters: 2,
      positionsTotal: 3,
      updated: 3,
      missing: [],
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: "p2" },
      data: { primarySkills: "A,M,K", secondarySkills: "G,S,P" },
    });
    // Position animale : primaire "" reste "" (pool renseigné mais vide).
    expect(update).toHaveBeenCalledWith({
      where: { id: "p3" },
      data: { primarySkills: "", secondarySkills: "A" },
    });
  });

  it("saute les positions sans entrée d'accès et les reporte", async () => {
    findMany.mockResolvedValue([
      {
        id: "r1",
        positions: [
          { id: "p1", slug: "high_elf_trois_quart_haut_elfe" },
          { id: "p9", slug: "slug_inconnu_sans_acces" },
        ],
      },
    ]);

    const result = await reimportSeason3SkillAccess();

    expect(result.updated).toBe(1);
    expect(result.positionsTotal).toBe(2);
    expect(result.missing).toEqual(["slug_inconnu_sans_acces"]);
    expect(update).toHaveBeenCalledTimes(1);
  });
});
