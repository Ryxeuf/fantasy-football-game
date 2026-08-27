/**
 * Lot 6a — le seeder de colonnes ne réécrit JAMAIS une valeur déjà posée.
 *
 * `prisma/migrations/` est gitignoré et la prod applique le schéma par
 * `db push` : ces colonnes ne peuvent pas être backfillées par une migration.
 * Ce seeder les renseigne au déploiement — mais une correction saisie en
 * admin doit survivre au déploiement suivant.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    position: { findMany: vi.fn(), update: vi.fn() },
    roster: { findMany: vi.fn(), update: vi.fn() },
    starPlayer: { findUnique: vi.fn(), update: vi.fn() },
    skill: { findMany: vi.fn(), updateMany: vi.fn() },
  },
}));

vi.mock("../utils/server-log", () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), log: vi.fn() },
}));

import { prisma } from "../prisma";
import { syncCatalogueColumns } from "./sync-catalogue-columns";

const db = prisma as unknown as {
  position: { findMany: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  roster: { findMany: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  starPlayer: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  skill: {
    findMany: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
};

beforeEach(() => {
  vi.resetAllMocks();
  db.position.findMany.mockResolvedValue([]);
  db.roster.findMany.mockResolvedValue([]);
  db.starPlayer.findUnique.mockResolvedValue(null);
  db.skill.findMany.mockResolvedValue([]);
});

describe("syncCatalogueColumns", () => {
  it("renseigne le nom anglais des postes dont la colonne est nulle", async () => {
    db.position.findMany.mockResolvedValue([
      { id: "p1", slug: "old_world_alliance_trois_quart_humain" },
      { id: "p2", slug: "poste-inconnu-du-moteur" },
    ]);

    const res = await syncCatalogueColumns({ write: true });

    expect(res.positionNames).toBe(1);
    expect(db.position.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { displayNameEn: expect.any(String) },
    });
  });

  it("ne pose le plafond de Gros Bras que pour les rosters qui en ont un", async () => {
    db.roster.findMany.mockResolvedValue([
      { id: "r1", slug: "underworld" },
      { id: "r2", slug: "skaven" },
    ]);

    const res = await syncCatalogueColumns({ write: true });

    expect(res.bigGuyLimits).toBe(1);
    expect(db.roster.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: { maxBigGuys: 1 },
    });
  });

  it("n'écrase pas un partenaire déjà renseigné", async () => {
    db.starPlayer.findUnique.mockResolvedValue({
      id: "sp1",
      pairWithSlug: "un-autre-partenaire",
    });

    const res = await syncCatalogueColumns({ write: true });

    expect(res.starPairs).toBe(0);
    expect(db.starPlayer.update).not.toHaveBeenCalled();
  });

  it("ne recatégorise que les pouvoirs restés en « Trait »", async () => {
    db.skill.findMany.mockResolvedValue([{ id: "s1" }, { id: "s2" }]);

    const res = await syncCatalogueColumns({ write: true });

    expect(res.starRuleCategories).toBe(2);
    expect(db.skill.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ category: "Trait" }),
      }),
    );
    expect(db.skill.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["s1", "s2"] } },
      data: { category: "StarPlayerRule" },
    });
  });

  it("en dry-run, compte sans écrire", async () => {
    db.position.findMany.mockResolvedValue([{ id: "p1", slug: "old_world_alliance_trois_quart_humain" }]);
    db.roster.findMany.mockResolvedValue([{ id: "r1", slug: "underworld" }]);
    db.skill.findMany.mockResolvedValue([{ id: "s1" }]);

    const res = await syncCatalogueColumns();

    expect(res).toMatchObject({
      write: false,
      positionNames: 1,
      bigGuyLimits: 1,
      starRuleCategories: 1,
    });
    expect(db.position.update).not.toHaveBeenCalled();
    expect(db.roster.update).not.toHaveBeenCalled();
    expect(db.skill.updateMany).not.toHaveBeenCalled();
  });

  it("isole les étapes : une table absente n'interrompt pas le seed", async () => {
    db.position.findMany.mockRejectedValue(new Error("no such table"));
    db.roster.findMany.mockResolvedValue([{ id: "r1", slug: "underworld" }]);

    const res = await syncCatalogueColumns({ write: true });

    expect(res.positionNames).toBe(0);
    expect(res.bigGuyLimits).toBe(1);
  });
});
