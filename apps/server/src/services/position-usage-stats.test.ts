import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    teamPlayer: {
      groupBy: vi.fn(),
    },
  },
}));

import { getRosterPositionStats } from "./position-usage-stats";
import { prisma } from "../prisma";

interface MockedPrisma {
  teamPlayer: { groupBy: ReturnType<typeof vi.fn> };
}
const mockedPrisma = prisma as unknown as MockedPrisma;

beforeEach(() => {
  vi.resetAllMocks();
});

describe("getRosterPositionStats", () => {
  it("agrège le compte + les moyennes carrière par position", async () => {
    mockedPrisma.teamPlayer.groupBy.mockResolvedValue([
      {
        position: "Coureur d'Égouts",
        _count: { _all: 4 },
        _sum: {
          spp: 80,
          totalTouchdowns: 20,
          totalCasualties: 6,
          totalMvpAwards: 4,
          matchesPlayed: 40,
        },
      },
      {
        position: "Lanceur Skaven",
        _count: { _all: 2 },
        _sum: {
          spp: 10,
          totalTouchdowns: 1,
          totalCasualties: 0,
          totalMvpAwards: 1,
          matchesPlayed: 8,
        },
      },
    ]);

    const stats = await getRosterPositionStats("skaven", "season_3");

    expect(stats.totalPlayers).toBe(6);
    expect(stats.byPosition["Coureur d'Égouts"]).toEqual({
      count: 4,
      matchesPlayed: 40,
      avgSpp: 20,
      avgTouchdowns: 5,
      avgCasualties: 1.5,
      avgMvp: 1,
    });
    expect(stats.byPosition["Lanceur Skaven"].avgSpp).toBe(5);
  });

  it("scope la requête au roster + ruleset", async () => {
    mockedPrisma.teamPlayer.groupBy.mockResolvedValue([]);
    await getRosterPositionStats("amazon", "season_3");
    const arg = mockedPrisma.teamPlayer.groupBy.mock.calls[0][0];
    expect(arg.where).toEqual({
      team: { roster: "amazon", ruleset: "season_3" },
    });
    expect(arg.by).toEqual(["position"]);
  });

  it("gère les sommes nulles et l'absence de joueurs sans diviser par zéro", async () => {
    mockedPrisma.teamPlayer.groupBy.mockResolvedValue([
      {
        position: "Rat Ogre",
        _count: { _all: 0 },
        _sum: {
          spp: null,
          totalTouchdowns: null,
          totalCasualties: null,
          totalMvpAwards: null,
          matchesPlayed: null,
        },
      },
    ]);
    const stats = await getRosterPositionStats("skaven", "season_3");
    expect(stats.byPosition["Rat Ogre"]).toEqual({
      count: 0,
      matchesPlayed: 0,
      avgSpp: 0,
      avgTouchdowns: 0,
      avgCasualties: 0,
      avgMvp: 0,
    });
  });
});
