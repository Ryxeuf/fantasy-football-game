/**
 * Tests pour le service engine-comparison (Lot 3.B.2).
 *
 * Couvre :
 *  - validation des inputs (teams existantes, matches > 0).
 *  - appel du comparator pure (`compareDriversOnce`) N fois avec
 *    seedOffset, seedOffset+1, … (déterministe).
 *  - aggregation + persistence dans `EngineComparison`.
 *  - mise à jour des Prometheus gauges via `setEngineCompareStats`.
 *  - propagation des erreurs (sim throw) sans corrompre la DB.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    engineComparison: { create: vi.fn() },
  },
}));

vi.mock("@bb/sim-engine", async () => {
  const actual = await vi.importActual<typeof import("@bb/sim-engine")>(
    "@bb/sim-engine",
  );
  return {
    ...actual,
    compareDriversOnce: vi.fn(),
  };
});

import { prisma } from "../prisma";
import { compareDriversOnce } from "@bb/sim-engine";
import { runEngineComparison } from "./engine-comparison";
import type { MetricsRegistry } from "../utils/metrics";

interface MockedPrisma {
  engineComparison: { create: ReturnType<typeof vi.fn> };
}
const mocked = prisma as unknown as MockedPrisma;
const mockedCompare = compareDriversOnce as ReturnType<typeof vi.fn>;

function buildMetricsMock(): {
  registry: MetricsRegistry;
  setEngineCompareStats: ReturnType<typeof vi.fn>;
} {
  const setEngineCompareStats = vi.fn();
  const registry = {
    setEngineCompareStats,
  } as unknown as MetricsRegistry;
  return { registry, setEngineCompareStats };
}

function makeRun(deltaScore: number, outcomeChanged = false) {
  return {
    hybrid: { summary: { score: { home: 1, away: 1 } } },
    full: { summary: { score: { home: 1, away: 1 } } },
    deltas: {
      scoreHome: deltaScore,
      scoreAway: 0,
      scoreTotal: deltaScore,
      turnoverCount: 1,
      touchdownCount: 0,
      casualtyCount: 0,
      outcomeChanged,
    },
  };
}

describe("runEngineComparison — Lot 3.B.2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejette homeTeamId === awayTeamId", async () => {
    const { registry } = buildMetricsMock();
    await expect(
      runEngineComparison(
        {
          homeTeamId: "pit-smashers",
          awayTeamId: "pit-smashers",
          matches: 5,
          seedOffset: 0,
        },
        { metrics: registry },
      ),
    ).rejects.toThrow(/distincts/);
  });

  it("rejette une team qui n'existe pas dans PRO_LEAGUE_TEAM_BY_ID", async () => {
    const { registry } = buildMetricsMock();
    await expect(
      runEngineComparison(
        {
          homeTeamId: "pit-smashers",
          awayTeamId: "team-bidon-inexistante",
          matches: 5,
          seedOffset: 0,
        },
        { metrics: registry },
      ),
    ).rejects.toThrow(/inconnue/);
  });

  it("rejette matches <= 0", async () => {
    const { registry } = buildMetricsMock();
    await expect(
      runEngineComparison(
        {
          homeTeamId: "pit-smashers",
          awayTeamId: "kc-soaring-hawks",
          matches: 0,
          seedOffset: 0,
        },
        { metrics: registry },
      ),
    ).rejects.toThrow(/matches/);
  });

  it("appelle compareDriversOnce N fois avec des seeds incrémentés", async () => {
    mockedCompare.mockImplementation(() => makeRun(0));
    mocked.engineComparison.create.mockResolvedValue({ id: "ec-1" });
    const { registry } = buildMetricsMock();

    await runEngineComparison(
      {
        homeTeamId: "pit-smashers",
        awayTeamId: "kc-soaring-hawks",
        matches: 4,
        seedOffset: 100,
      },
      { metrics: registry },
    );

    expect(mockedCompare).toHaveBeenCalledTimes(4);
    const seedsUsed = mockedCompare.mock.calls.map(
      (c) => (c[0] as { seed: number }).seed,
    );
    expect(seedsUsed).toEqual([100, 101, 102, 103]);
  });

  it("agrège, persiste dans EngineComparison et update les gauges", async () => {
    mockedCompare
      .mockImplementationOnce(() => makeRun(0))
      .mockImplementationOnce(() => makeRun(2))
      .mockImplementationOnce(() => makeRun(0, true))
      .mockImplementationOnce(() => makeRun(0));
    mocked.engineComparison.create.mockResolvedValue({ id: "ec-42" });
    const { registry, setEngineCompareStats } = buildMetricsMock();

    const out = await runEngineComparison(
      {
        homeTeamId: "pit-smashers",
        awayTeamId: "kc-soaring-hawks",
        matches: 4,
        seedOffset: 0,
        source: "admin",
      },
      { metrics: registry },
    );

    expect(mocked.engineComparison.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          engineVer: expect.any(String),
          homeTeamId: "pit-smashers",
          awayTeamId: "kc-soaring-hawks",
          matches: 4,
          seedOffset: 0,
          source: "admin",
          outcomeFlippedCount: 1,
          // 2 runs out of 4 are diverged (scoreTotal=2 OR outcomeChanged) → 0.5
          divergedPct: 0.5,
        }),
      }),
    );
    expect(setEngineCompareStats).toHaveBeenCalledWith(
      expect.objectContaining({
        pairing: "pit-smashers__kc-soaring-hawks",
      }),
      expect.objectContaining({
        divergedPct: 0.5,
        outcomeFlippedPct: 0.25,
      }),
    );
    expect(out.id).toBe("ec-42");
    expect(out.aggregate.divergedPct).toBe(0.5);
  });

  it("propage l'erreur du comparator sans persister ni toucher les gauges", async () => {
    mockedCompare.mockImplementationOnce(() => {
      throw new Error("sim crashed");
    });
    const { registry, setEngineCompareStats } = buildMetricsMock();

    await expect(
      runEngineComparison(
        {
          homeTeamId: "pit-smashers",
          awayTeamId: "kc-soaring-hawks",
          matches: 5,
          seedOffset: 0,
        },
        { metrics: registry },
      ),
    ).rejects.toThrow(/sim crashed/);
    expect(mocked.engineComparison.create).not.toHaveBeenCalled();
    expect(setEngineCompareStats).not.toHaveBeenCalled();
  });

  it("source default 'admin' si non fourni", async () => {
    mockedCompare.mockImplementation(() => makeRun(0));
    mocked.engineComparison.create.mockResolvedValue({ id: "ec-x" });
    const { registry } = buildMetricsMock();

    await runEngineComparison(
      {
        homeTeamId: "pit-smashers",
        awayTeamId: "kc-soaring-hawks",
        matches: 1,
        seedOffset: 0,
      },
      { metrics: registry },
    );

    expect(mocked.engineComparison.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ source: "admin" }),
      }),
    );
  });
});
