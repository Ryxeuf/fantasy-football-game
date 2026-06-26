/**
 * Lot J — Tests du service `league-player-stats`.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    leagueParticipant: { findMany: vi.fn() },
    teamPlayer: { findMany: vi.fn() },
    leagueMatchEvent: { findMany: vi.fn() },
  },
}));

import { prisma } from "../prisma";
import {
  computeLeaderboards,
  computeLeaderboardsByTeam,
  LEADERBOARD_CATEGORIES,
} from "./league-player-stats";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;

function player(overrides: Partial<{
  id: string;
  name: string;
  totalTouchdowns: number;
  totalCasualties: number;
  totalCompletions: number;
  totalInterceptions: number;
  totalMvpAwards: number;
  matchesPlayed: number;
  spp: number;
  nigglingInjuries: number;
  teamId: string;
  teamName: string;
}>) {
  return {
    id: overrides.id ?? "p1",
    name: overrides.name ?? "Player",
    position: "Lineman",
    spp: overrides.spp ?? 0,
    totalTouchdowns: overrides.totalTouchdowns ?? 0,
    totalCasualties: overrides.totalCasualties ?? 0,
    totalCompletions: overrides.totalCompletions ?? 0,
    totalInterceptions: overrides.totalInterceptions ?? 0,
    totalMvpAwards: overrides.totalMvpAwards ?? 0,
    matchesPlayed: overrides.matchesPlayed ?? 1,
    nigglingInjuries: overrides.nigglingInjuries ?? 0,
    team: {
      id: overrides.teamId ?? "team-1",
      name: overrides.teamName ?? "Team",
      roster: "skaven",
      owner: { id: "u1", coachName: "Bob" },
    },
  };
}

describe("Lot J — league-player-stats", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("computeLeaderboards", () => {
    it("returns empty catalogue when no teams in season", async () => {
      mockPrisma.leagueParticipant.findMany.mockResolvedValue([]);
      const out = await computeLeaderboards({ seasonId: "s1" });
      expect(out.topScorers).toEqual([]);
      expect(out.topBashers).toEqual([]);
      expect(out.scope).toBe("career");
    });

    it("returns top scorers ordered DESC, top 5 by default", async () => {
      mockPrisma.leagueParticipant.findMany.mockResolvedValue([
        { teamId: "team-1" },
      ]);
      mockPrisma.teamPlayer.findMany.mockResolvedValue([
        player({ id: "p1", totalTouchdowns: 5 }),
        player({ id: "p2", totalTouchdowns: 12 }),
        player({ id: "p3", totalTouchdowns: 8 }),
        player({ id: "p4", totalTouchdowns: 3 }),
        player({ id: "p5", totalTouchdowns: 0 }), // filtered (0)
        player({ id: "p6", totalTouchdowns: 10 }),
        player({ id: "p7", totalTouchdowns: 4 }),
      ]);
      const out = await computeLeaderboards({ seasonId: "s1" });
      expect(out.topScorers.map((r) => r.playerId)).toEqual([
        "p2",
        "p6",
        "p3",
        "p1",
        "p7",
      ]);
      expect(out.topScorers[0].rank).toBe(1);
      expect(out.topScorers[0].value).toBe(12);
    });

    it("includes secondary stats (matchesPlayed + spp)", async () => {
      mockPrisma.leagueParticipant.findMany.mockResolvedValue([
        { teamId: "team-1" },
      ]);
      mockPrisma.teamPlayer.findMany.mockResolvedValue([
        player({ id: "p1", totalCasualties: 4, matchesPlayed: 8, spp: 24 }),
      ]);
      const out = await computeLeaderboards({ seasonId: "s1" });
      expect(out.topBashers[0].secondary).toEqual({
        matchesPlayed: 8,
        spp: 24,
      });
    });

    it("filters out players with zero on the metric", async () => {
      mockPrisma.leagueParticipant.findMany.mockResolvedValue([
        { teamId: "team-1" },
      ]);
      mockPrisma.teamPlayer.findMany.mockResolvedValue([
        player({ id: "p1", totalCompletions: 3 }),
        player({ id: "p2", totalCompletions: 0 }),
      ]);
      const out = await computeLeaderboards({ seasonId: "s1" });
      expect(out.topPassers).toHaveLength(1);
      expect(out.topPassers[0].playerId).toBe("p1");
    });

    it("clamps topN to [1, 50]", async () => {
      mockPrisma.leagueParticipant.findMany.mockResolvedValue([]);
      const a = await computeLeaderboards({ seasonId: "s1", topN: 0 });
      expect(a.topN).toBe(1);
      const b = await computeLeaderboards({ seasonId: "s1", topN: 1000 });
      expect(b.topN).toBe(50);
      const c = await computeLeaderboards({ seasonId: "s1", topN: 7 });
      expect(c.topN).toBe(7);
    });

    it("filters by teamId when provided", async () => {
      mockPrisma.leagueParticipant.findMany.mockResolvedValue([
        { teamId: "team-2" },
      ]);
      mockPrisma.teamPlayer.findMany.mockResolvedValue([
        player({ id: "p1", teamId: "team-2", totalTouchdowns: 3 }),
      ]);
      const out = await computeLeaderboards({
        seasonId: "s1",
        teamId: "team-2",
      });
      // verifie le where Prisma
      const callArgs = mockPrisma.leagueParticipant.findMany.mock.calls[0][0];
      expect(callArgs.where.teamId).toBe("team-2");
      expect(out.topScorers).toHaveLength(1);
    });

    it("returns multiple categories in one pass", async () => {
      mockPrisma.leagueParticipant.findMany.mockResolvedValue([
        { teamId: "team-1" },
      ]);
      mockPrisma.teamPlayer.findMany.mockResolvedValue([
        player({
          id: "p1",
          totalTouchdowns: 5,
          totalCasualties: 7,
          totalCompletions: 12,
          spp: 33,
        }),
        player({
          id: "p2",
          totalTouchdowns: 2,
          totalCasualties: 9,
          totalCompletions: 4,
          spp: 21,
        }),
      ]);
      const out = await computeLeaderboards({ seasonId: "s1" });
      expect(out.topScorers[0].playerId).toBe("p1");
      expect(out.topBashers[0].playerId).toBe("p2");
      expect(out.topFutureStars[0].playerId).toBe("p1");
    });
  });

  describe("computeLeaderboardsByTeam", () => {
    it("returns one catalogue per team", async () => {
      // 1er findMany : list teams ; ensuite 1 findMany participants + 1 findMany players par team.
      mockPrisma.leagueParticipant.findMany
        .mockResolvedValueOnce([
          { team: { id: "team-1", name: "Alpha" } },
          { team: { id: "team-2", name: "Beta" } },
        ])
        // computeLeaderboards("s1", teamId=team-1) -> 1 participant
        .mockResolvedValueOnce([{ teamId: "team-1" }])
        .mockResolvedValueOnce([{ teamId: "team-2" }]);

      mockPrisma.teamPlayer.findMany
        .mockResolvedValueOnce([
          player({ id: "pa", totalTouchdowns: 3, teamId: "team-1" }),
        ])
        .mockResolvedValueOnce([
          player({ id: "pb", totalTouchdowns: 5, teamId: "team-2" }),
        ]);

      const out = await computeLeaderboardsByTeam({ seasonId: "s1" });
      expect(out).toHaveLength(2);
      expect(out[0].teamId).toBe("team-1");
      expect(out[0].catalogue.topScorers[0].playerId).toBe("pa");
      expect(out[1].teamId).toBe("team-2");
      expect(out[1].catalogue.topScorers[0].playerId).toBe("pb");
    });
  });

  describe("LEADERBOARD_CATEGORIES", () => {
    it("exposes the 9 categories (incl. killer/aggressor)", () => {
      const keys = LEADERBOARD_CATEGORIES.map((c) => c.key);
      expect(keys).toEqual([
        "topScorers",
        "topBashers",
        "topKillers",
        "topAggressors",
        "topPassers",
        "topInterceptors",
        "topFutureStars",
        "topMvps",
        "topPunchingBags",
      ]);
    });
  });

  describe("FR18 — killers / aggressors (events de saison)", () => {
    it("classe killers (casualty+dead) et agresseurs (aggression) par acteur", async () => {
      mockPrisma.leagueParticipant.findMany.mockResolvedValue([
        { teamId: "T1" },
      ]);
      mockPrisma.teamPlayer.findMany.mockResolvedValue([
        player({ id: "p1", name: "Tueur", teamId: "T1" }),
        player({ id: "p2", name: "Brute", teamId: "T1" }),
      ]);
      mockPrisma.leagueMatchEvent.findMany.mockResolvedValue([
        { kind: "casualty", actorPlayerId: "p1", injurySeverity: "dead" },
        { kind: "casualty", actorPlayerId: "p1", injurySeverity: "dead" },
        { kind: "casualty", actorPlayerId: "p2", injurySeverity: "mng" },
        { kind: "aggression", actorPlayerId: "p2", injurySeverity: null },
      ]);
      const cat = await computeLeaderboards({ seasonId: "S1", topN: 5 });
      expect(cat.topKillers.map((r) => [r.playerId, r.value])).toEqual([
        ["p1", 2],
      ]);
      expect(cat.topAggressors.map((r) => [r.playerId, r.value])).toEqual([
        ["p2", 1],
      ]);
    });

    it("classements events vides si le modèle est indisponible (tolérant)", async () => {
      mockPrisma.leagueParticipant.findMany.mockResolvedValue([
        { teamId: "T1" },
      ]);
      mockPrisma.teamPlayer.findMany.mockResolvedValue([
        player({ id: "p1", teamId: "T1" }),
      ]);
      mockPrisma.leagueMatchEvent.findMany.mockRejectedValue(new Error("no model"));
      const cat = await computeLeaderboards({ seasonId: "S1", topN: 5 });
      expect(cat.topKillers).toEqual([]);
      expect(cat.topAggressors).toEqual([]);
    });
  });
});
