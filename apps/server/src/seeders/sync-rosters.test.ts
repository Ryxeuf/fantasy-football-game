/**
 * Tests du service de sync roster (prisma + sources game-engine mockés).
 *
 * Non-régression du flux qui répare le cas "équipe pas à jour en prod" :
 *  - DRY-RUN (`write: false`) : aucune écriture, le diff décrit ce qui SERAIT
 *    fait (purge des orphelins + upsert) — c'est le défaut sûr du bouton.
 *  - WRITE (`write: true`) : purge des positions orphelines, update des
 *    positions existantes, relink des PositionSkill.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    roster: { findUnique: vi.fn() },
    position: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    positionSkill: { deleteMany: vi.fn(), create: vi.fn() },
    skill: { findUnique: vi.fn() },
  },
}));

// Source de vérité figée : un seul ruleset, un roster, deux positions dont une
// avec compétence de base (pour exercer le relink PositionSkill).
vi.mock("../../../../packages/game-engine/src/rosters/positions", () => ({
  RULESETS: ["season_3"],
  TEAM_ROSTERS_BY_RULESET: {
    season_3: {
      high_elf: {
        positions: [
          {
            slug: "high_elf_blitzer_haut_elfe",
            displayName: "Lion Blanc",
            cost: 110,
            min: 0,
            max: 2,
            ma: 7,
            st: 3,
            ag: 2,
            pa: 3,
            av: 9,
            skills: "claws,wrestle",
          },
          {
            slug: "high_elf_trois_quart_haut_elfe",
            displayName: "Trois-quart Haut Elfe",
            cost: 65,
            min: 0,
            max: 16,
            ma: 6,
            st: 3,
            ag: 2,
            pa: 3,
            av: 9,
            skills: "",
          },
        ],
      },
    },
  },
}));

vi.mock(
  "../../../../packages/game-engine/src/rosters/skill-access-season3",
  () => ({
    SKILL_ACCESS_SEASON3: {
      high_elf_blitzer_haut_elfe: { primary: "G,A", secondary: "S,P" },
      high_elf_trois_quart_haut_elfe: { primary: "G,A", secondary: "S" },
    },
  }),
);

vi.mock(
  "../../../../packages/game-engine/src/rosters/keywords-season3",
  () => ({
    KEYWORDS_SEASON3: {
      high_elf_blitzer_haut_elfe: "Elfe, Blitzer",
      high_elf_trois_quart_haut_elfe: "Elfe, Trois-quart",
    },
  }),
);

import { prisma } from "../prisma";
import { syncRosters } from "./sync-rosters";

type MockFn = ReturnType<typeof vi.fn>;
const rosterFindUnique = prisma.roster.findUnique as MockFn;
const posFindMany = prisma.position.findMany as MockFn;
const posFindFirst = prisma.position.findFirst as MockFn;
const posUpdate = prisma.position.update as MockFn;
const posCreate = prisma.position.create as MockFn;
const posDelete = prisma.position.delete as MockFn;
const psDeleteMany = prisma.positionSkill.deleteMany as MockFn;
const psCreate = prisma.positionSkill.create as MockFn;
const skillFindUnique = prisma.skill.findUnique as MockFn;

beforeEach(() => {
  vi.resetAllMocks();
  rosterFindUnique.mockResolvedValue({ id: "r1" });
  // Une position orpheline en base : ancien "Blitzer Haut Elfe" générique.
  posFindMany.mockResolvedValue([
    { id: "old1", slug: "high_elf_blitzer_old", displayName: "Blitzer Haut Elfe" },
  ]);
  // Les deux positions du code existent déjà en base (update, pas create).
  posFindFirst.mockResolvedValue({ id: "p-existing" });
  posUpdate.mockResolvedValue({ id: "p-existing" });
  posCreate.mockResolvedValue({ id: "p-new" });
  skillFindUnique.mockResolvedValue({ id: "skill-1" });
});

describe("syncRosters", () => {
  it("DRY-RUN : aucune écriture, mais décrit purge + upsert", async () => {
    const result = await syncRosters({ write: false });

    expect(result.write).toBe(false);
    expect(result.pruned).toBe(1);
    expect(result.upserted).toBe(2);
    // 2 compétences de base ("claws,wrestle") + 0 pour la position vide.
    expect(result.skillLinks).toBe(2);
    expect(result.prunedPositions).toEqual([
      {
        roster: "high_elf",
        ruleset: "season_3",
        slug: "high_elf_blitzer_old",
        displayName: "Blitzer Haut Elfe",
      },
    ]);
    expect(result.upsertedPositions[0]).toMatchObject({
      slug: "high_elf_blitzer_haut_elfe",
      displayName: "Lion Blanc",
      action: "update",
    });

    // CRITIQUE : zéro effet de bord en dry-run.
    expect(posDelete).not.toHaveBeenCalled();
    expect(posUpdate).not.toHaveBeenCalled();
    expect(posCreate).not.toHaveBeenCalled();
    expect(psDeleteMany).not.toHaveBeenCalled();
    expect(psCreate).not.toHaveBeenCalled();
  });

  it("WRITE : purge l'orphelin, update les positions, relink les compétences", async () => {
    const result = await syncRosters({ write: true });

    expect(result.write).toBe(true);
    expect(result.pruned).toBe(1);
    expect(result.upserted).toBe(2);
    expect(result.skillLinks).toBe(2);

    // Purge de l'orphelin par id.
    expect(posDelete).toHaveBeenCalledWith({ where: { id: "old1" } });
    // Update du Lion Blanc (nom + accès + mots-clés écrits).
    expect(posUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "p-existing" },
        data: expect.objectContaining({
          displayName: "Lion Blanc",
          keywords: "Elfe, Blitzer",
          primarySkills: "G,A",
          secondarySkills: "S,P",
        }),
      }),
    );
    // Relink : on vide puis recrée les liens (2 skills pour le Lion Blanc).
    expect(psDeleteMany).toHaveBeenCalled();
    expect(psCreate).toHaveBeenCalledTimes(2);
  });

  it("reporte un skill introuvable sans planter (write)", async () => {
    skillFindUnique.mockResolvedValue(null);

    const result = await syncRosters({ write: true });

    expect(result.skillLinks).toBe(0);
    expect(result.missingSkills).toEqual([
      { ruleset: "season_3", positionSlug: "high_elf_blitzer_haut_elfe", skillSlug: "claws" },
      { ruleset: "season_3", positionSlug: "high_elf_blitzer_haut_elfe", skillSlug: "wrestle" },
    ]);
    expect(psCreate).not.toHaveBeenCalled();
  });

  it("reporte un roster absent en base (ignoré, pas d'écriture)", async () => {
    rosterFindUnique.mockResolvedValue(null);

    const result = await syncRosters({ write: true });

    expect(result.missingRosters).toEqual([
      { roster: "high_elf", ruleset: "season_3" },
    ]);
    expect(result.upserted).toBe(0);
    expect(result.pruned).toBe(0);
    expect(posDelete).not.toHaveBeenCalled();
  });
});
