/**
 * Lot J — Tests du service `league-player-stats`.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    leagueParticipant: { findMany: vi.fn() },
    teamPlayer: { findMany: vi.fn() },
    leagueMatchEvent: { findMany: vi.fn() },
    leagueMatchSheet: { findMany: vi.fn() },
    roster: { findMany: vi.fn() },
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
  position: string;
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
  roster: string;
}>) {
  return {
    id: overrides.id ?? "p1",
    name: overrides.name ?? "Player",
    position: overrides.position ?? "Lineman",
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
      roster: overrides.roster ?? "skaven",
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

    it("E16 — maps position/roster slugs to display names (no underscores)", async () => {
      mockPrisma.leagueParticipant.findMany.mockResolvedValue([
        { teamId: "team-1" },
      ]);
      mockPrisma.teamPlayer.findMany.mockResolvedValue([
        player({
          id: "p1",
          totalTouchdowns: 3,
          position: "skaven_rat_des_clans_skaven",
          roster: "skaven",
        }),
        player({
          id: "p2",
          totalTouchdowns: 1,
          position: "unknown_position_slug",
          roster: "unknown_roster",
        }),
      ]);
      const out = await computeLeaderboards({ seasonId: "s1" });
      const p1 = out.topScorers.find((r) => r.playerId === "p1");
      const p2 = out.topScorers.find((r) => r.playerId === "p2");
      expect(p1?.position).toBe("Rat des clans Skaven");
      expect(p1?.teamRoster).toBe("Skavens");
      // Fallback : jamais d'underscores affichés, même slug inconnu.
      expect(p2?.position).toBe("unknown position slug");
      expect(p2?.teamRoster).toBe("unknown roster");
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
    it("exposes the 10 categories (incl. killer/aggressor/catapulte)", () => {
      const keys = LEADERBOARD_CATEGORIES.map((c) => c.key);
      expect(keys).toEqual([
        "topScorers",
        "topBashers",
        "topKillers",
        "topAggressors",
        "topTeamThrowers",
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

    it("classe lanceurs de coéquipier (team_throw) et sac de frappe sur events", async () => {
      mockPrisma.leagueParticipant.findMany.mockResolvedValue([
        { teamId: "T1" },
      ]);
      mockPrisma.teamPlayer.findMany.mockResolvedValue([
        player({ id: "p1", teamId: "T1" }),
        player({ id: "p2", teamId: "T1" }),
      ]);
      mockPrisma.leagueMatchEvent.findMany.mockResolvedValue([
        { kind: "team_throw", actorPlayerId: "p1", targetPlayerId: "p2", injurySeverity: null },
        { kind: "casualty", actorPlayerId: "p1", targetPlayerId: "p2", injurySeverity: "mng" },
        { kind: "crowd_surge", actorPlayerId: null, targetPlayerId: "p2", injurySeverity: null },
      ]);
      const cat = await computeLeaderboards({ seasonId: "S1", topN: 5 });
      expect(cat.topTeamThrowers.map((r) => [r.playerId, r.value])).toEqual([
        ["p1", 1],
      ]);
      // p2 a subi 2 éliminations (casualty + crowd_surge) -> sac de frappe.
      expect(cat.topPunchingBags.map((r) => [r.playerId, r.value])).toEqual([
        ["p2", 2],
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
      // Repli career : pas d'events -> scope career.
      expect(cat.scope).toBe("career");
    });

    it("scope=season : marqueurs/passeurs/intercepteurs dérivés des events", async () => {
      mockPrisma.leagueParticipant.findMany.mockResolvedValue([
        { teamId: "T1" },
      ]);
      mockPrisma.teamPlayer.findMany.mockResolvedValue([
        // career: p1 a 12 TD, mais la saison ne compte que les events.
        player({ id: "p1", teamId: "T1", totalTouchdowns: 12 }),
        player({ id: "p2", teamId: "T1", totalTouchdowns: 0 }),
      ]);
      mockPrisma.leagueMatchEvent.findMany.mockResolvedValue([
        { kind: "touchdown", actorPlayerId: "p2", targetPlayerId: null, injurySeverity: null },
        { kind: "touchdown", actorPlayerId: "p2", targetPlayerId: null, injurySeverity: null },
        { kind: "pass_complete", actorPlayerId: "p1", targetPlayerId: null, injurySeverity: null },
        { kind: "interception", actorPlayerId: "p1", targetPlayerId: null, injurySeverity: null },
      ]);
      const cat = await computeLeaderboards({ seasonId: "S1", topN: 5 });
      expect(cat.scope).toBe("season");
      // Marqueur de la saison = p2 (2 TD events), pas p1 (12 TD career).
      expect(cat.topScorers.map((r) => [r.playerId, r.value])).toEqual([
        ["p2", 2],
      ]);
      expect(cat.topPassers.map((r) => [r.playerId, r.value])).toEqual([
        ["p1", 1],
      ]);
      expect(cat.topInterceptors.map((r) => [r.playerId, r.value])).toEqual([
        ["p1", 1],
      ]);
    });
  });

  describe("FR18 — MVP & Future Star par saison", () => {
    it("MVP de saison = agrégation des motmPlayerIds (vs compteur career)", async () => {
      mockPrisma.leagueParticipant.findMany.mockResolvedValue([
        { teamId: "T1" },
      ]);
      mockPrisma.teamPlayer.findMany.mockResolvedValue([
        // p1 a 9 MVP career mais 0 cette saison -> ne doit PAS sortir.
        player({ id: "p1", teamId: "T1", totalMvpAwards: 9 }),
        player({ id: "p2", teamId: "T1", totalMvpAwards: 0 }),
        player({ id: "p3", teamId: "T1", totalMvpAwards: 0 }),
      ]);
      // Un event suffit a basculer en scope saison.
      mockPrisma.leagueMatchEvent.findMany.mockResolvedValue([
        { kind: "touchdown", actorPlayerId: "p1", targetPlayerId: null, injurySeverity: null },
      ]);
      mockPrisma.leagueMatchSheet.findMany.mockResolvedValue([
        { motmPlayerIds: ["p2", "p3"] },
        { motmPlayerIds: ["p2"] },
      ]);
      mockPrisma.roster.findMany.mockResolvedValue([]);

      const cat = await computeLeaderboards({ seasonId: "S1", topN: 5 });
      expect(cat.scope).toBe("season");
      // p2 = 2 titres, p3 = 1 ; p1 (career) absent.
      expect(cat.topMvps.map((r) => [r.playerId, r.value])).toEqual([
        ["p2", 2],
        ["p3", 1],
      ]);
    });

    it("Future Star de saison = PSP recalculés (events + MVP), pas le spp career", async () => {
      mockPrisma.leagueParticipant.findMany.mockResolvedValue([
        { teamId: "T1" },
      ]);
      mockPrisma.teamPlayer.findMany.mockResolvedValue([
        // p1 a 99 spp career mais on doit voir ses PSP DE SAISON.
        player({ id: "p1", teamId: "T1", spp: 99 }),
        player({ id: "p2", teamId: "T1", spp: 0 }),
      ]);
      mockPrisma.leagueMatchEvent.findMany.mockResolvedValue([
        // p1 : 2 TD (3 PSP chacun) = 6
        { kind: "touchdown", actorPlayerId: "p1", targetPlayerId: null, injurySeverity: null },
        { kind: "touchdown", actorPlayerId: "p1", targetPlayerId: null, injurySeverity: null },
        // p2 : 1 casualty (2) + 1 completion (1) = 3
        { kind: "casualty", actorPlayerId: "p2", targetPlayerId: "p1", injurySeverity: "mng" },
        { kind: "pass_complete", actorPlayerId: "p2", targetPlayerId: null, injurySeverity: null },
      ]);
      // p1 MVP une fois (+4) -> 6 + 4 = 10.
      mockPrisma.leagueMatchSheet.findMany.mockResolvedValue([
        { motmPlayerIds: ["p1"] },
      ]);
      mockPrisma.roster.findMany.mockResolvedValue([]);

      const cat = await computeLeaderboards({ seasonId: "S1", topN: 5 });
      expect(cat.scope).toBe("season");
      expect(cat.topFutureStars.map((r) => [r.playerId, r.value])).toEqual([
        ["p1", 10],
        ["p2", 3],
      ]);
    });

    it("Future Star applique l'override Bagarreurs Brutaux du roster", async () => {
      mockPrisma.leagueParticipant.findMany.mockResolvedValue([
        { teamId: "T1" },
      ]);
      mockPrisma.teamPlayer.findMany.mockResolvedValue([
        player({ id: "p1", teamId: "T1", roster: "orc" }),
      ]);
      // 2 TD : vanilla = 6 PSP ; Bagarreurs Brutaux = 2 PSP/TD -> 4.
      mockPrisma.leagueMatchEvent.findMany.mockResolvedValue([
        { kind: "touchdown", actorPlayerId: "p1", targetPlayerId: null, injurySeverity: null },
        { kind: "touchdown", actorPlayerId: "p1", targetPlayerId: null, injurySeverity: null },
      ]);
      mockPrisma.leagueMatchSheet.findMany.mockResolvedValue([]);
      mockPrisma.roster.findMany.mockResolvedValue([
        { slug: "orc", specialRules: "bagarreurs_brutaux" },
      ]);

      const cat = await computeLeaderboards({ seasonId: "S1", topN: 5 });
      expect(cat.topFutureStars.map((r) => [r.playerId, r.value])).toEqual([
        ["p1", 4],
      ]);
    });

    it("repli career pour MVP & Future Star quand aucun event de saison", async () => {
      mockPrisma.leagueParticipant.findMany.mockResolvedValue([
        { teamId: "T1" },
      ]);
      mockPrisma.teamPlayer.findMany.mockResolvedValue([
        player({ id: "p1", teamId: "T1", totalMvpAwards: 3, spp: 50 }),
        player({ id: "p2", teamId: "T1", totalMvpAwards: 1, spp: 80 }),
      ]);
      mockPrisma.leagueMatchEvent.findMany.mockRejectedValue(new Error("no model"));

      const cat = await computeLeaderboards({ seasonId: "S1", topN: 5 });
      expect(cat.scope).toBe("career");
      expect(cat.topMvps.map((r) => [r.playerId, r.value])).toEqual([
        ["p1", 3],
        ["p2", 1],
      ]);
      expect(cat.topFutureStars.map((r) => [r.playerId, r.value])).toEqual([
        ["p2", 80],
        ["p1", 50],
      ]);
    });
  });
});
