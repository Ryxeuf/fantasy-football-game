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
      count: vi.fn(),
    },
    leagueSeason: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    leagueParticipant: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    cupParticipant: {
      findFirst: vi.fn(),
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
    match: {
      count: vi.fn(),
    },
  },
}));

import { prisma } from "../prisma";
import {
  createLeague,
  updateLeague,
  hasLeagueScoredMatch,
  createSeason,
  addParticipant,
  createRound,
  listLeagues,
  listThemedSeasons,
  withdrawParticipant,
  isLeagueParticipant,
  LeagueWithdrawError,
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

  describe("isLeagueParticipant", () => {
    it("retourne true si le coach possède une équipe inscrite dans la ligue", async () => {
      mockPrisma.leagueParticipant.count.mockResolvedValue(1);
      const out = await isLeagueParticipant("user-x", leagueId);
      expect(out).toBe(true);
      expect(mockPrisma.leagueParticipant.count).toHaveBeenCalledWith({
        where: { team: { ownerId: "user-x" }, season: { leagueId } },
      });
    });

    it("retourne false si le coach n'a aucune équipe inscrite", async () => {
      mockPrisma.leagueParticipant.count.mockResolvedValue(0);
      expect(await isLeagueParticipant("outsider", leagueId)).toBe(false);
    });
  });

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

    // S26.6 — themes saisonniers + reset ELO.
    it("persists theme + themeYear when supplied with a known slug", async () => {
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
        name: "Skaven Cup 2026",
        theme: "skaven_cup",
        themeYear: 2026,
      });

      expect(mockPrisma.leagueSeason.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          theme: "skaven_cup",
          themeYear: 2026,
        }),
      });
      expect((result as { theme: string }).theme).toBe("skaven_cup");
      expect((result as { themeYear: number }).themeYear).toBe(2026);
    });

    it("rejects an unknown theme slug", async () => {
      mockPrisma.league.findUnique.mockResolvedValue({ id: leagueId });
      mockPrisma.leagueSeason.findFirst.mockResolvedValue(null);

      await expect(
        createSeason({
          leagueId,
          name: "Ghost Cup",
          theme: "ghost_cup" as unknown as "skaven_cup",
          themeYear: 2026,
        }),
      ).rejects.toThrow(/theme|inconnu|invalid/i);
      expect(mockPrisma.leagueSeason.create).not.toHaveBeenCalled();
    });

    it("rejects an invalid themeYear (zero, negative, non-integer)", async () => {
      mockPrisma.league.findUnique.mockResolvedValue({ id: leagueId });
      mockPrisma.leagueSeason.findFirst.mockResolvedValue(null);

      await expect(
        createSeason({
          leagueId,
          name: "Skaven Cup ?",
          theme: "skaven_cup",
          themeYear: 0,
        }),
      ).rejects.toThrow(/year|annee/i);

      await expect(
        createSeason({
          leagueId,
          name: "Skaven Cup ?",
          theme: "skaven_cup",
          themeYear: 2026.5,
        }),
      ).rejects.toThrow(/year|annee/i);
      expect(mockPrisma.leagueSeason.create).not.toHaveBeenCalled();
    });

    it("rejects theme without themeYear (and vice-versa)", async () => {
      mockPrisma.league.findUnique.mockResolvedValue({ id: leagueId });
      mockPrisma.leagueSeason.findFirst.mockResolvedValue(null);

      await expect(
        createSeason({
          leagueId,
          name: "Skaven Cup",
          theme: "skaven_cup",
        }),
      ).rejects.toThrow(/year|annee/i);

      await expect(
        createSeason({
          leagueId,
          name: "Skaven Cup",
          themeYear: 2026,
        }),
      ).rejects.toThrow(/theme/i);
      expect(mockPrisma.leagueSeason.create).not.toHaveBeenCalled();
    });

    it("creates a season with theme=null when neither theme nor themeYear are supplied", async () => {
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

      await createSeason({ leagueId, name: "Saison 1" });

      expect(mockPrisma.leagueSeason.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          theme: null,
          themeYear: null,
        }),
      });
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
      mockPrisma.league.count.mockResolvedValue(0);

      const result = await listLeagues({});

      expect(mockPrisma.league.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isPublic: true }),
        }),
      );
      expect(result).toEqual({
        items: [],
        total: 0,
        limit: 50,
        offset: 0,
      });
    });

    // Regression : passer une ligue en prive ne doit pas la faire
    // disparaitre de la liste pour son createur/participant. Quand un
    // viewer est fourni sans publicOnly explicite, on remonte les ligues
    // publiques + celles ou il est createur ou participant.
    it("includes the viewer's own private leagues by default", async () => {
      mockPrisma.league.findMany.mockResolvedValue([]);
      mockPrisma.league.count.mockResolvedValue(0);

      await listLeagues({ viewerId: creatorId });

      expect(mockPrisma.league.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { isPublic: true },
              { creatorId },
              {
                seasons: {
                  some: {
                    participants: {
                      some: { team: { ownerId: creatorId } },
                    },
                  },
                },
              },
              {
                invitations: {
                  some: { inviteeUserId: creatorId, status: "pending" },
                },
              },
            ],
          }),
        }),
      );
      // Pas de filtre isPublic strict quand un viewer est fourni.
      const call = mockPrisma.league.findMany.mock.calls[0][0];
      expect(call.where.isPublic).toBeUndefined();
    });

    it("still restricts to public leagues when publicOnly is true", async () => {
      mockPrisma.league.findMany.mockResolvedValue([]);
      mockPrisma.league.count.mockResolvedValue(0);

      await listLeagues({ viewerId: creatorId, publicOnly: true });

      const call = mockPrisma.league.findMany.mock.calls[0][0];
      expect(call.where.isPublic).toBe(true);
      expect(call.where.OR).toBeUndefined();
    });

    it("can filter by creator", async () => {
      mockPrisma.league.findMany.mockResolvedValue([]);
      mockPrisma.league.count.mockResolvedValue(0);

      await listLeagues({ creatorId });

      expect(mockPrisma.league.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ creatorId }),
        }),
      );
    });

    // Regression : un coach convie a une ligue privee doit la voir dans
    // sa liste tant que l'invitation est en attente (avant meme d'avoir
    // rejoint, donc sans LeagueParticipant).
    it("includes leagues where the viewer has a pending invitation", async () => {
      mockPrisma.league.findMany.mockResolvedValue([]);
      mockPrisma.league.count.mockResolvedValue(0);

      await listLeagues({ viewerId: "viewer-1" });

      const where = mockPrisma.league.findMany.mock.calls[0][0].where;
      expect(where.OR).toContainEqual({
        invitations: {
          some: { inviteeUserId: "viewer-1", status: "pending" },
        },
      });
    });

    it("A1 — viewer connecté : publiques OU ses propres ligues (créées ou rejointes)", async () => {
      mockPrisma.league.findMany.mockResolvedValue([]);
      mockPrisma.league.count.mockResolvedValue(0);

      await listLeagues({ viewerId: "viewer-1" });

      const where = mockPrisma.league.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([
        { isPublic: true },
        { creatorId: "viewer-1" },
        {
          seasons: {
            some: {
              participants: {
                some: { team: { ownerId: "viewer-1" } },
              },
            },
          },
        },
        {
          invitations: {
            some: { inviteeUserId: "viewer-1", status: "pending" },
          },
        },
      ]);
      expect(where.isPublic).toBeUndefined();
    });

    it("A1 — un creatorId explicite n'active pas le OR viewer", async () => {
      mockPrisma.league.findMany.mockResolvedValue([]);
      mockPrisma.league.count.mockResolvedValue(0);

      await listLeagues({ creatorId, viewerId: "viewer-1" });

      const where = mockPrisma.league.findMany.mock.calls[0][0].where;
      expect(where.creatorId).toBe(creatorId);
      expect(where.isPublic).toBe(true);
      expect(where.OR).toBeUndefined();
    });

    it("A1 — publicOnly=false : aucune restriction de visibilité", async () => {
      mockPrisma.league.findMany.mockResolvedValue([]);
      mockPrisma.league.count.mockResolvedValue(0);

      await listLeagues({ viewerId: "viewer-1", publicOnly: false });

      const where = mockPrisma.league.findMany.mock.calls[0][0].where;
      expect(where.OR).toBeUndefined();
      expect(where.isPublic).toBeUndefined();
    });

    // S25.6 — pagination
    it("respects limit and offset, capped at 100", async () => {
      mockPrisma.league.findMany.mockResolvedValue([]);
      mockPrisma.league.count.mockResolvedValue(250);

      const result = await listLeagues({ limit: 999, offset: 50 });

      expect(mockPrisma.league.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100, skip: 50 }),
      );
      expect(result.limit).toBe(100);
      expect(result.offset).toBe(50);
      expect(result.total).toBe(250);
    });

    it("clamps negative offset and limit < 1 to safe defaults", async () => {
      mockPrisma.league.findMany.mockResolvedValue([]);
      mockPrisma.league.count.mockResolvedValue(0);

      await listLeagues({ limit: -10, offset: -5 });

      expect(mockPrisma.league.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 1, skip: 0 }),
      );
    });
  });

  // S26.6b — listing public des saisons d'un theme.
  describe("listThemedSeasons", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("filtre par theme et applique l'ordre themeYear DESC, seasonNumber DESC", async () => {
      mockPrisma.leagueSeason.findMany.mockResolvedValue([
        { id: "s-2026", themeYear: 2026, seasonNumber: 1, theme: "skaven_cup" },
        { id: "s-2025", themeYear: 2025, seasonNumber: 2, theme: "skaven_cup" },
      ]);
      mockPrisma.leagueSeason.count.mockResolvedValue(2);

      const result = await listThemedSeasons({ theme: "skaven_cup" });

      expect(mockPrisma.leagueSeason.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { theme: "skaven_cup" },
          orderBy: [
            { themeYear: "desc" },
            { seasonNumber: "desc" },
          ],
        }),
      );
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it("ajoute themeYear au filtre quand fourni", async () => {
      mockPrisma.leagueSeason.findMany.mockResolvedValue([]);
      mockPrisma.leagueSeason.count.mockResolvedValue(0);

      await listThemedSeasons({ theme: "nordic_challenge", themeYear: 2026 });

      expect(mockPrisma.leagueSeason.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { theme: "nordic_challenge", themeYear: 2026 },
        }),
      );
    });

    it("plafonne limit a 100 et applique offset", async () => {
      mockPrisma.leagueSeason.findMany.mockResolvedValue([]);
      mockPrisma.leagueSeason.count.mockResolvedValue(150);

      const r = await listThemedSeasons({
        theme: "skaven_cup",
        limit: 9999,
        offset: 25,
      });

      expect(mockPrisma.leagueSeason.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100, skip: 25 }),
      );
      expect(r.limit).toBe(100);
      expect(r.offset).toBe(25);
      expect(r.total).toBe(150);
    });

    it("rejette un slug de theme inconnu", async () => {
      await expect(
        listThemedSeasons({ theme: "ghost_league" as never }),
      ).rejects.toThrow(/theme inconnu/i);
      expect(mockPrisma.leagueSeason.findMany).not.toHaveBeenCalled();
    });

    it("rejette un themeYear non entier", async () => {
      await expect(
        listThemedSeasons({ theme: "skaven_cup", themeYear: 2026.5 }),
      ).rejects.toThrow(/themeYear/i);
    });

    it("rejette un themeYear <= 0", async () => {
      await expect(
        listThemedSeasons({ theme: "skaven_cup", themeYear: 0 }),
      ).rejects.toThrow(/themeYear/i);
    });
  });

  describe("hasLeagueScoredMatch", () => {
    it("est vrai des qu'un match de la ligue a un leagueScoredAt", async () => {
      mockPrisma.match.count.mockResolvedValue(1);
      const result = await hasLeagueScoredMatch(leagueId);
      expect(result).toBe(true);
      expect(mockPrisma.match.count).toHaveBeenCalledWith({
        where: {
          leagueScoredAt: { not: null },
          leagueSeason: { is: { leagueId } },
        },
      });
    });

    it("est faux quand aucun match n'est comptabilise", async () => {
      mockPrisma.match.count.mockResolvedValue(0);
      expect(await hasLeagueScoredMatch(leagueId)).toBe(false);
    });
  });

  describe("updateLeague", () => {
    it("ne met a jour que les champs fournis (PATCH partiel)", async () => {
      mockPrisma.league.update.mockResolvedValue({ id: leagueId });
      await updateLeague(leagueId, { winPoints: 4, maxParticipants: 8 });
      expect(mockPrisma.league.update).toHaveBeenCalledWith({
        where: { id: leagueId },
        data: { winPoints: 4, maxParticipants: 8 },
      });
    });

    it("stringifie allowedRosters et trim le nom", async () => {
      mockPrisma.league.update.mockResolvedValue({ id: leagueId });
      await updateLeague(leagueId, {
        name: "  Ma Ligue  ",
        allowedRosters: ["skaven", "dwarf"],
      });
      expect(mockPrisma.league.update).toHaveBeenCalledWith({
        where: { id: leagueId },
        data: {
          name: "Ma Ligue",
          allowedRosters: JSON.stringify(["skaven", "dwarf"]),
        },
      });
    });

    it("stocke allowedRosters=null quand la liste est vide", async () => {
      mockPrisma.league.update.mockResolvedValue({ id: leagueId });
      await updateLeague(leagueId, { allowedRosters: [] });
      expect(mockPrisma.league.update).toHaveBeenCalledWith({
        where: { id: leagueId },
        data: { allowedRosters: null },
      });
    });

    it("rejette un nom vide quand il est fourni", async () => {
      await expect(updateLeague(leagueId, { name: "   " })).rejects.toThrow(
        /nom de la ligue/i,
      );
      expect(mockPrisma.league.update).not.toHaveBeenCalled();
    });

    it("rejette maxParticipants < 2", async () => {
      await expect(
        updateLeague(leagueId, { maxParticipants: 1 }),
      ).rejects.toThrow(/maxParticipants/i);
      expect(mockPrisma.league.update).not.toHaveBeenCalled();
    });
  });

  // Lot B — refus du retrait apres demarrage de la saison.
  describe("withdrawParticipant (Lot B)", () => {
    const seasonId = "season-1";
    const teamId = "team-1";
    const participantId = "part-1";

    it("refuse si saison introuvable (404 mappee)", async () => {
      mockPrisma.leagueSeason.findUnique.mockResolvedValue(null);
      await expect(
        withdrawParticipant({ seasonId, teamId }),
      ).rejects.toMatchObject({
        name: "LeagueWithdrawError",
        code: "season_not_found",
      });
    });

    it("refuse si saison completed", async () => {
      mockPrisma.leagueSeason.findUnique.mockResolvedValue({
        id: seasonId,
        status: "completed",
      });
      await expect(
        withdrawParticipant({ seasonId, teamId }),
      ).rejects.toMatchObject({ code: "season_completed" });
    });

    it("refuse si saison in_progress (sans force)", async () => {
      mockPrisma.leagueSeason.findUnique.mockResolvedValue({
        id: seasonId,
        status: "in_progress",
      });
      await expect(
        withdrawParticipant({ seasonId, teamId }),
      ).rejects.toMatchObject({ code: "season_started" });
      expect(mockPrisma.leagueParticipant.update).not.toHaveBeenCalled();
    });

    it("autorise le retrait sur saison draft", async () => {
      mockPrisma.leagueSeason.findUnique.mockResolvedValue({
        id: seasonId,
        status: "draft",
      });
      mockPrisma.leagueParticipant.findUnique.mockResolvedValue({
        id: participantId,
        seasonId,
        teamId,
        status: "active",
      });
      mockPrisma.leagueParticipant.update.mockResolvedValue({
        id: participantId,
        status: "withdrawn",
      });
      const out = await withdrawParticipant({ seasonId, teamId });
      expect(mockPrisma.leagueParticipant.update).toHaveBeenCalledWith({
        where: { id: participantId },
        data: { status: "withdrawn" },
      });
      expect(out).toMatchObject({ status: "withdrawn" });
    });

    it("autorise le retrait sur saison scheduled", async () => {
      mockPrisma.leagueSeason.findUnique.mockResolvedValue({
        id: seasonId,
        status: "scheduled",
      });
      mockPrisma.leagueParticipant.findUnique.mockResolvedValue({
        id: participantId,
        status: "active",
      });
      mockPrisma.leagueParticipant.update.mockResolvedValue({
        id: participantId,
        status: "withdrawn",
      });
      await expect(
        withdrawParticipant({ seasonId, teamId }),
      ).resolves.toBeDefined();
    });

    it("autorise le retrait pendant in_progress avec force=true (admin)", async () => {
      mockPrisma.leagueSeason.findUnique.mockResolvedValue({
        id: seasonId,
        status: "in_progress",
      });
      mockPrisma.leagueParticipant.findUnique.mockResolvedValue({
        id: participantId,
        status: "active",
      });
      mockPrisma.leagueParticipant.update.mockResolvedValue({
        id: participantId,
        status: "withdrawn",
      });
      await expect(
        withdrawParticipant({ seasonId, teamId, force: true }),
      ).resolves.toBeDefined();
    });

    it("refuse meme avec force=true si saison completed", async () => {
      mockPrisma.leagueSeason.findUnique.mockResolvedValue({
        id: seasonId,
        status: "completed",
      });
      await expect(
        withdrawParticipant({ seasonId, teamId, force: true }),
      ).rejects.toMatchObject({ code: "season_completed" });
    });

    it("refuse si l'equipe n'est pas inscrite", async () => {
      mockPrisma.leagueSeason.findUnique.mockResolvedValue({
        id: seasonId,
        status: "draft",
      });
      mockPrisma.leagueParticipant.findUnique.mockResolvedValue(null);
      await expect(
        withdrawParticipant({ seasonId, teamId }),
      ).rejects.toMatchObject({ code: "not_registered" });
    });

    it("LeagueWithdrawError est bien une Error", () => {
      const err = new LeagueWithdrawError("season_started", "msg");
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe("LeagueWithdrawError");
      expect(err.code).toBe("season_started");
    });
  });
});
