/**
 * Tests pour le service TV recalc (Lot 3.C.5).
 *
 * Couvre :
 *   - `BASE_POSITION_COST` table : valeurs canoniques BB.
 *   - `computePlayerTv(position, skillCount)` : pure, somme base +
 *     N*SKILL_COST, fallback sur la valeur defaut.
 *   - `recomputePlayerTv(rosterId)` : I/O, recompute et UPDATE.
 *   - `sweepRecomputeTvs()` : cron, status='active', batch.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proTeamRoster: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  },
}));

import { prisma } from "../prisma";
import {
  BASE_POSITION_COST,
  computePlayerTv,
  computeStatBonusCost,
  DEFAULT_POSITION_COST,
  NIGGLING_MALUS,
  recomputePlayerTv,
  RecomputeTvError,
  SKILL_COST,
  STAT_INCREASE_COSTS,
  sweepRecomputeTvs,
} from "./pro-roster-tv";

interface MockedPrisma {
  proTeamRoster: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
}
const mocked = prisma as unknown as MockedPrisma;

beforeEach(() => {
  vi.clearAllMocks();
  mocked.proTeamRoster.update.mockResolvedValue({});
});

describe("BASE_POSITION_COST + SKILL_COST — Lot 3.C.5", () => {
  it("table reflete les costs BB rookies (Lineman 50k, Big Guy 140k)", () => {
    expect(BASE_POSITION_COST.Lineman).toBe(50_000);
    expect(BASE_POSITION_COST.Linewoman).toBe(50_000);
    expect(BASE_POSITION_COST["Big Guy"]).toBe(140_000);
    expect(BASE_POSITION_COST.Skink).toBe(60_000);
    expect(DEFAULT_POSITION_COST).toBe(50_000);
  });

  it("SKILL_COST = 20k (BB General skill)", () => {
    expect(SKILL_COST).toBe(20_000);
  });
});

describe("computePlayerTv — Lot 3.C.5", () => {
  it("Lineman + 0 skills = 50k", () => {
    expect(computePlayerTv("Lineman", 0)).toBe(50_000);
  });

  it("Lineman + 3 skills = 50k + 60k = 110k", () => {
    expect(computePlayerTv("Lineman", 3)).toBe(110_000);
  });

  it("Big Guy + 1 skill = 140k + 20k", () => {
    expect(computePlayerTv("Big Guy", 1)).toBe(160_000);
  });

  it("position inconnue -> fallback DEFAULT_POSITION_COST", () => {
    expect(computePlayerTv("FakePosition", 0)).toBe(DEFAULT_POSITION_COST);
    expect(computePlayerTv("", 0)).toBe(DEFAULT_POSITION_COST);
  });

  it("skillCount negatif -> traite comme 0", () => {
    expect(computePlayerTv("Lineman", -2)).toBe(50_000);
  });

  it("skillCount > 12 (max pool) -> bornee mais accepte (defense)", () => {
    expect(computePlayerTv("Lineman", 100)).toBe(50_000 + 100 * SKILL_COST);
  });

  it("Lot 4.D.1 — STAT_INCREASE_COSTS reflete BB officiel", () => {
    expect(STAT_INCREASE_COSTS.ma).toBe(30_000);
    expect(STAT_INCREASE_COSTS.ag).toBe(40_000);
    expect(STAT_INCREASE_COSTS.pa).toBe(20_000);
    expect(STAT_INCREASE_COSTS.av).toBe(30_000);
    expect(STAT_INCREASE_COSTS.st).toBe(80_000);
  });

  it("Lot 4.D.1 — computeStatBonusCost somme les bonuses ponderes", () => {
    expect(computeStatBonusCost({})).toBe(0);
    expect(computeStatBonusCost({ ma: 1 })).toBe(30_000);
    expect(computeStatBonusCost({ ma: 1, ag: 1, st: 1 })).toBe(
      30_000 + 40_000 + 80_000,
    );
  });

  it("Lot 4.D.1 — bonuses negatifs traites comme 0", () => {
    expect(computeStatBonusCost({ ma: -3 })).toBe(0);
  });

  it("Lot 4.D.1 — computePlayerTv inclut les stat bonuses (apres niggling param)", () => {
    // Lineman 50k + 1 skill 20k + 1 MA 30k = 100k. Niggling=0.
    expect(
      computePlayerTv("Lineman", 1, 0, { ma: 1 }),
    ).toBe(100_000);
  });

  it("Lot 4.D.1 — stat bonuses default {} pour rétrocompat", () => {
    expect(computePlayerTv("Lineman", 2)).toBe(50_000 + 2 * SKILL_COST);
  });

  it("Lot 4.D.3 — niggling=1 retire NIGGLING_MALUS du total", () => {
    expect(computePlayerTv("Lineman", 0, 1)).toBe(50_000 - NIGGLING_MALUS);
    expect(NIGGLING_MALUS).toBe(10_000);
  });

  it("Lot 4.D.3 — niggling=3 retire 3 * NIGGLING_MALUS", () => {
    expect(computePlayerTv("Big Guy", 1, 3)).toBe(
      140_000 + SKILL_COST - 3 * NIGGLING_MALUS,
    );
  });

  it("Lot 4.D.3 — niggling default 0 (rétrocompat)", () => {
    expect(computePlayerTv("Lineman", 2)).toBe(50_000 + 2 * SKILL_COST);
  });

  it("Lot 4.D.3 — niggling negatif traite comme 0", () => {
    expect(computePlayerTv("Lineman", 0, -3)).toBe(50_000);
  });

  it("Lot 4.D.3 — TV clampe a 0 si niggling depasse base + skills", () => {
    // 5 niggling sur Lineman 50k + 0 skill = -50k -> clampe a 0.
    expect(computePlayerTv("Lineman", 0, 6)).toBe(0);
  });
});

describe("recomputePlayerTv — Lot 3.C.5", () => {
  it("ROSTER_NOT_FOUND si l'id n'existe pas", async () => {
    mocked.proTeamRoster.findUnique.mockResolvedValue(null);
    await expect(recomputePlayerTv("missing")).rejects.toThrow(RecomputeTvError);
    await expect(recomputePlayerTv("missing")).rejects.toMatchObject({
      code: "ROSTER_NOT_FOUND",
    });
  });

  it("recompute Lineman avec 2 skills -> tvCached=90k", async () => {
    mocked.proTeamRoster.findUnique.mockResolvedValue({
      id: "r1",
      position: "Lineman",
      skills: ["block", "tackle"],
      tvCached: 50000,
    });
    const out = await recomputePlayerTv("r1");
    expect(out.skipped).toBe(false);
    expect(out.oldTv).toBe(50_000);
    expect(out.newTv).toBe(90_000);
    expect(mocked.proTeamRoster.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "r1" },
        data: { tvCached: 90_000 },
      }),
    );
  });

  it("idempotent : skip si tvCached deja a jour", async () => {
    mocked.proTeamRoster.findUnique.mockResolvedValue({
      id: "r2",
      position: "Lineman",
      skills: ["block"],
      tvCached: 70_000,
    });
    const out = await recomputePlayerTv("r2");
    expect(out.skipped).toBe(true);
    expect(out.skipReason).toBe("up_to_date");
    expect(mocked.proTeamRoster.update).not.toHaveBeenCalled();
  });

  it("supporte skills sous forme JSON string (mirror SQLite)", async () => {
    mocked.proTeamRoster.findUnique.mockResolvedValue({
      id: "r3",
      position: "Lineman",
      skills: '["block","tackle","frenzy"]',
      tvCached: 0,
    });
    const out = await recomputePlayerTv("r3");
    expect(out.newTv).toBe(50_000 + 3 * SKILL_COST);
  });

  it("skills mal formes (null / non-array) -> 0 skills", async () => {
    mocked.proTeamRoster.findUnique.mockResolvedValue({
      id: "r4",
      position: "Big Guy",
      skills: null,
      tvCached: 0,
    });
    const out = await recomputePlayerTv("r4");
    expect(out.newTv).toBe(140_000);
  });

  it("Lot 4.D.3 — applique le malus niggling depuis le DB", async () => {
    mocked.proTeamRoster.findUnique.mockResolvedValue({
      id: "r_inj",
      position: "Lineman",
      skills: ["block", "tackle"],
      niggling: 2,
      tvCached: 0,
    });
    const out = await recomputePlayerTv("r_inj");
    // 50k Lineman + 2 skills * 20k - 2 niggling * 10k = 70k
    expect(out.newTv).toBe(70_000);
  });
});

describe("sweepRecomputeTvs — Lot 3.C.5", () => {
  it("0/0/0 si aucun roster", async () => {
    mocked.proTeamRoster.findMany.mockResolvedValue([]);
    expect(await sweepRecomputeTvs()).toEqual({
      inspected: 0,
      processed: 0,
      failed: 0,
    });
  });

  it("filtre status='active' uniquement", async () => {
    mocked.proTeamRoster.findMany.mockResolvedValue([]);
    await sweepRecomputeTvs();
    expect(mocked.proTeamRoster.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "active" }),
      }),
    );
  });

  it("agrege processed (recomputes) + failed", async () => {
    mocked.proTeamRoster.findMany.mockResolvedValue([
      { id: "ok" },
      { id: "fail" },
    ]);
    mocked.proTeamRoster.findUnique
      .mockResolvedValueOnce({
        id: "ok",
        position: "Lineman",
        skills: ["block"],
        tvCached: 0,
      })
      .mockResolvedValueOnce(null); // -> ROSTER_NOT_FOUND -> failed
    const out = await sweepRecomputeTvs();
    expect(out.inspected).toBe(2);
    expect(out.processed).toBe(1);
    expect(out.failed).toBe(1);
  });
});
