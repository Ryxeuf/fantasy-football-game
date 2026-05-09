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
  DEFAULT_POSITION_COST,
  recomputePlayerTv,
  RecomputeTvError,
  SKILL_COST,
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
