/**
 * Tests du service `commissioner-team-removal` : suppression d'equipes
 * et de joueurs par le commissaire avant le demarrage de la saison.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    leagueSeason: { findFirst: vi.fn() },
    leagueParticipant: {
      findUnique: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
    },
    leaguePairing: { findFirst: vi.fn() },
    teamPlayer: { findUnique: vi.fn(), delete: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

import { prisma } from "../prisma";
import {
  removeTeamFromLeague,
  removePlayerFromTeam,
  hasTeamPlayedInLeague,
  CommissionerRemovalError,
} from "./commissioner-team-removal";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;

const commish = "commish-1";

describe("commissioner-team-removal", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.auditLog.create.mockResolvedValue({});
    // Par defaut, aucune participation a un match.
    mockPrisma.leaguePairing.findFirst.mockResolvedValue(null);
  });

  describe("hasTeamPlayedInLeague", () => {
    it("retourne false si aucun pairing engage", async () => {
      mockPrisma.leaguePairing.findFirst.mockResolvedValue(null);
      await expect(hasTeamPlayedInLeague("L1", "T1")).resolves.toBe(false);
    });

    it("retourne true si un pairing engage existe", async () => {
      mockPrisma.leaguePairing.findFirst.mockResolvedValue({ id: "PR1" });
      await expect(hasTeamPlayedInLeague("L1", "T1")).resolves.toBe(true);
      // Filtre sur les statuts engages + scoping ligue.
      expect(mockPrisma.leaguePairing.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: {
              in: ["in_progress", "played", "forfeit_home", "forfeit_away"],
            },
            round: { season: { leagueId: "L1" } },
          }),
        }),
      );
    });
  });

  describe("removeTeamFromLeague", () => {
    it("rejette si la saison est introuvable dans la ligue", async () => {
      mockPrisma.leagueSeason.findFirst.mockResolvedValue(null);
      await expect(
        removeTeamFromLeague({
          leagueId: "L1",
          seasonId: "S1",
          teamId: "T1",
          byCommissionerId: commish,
        }),
      ).rejects.toMatchObject({ code: "season_not_found" });
      expect(mockPrisma.leagueParticipant.delete).not.toHaveBeenCalled();
    });

    it("rejette si l'equipe n'est pas inscrite sur la saison", async () => {
      mockPrisma.leagueSeason.findFirst.mockResolvedValue({
        id: "S1",
        status: "draft",
      });
      mockPrisma.leagueParticipant.findUnique.mockResolvedValue(null);
      await expect(
        removeTeamFromLeague({
          leagueId: "L1",
          seasonId: "S1",
          teamId: "T1",
          byCommissionerId: commish,
        }),
      ).rejects.toMatchObject({ code: "team_not_in_league" });
    });

    it("rejette si la saison a demarre (in_progress)", async () => {
      mockPrisma.leagueSeason.findFirst.mockResolvedValue({
        id: "S1",
        status: "in_progress",
      });
      mockPrisma.leagueParticipant.findUnique.mockResolvedValue({
        id: "PART1",
        team: { name: "Skavens" },
      });
      await expect(
        removeTeamFromLeague({
          leagueId: "L1",
          seasonId: "S1",
          teamId: "T1",
          byCommissionerId: commish,
        }),
      ).rejects.toMatchObject({ code: "season_started" });
      expect(mockPrisma.leagueParticipant.delete).not.toHaveBeenCalled();
    });

    it("rejette si l'equipe a deja participe a un match", async () => {
      mockPrisma.leagueSeason.findFirst.mockResolvedValue({
        id: "S1",
        status: "scheduled",
      });
      mockPrisma.leagueParticipant.findUnique.mockResolvedValue({
        id: "PART1",
        team: { name: "Skavens" },
      });
      mockPrisma.leaguePairing.findFirst.mockResolvedValue({ id: "PR1" });
      await expect(
        removeTeamFromLeague({
          leagueId: "L1",
          seasonId: "S1",
          teamId: "T1",
          byCommissionerId: commish,
        }),
      ).rejects.toMatchObject({ code: "team_has_played" });
      expect(mockPrisma.leagueParticipant.delete).not.toHaveBeenCalled();
    });

    it("supprime le participant et journalise quand tout est OK", async () => {
      mockPrisma.leagueSeason.findFirst.mockResolvedValue({
        id: "S1",
        status: "draft",
      });
      mockPrisma.leagueParticipant.findUnique.mockResolvedValue({
        id: "PART1",
        team: { name: "Skavens" },
      });
      mockPrisma.leagueParticipant.delete.mockResolvedValue({ id: "PART1" });

      const out = await removeTeamFromLeague({
        leagueId: "L1",
        seasonId: "S1",
        teamId: "T1",
        byCommissionerId: commish,
        reason: "mauvaise equipe inscrite",
      });

      expect(out).toEqual({ removed: true, teamId: "T1" });
      expect(mockPrisma.leagueParticipant.delete).toHaveBeenCalledWith({
        where: { id: "PART1" },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "league.commissioner-edit:remove_team",
            entity: "Team",
            entityId: "T1",
          }),
        }),
      );
    });
  });

  describe("removePlayerFromTeam", () => {
    it("rejette si l'equipe n'est pas dans la ligue", async () => {
      mockPrisma.leagueParticipant.count.mockResolvedValue(0);
      await expect(
        removePlayerFromTeam({
          leagueId: "L1",
          teamId: "T1",
          playerId: "P1",
          byCommissionerId: commish,
        }),
      ).rejects.toMatchObject({ code: "team_not_in_league" });
    });

    it("rejette si l'equipe a deja participe a un match", async () => {
      mockPrisma.leagueParticipant.count.mockResolvedValue(1);
      mockPrisma.leaguePairing.findFirst.mockResolvedValue({ id: "PR1" });
      await expect(
        removePlayerFromTeam({
          leagueId: "L1",
          teamId: "T1",
          playerId: "P1",
          byCommissionerId: commish,
        }),
      ).rejects.toMatchObject({ code: "team_has_played" });
      expect(mockPrisma.teamPlayer.delete).not.toHaveBeenCalled();
    });

    it("rejette si le joueur est introuvable", async () => {
      mockPrisma.leagueParticipant.count.mockResolvedValue(1);
      mockPrisma.teamPlayer.findUnique.mockResolvedValue(null);
      await expect(
        removePlayerFromTeam({
          leagueId: "L1",
          teamId: "T1",
          playerId: "P1",
          byCommissionerId: commish,
        }),
      ).rejects.toMatchObject({ code: "player_not_found" });
    });

    it("rejette si le joueur n'appartient pas a l'equipe", async () => {
      mockPrisma.leagueParticipant.count.mockResolvedValue(1);
      mockPrisma.teamPlayer.findUnique.mockResolvedValue({
        id: "P1",
        teamId: "OTHER",
        name: "Rat",
        position: "skaven_lineman",
        number: 1,
      });
      await expect(
        removePlayerFromTeam({
          leagueId: "L1",
          teamId: "T1",
          playerId: "P1",
          byCommissionerId: commish,
        }),
      ).rejects.toMatchObject({ code: "player_not_in_team" });
      expect(mockPrisma.teamPlayer.delete).not.toHaveBeenCalled();
    });

    it("supprime le joueur et journalise quand tout est OK", async () => {
      mockPrisma.leagueParticipant.count.mockResolvedValue(1);
      mockPrisma.teamPlayer.findUnique.mockResolvedValue({
        id: "P1",
        teamId: "T1",
        name: "Rat",
        position: "skaven_lineman",
        number: 7,
      });
      mockPrisma.teamPlayer.delete.mockResolvedValue({ id: "P1" });

      const out = await removePlayerFromTeam({
        leagueId: "L1",
        teamId: "T1",
        playerId: "P1",
        byCommissionerId: commish,
        reason: "joueur en trop",
      });

      expect(out).toEqual({ removed: true, playerId: "P1" });
      expect(mockPrisma.teamPlayer.delete).toHaveBeenCalledWith({
        where: { id: "P1" },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "league.commissioner-edit:remove_player",
            entity: "TeamPlayer",
            entityId: "P1",
          }),
        }),
      );
    });
  });

  it("expose une classe d'erreur typee", () => {
    const err = new CommissionerRemovalError("team_has_played", "msg");
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe("team_has_played");
    expect(err.name).toBe("CommissionerRemovalError");
  });
});
