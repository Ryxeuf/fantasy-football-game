/**
 * L2.C.2 — Tests du service `coach-league-championships.ts`.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    leagueSeasonAward: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "../prisma";
import { getCoachLeagueChampionships } from "./coach-league-championships";

const findMany = prisma.leagueSeasonAward.findMany as unknown as ReturnType<
  typeof vi.fn
>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCoachLeagueChampionships", () => {
  it("returns [] for empty/invalid userId", async () => {
    expect(await getCoachLeagueChampionships("")).toEqual([]);
    expect(await getCoachLeagueChampionships("   ")).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("returns [] when no award row matches", async () => {
    findMany.mockResolvedValue([]);
    const out = await getCoachLeagueChampionships("u-1");
    expect(out).toEqual([]);
  });

  it("maps award rows into CoachLeagueChampionship records", async () => {
    findMany.mockResolvedValue([
      {
        championUserId: "u-1",
        createdAt: new Date("2026-05-01T10:00:00.000Z"),
        season: {
          id: "season-1",
          seasonNumber: 1,
          name: "Saison 1",
          leagueId: "league-1",
          league: { id: "league-1", name: "Ligue Skaven" },
        },
      },
      {
        championUserId: "u-1",
        createdAt: new Date("2026-04-01T10:00:00.000Z"),
        season: {
          id: "season-2",
          seasonNumber: 2,
          name: "Saison Hiver",
          leagueId: "league-2",
          league: { id: "league-2", name: "Ligue Goblin" },
        },
      },
    ]);

    const out = await getCoachLeagueChampionships("u-1");
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      seasonId: "season-1",
      leagueId: "league-1",
      leagueName: "Ligue Skaven",
      seasonNumber: 1,
      seasonName: "Saison 1",
      label: "Champion Ligue Skaven — Saison 1",
      wonAt: "2026-05-01T10:00:00.000Z",
    });
    expect(out[1].label).toBe("Champion Ligue Goblin — Saison Hiver");
  });

  it("filters out rows where league relation is missing (defensive)", async () => {
    findMany.mockResolvedValue([
      {
        championUserId: "u-1",
        createdAt: new Date(),
        season: {
          id: "season-1",
          seasonNumber: 1,
          name: "Saison",
          leagueId: "league-1",
          league: null, // league deleted between snapshot and read
        },
      },
    ]);
    const out = await getCoachLeagueChampionships("u-1");
    expect(out).toEqual([]);
  });
});
