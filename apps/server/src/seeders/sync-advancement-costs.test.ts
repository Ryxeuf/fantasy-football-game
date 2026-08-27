/**
 * Lot 6.2 — amorçage du barème d'avancement.
 *
 * Deux invariants : une valeur corrigée en admin n'est pas écrasée au
 * déploiement suivant, et la Saison 2 n'est PAS seedée par défaut (ses
 * valeurs attendent leur validation ; sans ligne, le comportement reste
 * celui d'avant le lot).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    advancementCost: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    characteristicValue: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    rulesetConfig: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("../services/advancement-schedule-repository", async () => {
  const actual = await vi.importActual<
    typeof import("../services/advancement-schedule-repository")
  >("../services/advancement-schedule-repository");
  return {
    ...actual,
    invalidateAdvancementScheduleCache: vi.fn(),
  };
});

import { prisma } from "../prisma";
import {
  SEASON_2_SCHEDULE,
  SEASON_3_SCHEDULE,
  syncAdvancementCosts,
} from "./sync-advancement-costs";

const db = prisma as unknown as {
  advancementCost: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  characteristicValue: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  rulesetConfig: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

beforeEach(() => {
  vi.resetAllMocks();
  db.advancementCost.findUnique.mockResolvedValue(null);
  db.characteristicValue.findUnique.mockResolvedValue(null);
  db.rulesetConfig.findUnique.mockResolvedValue(null);
});

describe("syncAdvancementCosts", () => {
  it("ne seede QUE la Saison 3 par défaut", async () => {
    const res = await syncAdvancementCosts({ write: true });

    expect(res.rulesets).toEqual(["season_3"]);
    expect(res.costsCreated).toBeGreaterThan(0);
    for (const call of db.advancementCost.create.mock.calls) {
      expect(call[0].data.ruleset).toBe("season_3");
    }
  });

  it("pose la Saison 2 quand on la demande explicitement", async () => {
    const res = await syncAdvancementCosts({
      write: true,
      rulesets: ["season_2"],
    });

    expect(res.rulesets).toEqual(["season_2"]);
    const secondary = db.advancementCost.create.mock.calls
      .map((c) => c[0].data)
      .filter((d) => d.kind === "secondary" && d.step === 1);
    // Livre 2020 : la secondaire choisie démarre à 12 PSP.
    expect(secondary[0].sppCost).toBe(12);
  });

  it("n'écrase pas une valeur existante sans `force`", async () => {
    db.advancementCost.findUnique.mockResolvedValue({ id: "a1" });
    db.characteristicValue.findUnique.mockResolvedValue({ id: "c1" });
    db.rulesetConfig.findUnique.mockResolvedValue({ id: "r1" });

    const res = await syncAdvancementCosts({ write: true });

    expect(res.costsCreated).toBe(0);
    expect(res.costsUpdated).toBe(0);
    expect(res.costsSkipped).toBeGreaterThan(0);
    expect(db.advancementCost.update).not.toHaveBeenCalled();
  });

  it("`force` réécrit la grille", async () => {
    db.advancementCost.findUnique.mockResolvedValue({ id: "a1" });
    db.characteristicValue.findUnique.mockResolvedValue({ id: "c1" });
    db.rulesetConfig.findUnique.mockResolvedValue({ id: "r1" });

    const res = await syncAdvancementCosts({ write: true, force: true });

    expect(res.costsUpdated).toBeGreaterThan(0);
    expect(db.advancementCost.update).toHaveBeenCalled();
  });

  it("dry-run par défaut", async () => {
    const res = await syncAdvancementCosts();
    expect(res.write).toBe(false);
    expect(db.advancementCost.create).not.toHaveBeenCalled();
  });
});

describe("barèmes transcrits", () => {
  it("la Saison 3 reprend exactement les valeurs compilées", () => {
    expect(SEASON_3_SCHEDULE.sppCost.secondary).toEqual([
      10, 12, 16, 20, 24, 34,
    ]);
    expect(SEASON_3_SCHEDULE.surcharge.secondary).toBe(40000);
    expect(SEASON_3_SCHEDULE.eliteSkillSurcharge).toBe(10000);
  });

  it("la Saison 2 porte les valeurs du livre 2020", () => {
    expect(SEASON_2_SCHEDULE.sppCost.secondary[0]).toBe(12);
    expect(SEASON_2_SCHEDULE.sppCost.characteristic).toEqual([
      18, 20, 24, 28, 32, 40,
    ]);
    expect(SEASON_2_SCHEDULE.surcharge.random_secondary).toBe(20000);
    // Les compétences Élite sont une notion Saison 3 : pas de taxe en S2.
    expect(SEASON_2_SCHEDULE.eliteSkillSurcharge).toBe(0);
  });
});
