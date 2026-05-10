/**
 * Tests pour le snapshot health (Lot 2.B.3 + extension 4.A.3).
 *
 * Couvre :
 *   - aggregation drift samples + drift alerts + bound alerts en un
 *     seul payload cohérent.
 *   - `counts.critical` = drift critical + bound alerts (qui sont
 *     toujours critical par construction Lot 4.A.3).
 *   - `lastSimAt` lit le dernier `proLeagueMatch.updatedAt` filtré sur
 *     `status='completed'` et `isTest=false`.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proLeagueMatch: { findFirst: vi.fn() },
  },
}));

vi.mock("./pro-league-engine-drift-watcher", async () => {
  const actual = await vi.importActual<
    typeof import("./pro-league-engine-drift-watcher")
  >("./pro-league-engine-drift-watcher");
  return {
    ...actual,
    computeEngineDrift: vi.fn(),
  };
});

vi.mock("./pro-league-race-bounds", async () => {
  const actual = await vi.importActual<
    typeof import("./pro-league-race-bounds")
  >("./pro-league-race-bounds");
  return {
    ...actual,
    detectRaceBoundAlerts: vi.fn(),
  };
});

import { prisma } from "../prisma";
import { computeEngineDrift } from "./pro-league-engine-drift-watcher";
import { detectRaceBoundAlerts } from "./pro-league-race-bounds";
import { computeSimHealthSnapshot } from "./pro-league-sim-health";

interface MockedPrisma {
  proLeagueMatch: { findFirst: ReturnType<typeof vi.fn> };
}
const mocked = prisma as unknown as MockedPrisma;
const mockedDrift = vi.mocked(computeEngineDrift);
const mockedBounds = vi.mocked(detectRaceBoundAlerts);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("computeSimHealthSnapshot — Lot 2.B.3", () => {
  it("aggrège samples + alerts + lastSimAt en un seul payload", async () => {
    mockedDrift.mockResolvedValueOnce([
      {
        metric: "tdMean",
        race: "Wood Elf",
        seasonId: "S2026",
        observed: 2.5,
        reference: 2.4,
        drift: 0.04,
        samples: 12,
      },
      // sample en drift critical (>25%) + samples >=5
      {
        metric: "tdMean",
        race: "Halfling",
        seasonId: "S2026",
        observed: 3.5,
        reference: 1.0,
        drift: 2.5,
        samples: 10,
      },
    ]);
    mockedBounds.mockReturnValueOnce([
      {
        severity: "critical",
        race: "Halfling",
        seasonId: "S2026",
        metric: "tdMean",
        direction: "above_max",
        observed: 3.5,
        bound: 1.5,
        samples: 10,
      },
    ]);
    mocked.proLeagueMatch.findFirst.mockResolvedValueOnce({
      updatedAt: new Date("2026-05-09T10:00:00Z"),
    });

    const out = await computeSimHealthSnapshot();
    expect(out.samples).toHaveLength(2);
    expect(out.driftAlerts).toHaveLength(1);
    expect(out.driftAlerts[0]?.severity).toBe("critical");
    expect(out.boundAlerts).toHaveLength(1);
    // Lot 4.A.3 — `counts.critical` cumule drift critical + bound alerts.
    expect(out.counts.critical).toBe(2);
    expect(out.counts.warn).toBe(0);
    expect(out.lastSimAt).toBe("2026-05-09T10:00:00.000Z");
    expect(typeof out.computedAt).toBe("string");
  });

  it("retourne lastSimAt=null si aucun match completed", async () => {
    mockedDrift.mockResolvedValueOnce([]);
    mockedBounds.mockReturnValueOnce([]);
    mocked.proLeagueMatch.findFirst.mockResolvedValueOnce(null);
    const out = await computeSimHealthSnapshot();
    expect(out.lastSimAt).toBeNull();
    expect(out.samples).toEqual([]);
    expect(out.driftAlerts).toEqual([]);
    expect(out.counts).toEqual({ warn: 0, critical: 0 });
  });

  it("filtre lastSimAt sur isTest=false (sandbox matches exclus)", async () => {
    mockedDrift.mockResolvedValueOnce([]);
    mockedBounds.mockReturnValueOnce([]);
    mocked.proLeagueMatch.findFirst.mockResolvedValueOnce(null);
    await computeSimHealthSnapshot();
    expect(mocked.proLeagueMatch.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "completed",
          isTest: false,
        }),
      }),
    );
  });

  it("propage seasonId au filtre lastSimAt", async () => {
    mockedDrift.mockResolvedValueOnce([]);
    mockedBounds.mockReturnValueOnce([]);
    mocked.proLeagueMatch.findFirst.mockResolvedValueOnce(null);
    await computeSimHealthSnapshot({ seasonId: "S2027" });
    expect(mocked.proLeagueMatch.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ seasonId: "S2027" }),
      }),
    );
  });

  it("propage now() override à computedAt", async () => {
    mockedDrift.mockResolvedValueOnce([]);
    mockedBounds.mockReturnValueOnce([]);
    mocked.proLeagueMatch.findFirst.mockResolvedValueOnce(null);
    const fixed = new Date("2026-01-01T00:00:00Z");
    const out = await computeSimHealthSnapshot({ now: fixed });
    expect(out.computedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("compte 0 critical quand pas d'alerte (drift dans tolerance)", async () => {
    mockedDrift.mockResolvedValueOnce([
      {
        metric: "tdMean",
        race: "Wood Elf",
        seasonId: "S2026",
        observed: 2.5,
        reference: 2.4,
        drift: 0.04,
        samples: 20,
      },
    ]);
    mockedBounds.mockReturnValueOnce([]);
    mocked.proLeagueMatch.findFirst.mockResolvedValueOnce({
      updatedAt: new Date("2026-05-08T00:00:00Z"),
    });
    const out = await computeSimHealthSnapshot();
    expect(out.counts.critical).toBe(0);
    expect(out.counts.warn).toBe(0);
  });
});
