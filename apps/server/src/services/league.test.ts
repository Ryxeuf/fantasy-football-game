/**
 * L.1 — Tests du service de ligue (League / LeagueSeason /
 * LeagueParticipant / LeagueRound).
 *
 * Sprint 17 — infrastructure competitive : ligues.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    league: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    leagueSeason: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    leagueParticipant: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    leagueRound: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    team: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "../prisma";
import {
  createLeague,
  createSeason,
  addParticipant,
  createRound,
  listLeagues,
} from "./league";

const mockPrisma = prisma as any;

describe("Rule: League service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const creatorId = "user-creator";
  const teamId = "team-1";
  const leagueId = "league-1";
  const seasonId = "season-1";

  describe("createLeague", () => {
    it("creates a league with default status 'draft' and sensible defaults", async () => {
      const created = {
        id: leagueId,
        name: "Open 5 Teams",
        description: null,
        creatorId,
        ruleset: "season_3",
        status: "draft",
        isPublic: true,
        maxParticipants: 16,
        allowedRosters: null,
        winPoints: 3,
        drawPoints: 1,
        lossPoints: 0,
        forfeitPoints: -1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.league.create.mockResolvedValue(created);

      const result = await createLeague({
        creatorId,
        name: "Open 5 Teams",
      });

      expect(result.id).toBe(leagueId);
      expect(result.status).toBe("draft");
      expect(mockPrisma.league.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "Open 5 Teams",
          creatorId,
        }),
      });
    });

    it("accepts an allowedRosters list and serializes it to JSON", async () => {
      mockPrisma.league.create.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => ({
          id: leagueId,
          description: null,
          status: "draft",
          isPublic: true,
          maxParticipants: 16,
          winPoints: 3,
          drawPoints: 1,
          lossPoints: 0,
          forfeitPoints: -1,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        }),
      );

      const result = await createLeague({
        creatorId,
        name: "Open 5 Teams",
        allowedRosters: [
          "skaven",
          "gnomes",
          "lizardmen",
          "dwarf",
          "imperial_nobility",
        ],
      });

      expect(result.allowedRosters).toBe(
        JSON.stringify([
          "skaven",
          "gnomes",
          "lizardmen",
          "dwarf",
          "imperial_nobility",
        ]),
      );
    });

    it("rejects empty league name", async () => {
      await expect(
        createLeague({ creatorId, name: "   " }),
      ).rejects.toThrow(/nom/i);
      expect(mockPrisma.league.create).not.toHaveBeenCalled();
    });

    it("rejects invalid maxParticipants", async () => {
      await expect(
        createLeague({ creatorId, name: "L", maxParticipants: 1 }),
      ).rejects.toThrow(/participants/i);
      expect(mockPrisma.league.create).not.toHaveBeenCalled();
    });
  });

  describe("createSeason", () => {
    it("creates a season with the next season number when none supplied", async () => {
      mockPrisma.league.findUnique.mockResolvedValue({ id: leagueId });
      mockPrisma.leagueSeason.findFirst.mockResolvedValue({
        seasonNumber: 2,
      });
      const created = {
        id: seasonId,
        leagueId,
        seasonNumber: 3,
        name: "Saison 3",
        status: "draft",
        startDate: null,
        endDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.leagueSeason.create.mockResolvedValue(created);

      const result = await createSeason({
        leagueId,
        name: "Saison 3",
      });

      expect(result.seasonNumber).toBe(3);
      expect(mockPrisma.leagueSeason.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          leagueId,
          seasonNumber: 3,
          name: "Saison 3",
        }),
      });
    });

    it("creates the first season when the league has none yet", async () => {
      mockPrisma.league.findUnique.mockResolvedValue({ id: leagueId });
      mockPrisma.leagueSeason.findFirst.mockResolvedValue(null);
      mockPrisma.leagueSeason.create.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => ({
          id: seasonId,
          status: "draft",
          startDate: null,
          endDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        }),
      );

      const result = await createSeason({
        leagueId,
        name: "Saison 1",
      });

      expect(result.seasonNumber).toBe(1);
    });

    it("rejects when the league is unknown", async () => {
      mockPrisma.league.findUnique.mockResolvedValue(null);

      await expect(
        createSeason({ leagueId: "nope", name: "X" }),
      ).rejects.toThrow(/ligue|league|introuvable|not found/i);
      expect(mockPrisma.leagueSeason.create).not.toHaveBeenCalled();
    });
  });

  describe("addParticipant", () => {
    it("creates a participant with initial seasonElo of 1000", async () => {
      mockPrisma.leagueSeason.findUnique.mockResolvedValue({
        id: seasonId,
        status: "draft",
        league: { maxParticipants: 16 },
      });
      mockPrisma.team.findUnique.mockResolvedValue({ id: teamId });
      mockPrisma.leagueParticipant.findUnique.mockResolvedValue(null);
      mockPrisma.leagueParticipant.count.mockResolvedValue(2);
      const created = {
        id: "participant-1",
        seasonId,
        teamId,
        seasonElo: 1000,
        wins: 0,
        draws: 0,
        losses: 0,
        points: 0,
        touchdownsFor: 0,
        touchdownsAgainst: 0,
        casualtiesFor: 0,
        casualtiesAgainst: 0,
        status: "active",
        joinedAt: new Date(),
      };
      mockPrisma.leagueParticipant.create.mockResolvedValue(created);

      const result = await addParticipant({ seasonId, teamId });

      expect(result.seasonElo).toBe(1000);
      expect(result.points).toBe(0);
      expect(mockPrisma.leagueParticipant.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ seasonId, teamId }),
      });
    });

    it("rejects when the season is full", async () => {
      mockPrisma.leagueSeason.findUnique.mockResolvedValue({
        id: seasonId,
        status: "draft",
        league: { maxParticipants: 4 },
      });
      mockPrisma.team.findUnique.mockResolvedValue({ id: teamId });
      mockPrisma.leagueParticipant.findUnique.mockResolvedValue(null);
      mockPrisma.leagueParticipant.count.mockResolvedValue(4);

      await expect(addParticipant({ seasonId, teamId })).rejects.toThrow(
        /complete|full|saturee/i,
      );
      expect(mockPrisma.leagueParticipant.create).not.toHaveBeenCalled();
    });

    it("rejects duplicate registration", async () => {
      mockPrisma.leagueSeason.findUnique.mockResolvedValue({
        id: seasonId,
        status: "draft",
        league: { maxParticipants: 16 },
      });
      mockPrisma.team.findUnique.mockResolvedValue({ id: teamId });
      mockPrisma.leagueParticipant.findUnique.mockResolvedValue({
        id: "existing",
      });

      await expect(addParticipant({ seasonId, teamId })).rejects.toThrow(
        /deja|already/i,
      );
      expect(mockPrisma.leagueParticipant.create).not.toHaveBeenCalled();
    });

    it("rejects when the season is in progress or completed", async () => {
      mockPrisma.leagueSeason.findUnique.mockResolvedValue({
        id: seasonId,
        status: "in_progress",
        league: { maxParticipants: 16 },
      });
      mockPrisma.team.findUnique.mockResolvedValue({ id: teamId });

      await expect(addParticipant({ seasonId, teamId })).rejects.toThrow(
        /cours|progress|fermee|closed/i,
      );
      expect(mockPrisma.leagueParticipant.create).not.toHaveBeenCalled();
    });

    it("L.8 — soft-resets seasonElo from owner's global eloRating when carryOverFromGlobal=true", async () => {
      mockPrisma.leagueSeason.findUnique.mockResolvedValue({
        id: seasonId,
        status: "draft",
        league: { maxParticipants: 16 },
      });
      mockPrisma.team.findUnique.mockResolvedValue({
        id: teamId,
        owner: { eloRating: 1400 },
      });
      mockPrisma.leagueParticipant.findUnique.mockResolvedValue(null);
      mockPrisma.leagueParticipant.count.mockResolvedValue(0);
      mockPrisma.leagueParticipant.create.mockImplementation(
        async (args: { data: { seasonElo: number } }) => ({
          id: "participant-1",
          ...args.data,
        }),
      );

      await addParticipant({ seasonId, teamId, carryOverFromGlobal: true });

      // 1000 + (1400-1000)*0.25 = 1100
      expect(mockPrisma.leagueParticipant.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ seasonElo: 1100 }),
      });
    });

    it("L.8 — defaults to 1000 when carryOverFromGlobal=true but owner has no eloRating", async () => {
      mockPrisma.leagueSeason.findUnique.mockResolvedValue({
        id: seasonId,
        status: "draft",
        league: { maxParticipants: 16 },
      });
      mockPrisma.team.findUnique.mockResolvedValue({
        id: teamId,
        owner: null,
      });
      mockPrisma.leagueParticipant.findUnique.mockResolvedValue(null);
      mockPrisma.leagueParticipant.count.mockResolvedValue(0);
      mockPrisma.leagueParticipant.create.mockImplementation(
        async (args: { data: { seasonElo: number } }) => ({
          id: "participant-1",
          ...args.data,
        }),
      );

      await addParticipant({ seasonId, teamId, carryOverFromGlobal: true });

      expect(mockPrisma.leagueParticipant.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ seasonElo: 1000 }),
      });
    });

    it("L.8 — explicit initialElo takes precedence over carryOverFromGlobal", async () => {
      mockPrisma.leagueSeason.findUnique.mockResolvedValue({
        id: seasonId,
        status: "draft",
        league: { maxParticipants: 16 },
      });
      mockPrisma.team.findUnique.mockResolvedValue({
        id: teamId,
        owner: { eloRating: 1400 },
      });
      mockPrisma.leagueParticipant.findUnique.mockResolvedValue(null);
      mockPrisma.leagueParticipant.count.mockResolvedValue(0);
      mockPrisma.leagueParticipant.create.mockImplementation(
        async (args: { data: { seasonElo: number } }) => ({
          id: "participant-1",
          ...args.data,
        }),
      );

      await addParticipant({
        seasonId,
        teamId,
        initialElo: 1234,
        carryOverFromGlobal: true,
      });

      expect(mockPrisma.leagueParticipant.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ seasonElo: 1234 }),
      });
    });

    it("L.9 — rejects a team whose roster is not in the league allowedRosters", async () => {
      // Ligue "Open 5 Teams" : restreinte aux 5 rosters prioritaires.
      // Toute equipe d'un autre roster doit etre refusee cote service,
      // meme si un caller bypasse les verifications HTTP.
      mockPrisma.leagueSeason.findUnique.mockResolvedValue({
        id: seasonId,
        status: "draft",
        league: {
          maxParticipants: 16,
          allowedRosters: JSON.stringify([
            "skaven",
            "gnome",
            "lizardmen",
            "dwarf",
            "imperial_nobility",
          ]),
        },
      });
      mockPrisma.team.findUnique.mockResolvedValue({
        id: teamId,
        roster: "chaos_chosen",
      });

      await expect(addParticipant({ seasonId, teamId })).rejects.toThrow(
        /roster|autorise/i,
      );
      expect(mockPrisma.leagueParticipant.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.leagueParticipant.create).not.toHaveBeenCalled();
    });

    it("L.9 — accepts a team whose roster is part of the allowedRosters", async () => {
      mockPrisma.leagueSeason.findUnique.mockResolvedValue({
        id: seasonId,
        status: "draft",
        league: {
          maxParticipants: 16,
          allowedRosters: JSON.stringify([
            "skaven",
            "gnome",
            "lizardmen",
            "dwarf",
            "imperial_nobility",
          ]),
        },
      });
      mockPrisma.team.findUnique.mockResolvedValue({
        id: teamId,
        roster: "skaven",
      });
      mockPrisma.leagueParticipant.findUnique.mockResolvedValue(null);
      mockPrisma.leagueParticipant.count.mockResolvedValue(0);
      mockPrisma.leagueParticipant.create.mockImplementation(
        async (args: { data: { seasonId: string; teamId: string } }) => ({
          id: "participant-skaven",
          ...args.data,
        }),
      );

      const result = await addParticipant({ seasonId, teamId });

      expect(result).toMatchObject({ teamId });
      expect(mockPrisma.leagueParticipant.create).toHaveBeenCalledTimes(1);
    });

    it("L.9 — accepts any roster when allowedRosters is null (open league)", async () => {
      mockPrisma.leagueSeason.findUnique.mockResolvedValue({
        id: seasonId,
        status: "draft",
        league: { maxParticipants: 16, allowedRosters: null },
      });
      mockPrisma.team.findUnique.mockResolvedValue({
        id: teamId,
        roster: "chaos_chosen",
      });
      mockPrisma.leagueParticipant.findUnique.mockResolvedValue(null);
      mockPrisma.leagueParticipant.count.mockResolvedValue(0);
      mockPrisma.leagueParticipant.create.mockImplementation(
        async (args: { data: { seasonId: string; teamId: string } }) => ({
          id: "participant-chaos",
          ...args.data,
        }),
      );

      await addParticipant({ seasonId, teamId });

      expect(mockPrisma.leagueParticipant.create).toHaveBeenCalledTimes(1);
    });

    it("L.9 — falls back to open league when allowedRosters JSON is malformed", async () => {
      mockPrisma.leagueSeason.findUnique.mockResolvedValue({
        id: seasonId,
        status: "draft",
        league: { maxParticipants: 16, allowedRosters: "not-json" },
      });
      mockPrisma.team.findUnique.mockResolvedValue({
        id: teamId,
        roster: "chaos_chosen",
      });
      mockPrisma.leagueParticipant.findUnique.mockResolvedValue(null);
      mockPrisma.leagueParticipant.count.mockResolvedValue(0);
      mockPrisma.leagueParticipant.create.mockImplementation(
        async (args: { data: { seasonId: string; teamId: string } }) => ({
          id: "participant-fallback",
          ...args.data,
        }),
      );

      await addParticipant({ seasonId, teamId });

      expect(mockPrisma.leagueParticipant.create).toHaveBeenCalledTimes(1);
    });
  });

  describe("createRound", () => {
    it("creates a round with status 'pending' by default", async () => {
      mockPrisma.leagueSeason.findUnique.mockResolvedValue({ id: seasonId });
      const created = {
        id: "round-1",
        seasonId,
        roundNumber: 1,
        name: "Journee 1",
        status: "pending",
        startDate: null,
        endDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.leagueRound.create.mockResolvedValue(created);

      const result = await createRound({
        seasonId,
        roundNumber: 1,
        name: "Journee 1",
      });

      expect(result.roundNumber).toBe(1);
      expect(result.status).toBe("pending");
      expect(mockPrisma.leagueRound.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          seasonId,
          roundNumber: 1,
          name: "Journee 1",
        }),
      });
    });

    it("rejects non-positive round numbers", async () => {
      mockPrisma.leagueSeason.findUnique.mockResolvedValue({ id: seasonId });

      await expect(
        createRound({ seasonId, roundNumber: 0 }),
      ).rejects.toThrow(/round|journee|positif/i);
      expect(mockPrisma.leagueRound.create).not.toHaveBeenCalled();
    });
  });

  describe("listLeagues", () => {
    it("returns only public leagues by default", async () => {
      mockPrisma.league.findMany.mockResolvedValue([]);

      await listLeagues({});

      expect(mockPrisma.league.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isPublic: true }),
        }),
      );
    });

    it("can filter by creator", async () => {
      mockPrisma.league.findMany.mockResolvedValue([]);

      await listLeagues({ creatorId });

      expect(mockPrisma.league.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ creatorId }),
        }),
      );
    });
  });
});
