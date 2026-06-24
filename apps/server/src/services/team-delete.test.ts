import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    team: { findFirst: vi.fn(), update: vi.fn() },
    leagueParticipant: { findFirst: vi.fn() },
    cupParticipant: { findFirst: vi.fn() },
  },
}));

import { prisma } from "../prisma";
import { deleteTeam, TeamDeleteError } from "./team-delete";

const mockPrisma = prisma as any;

const teamId = "team-1";
const userId = "user-1";

describe("deleteTeam", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Defaults : équipe possédée, aucune compétition active.
    mockPrisma.team.findFirst.mockResolvedValue({ id: teamId });
    mockPrisma.leagueParticipant.findFirst.mockResolvedValue(null);
    mockPrisma.cupParticipant.findFirst.mockResolvedValue(null);
    mockPrisma.team.update.mockResolvedValue({ id: teamId });
  });

  it("soft-deletes a team with no competition (sets deletedAt)", async () => {
    await deleteTeam({ teamId, userId });

    expect(mockPrisma.team.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: teamId },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    );
  });

  it("soft-deletes a team whose only competitions are finished", async () => {
    // Les gardes ne remontent aucune compétition active (saisons completed /
    // coupes terminees ne matchent pas les filtres).
    await deleteTeam({ teamId, userId });
    expect(mockPrisma.team.update).toHaveBeenCalledTimes(1);
  });

  it("checks the league guard only against active + non-completed seasons", async () => {
    await deleteTeam({ teamId, userId });
    expect(mockPrisma.leagueParticipant.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          teamId,
          status: "active",
          season: { status: { not: "completed" } },
        },
      }),
    );
  });

  it("checks the cup guard only against non-finished cups", async () => {
    await deleteTeam({ teamId, userId });
    expect(mockPrisma.cupParticipant.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          teamId,
          cup: { status: { notIn: ["terminee", "archivee"] } },
        },
      }),
    );
  });

  it("rejects when the team is unknown or not owned", async () => {
    mockPrisma.team.findFirst.mockResolvedValue(null);

    await expect(deleteTeam({ teamId, userId })).rejects.toMatchObject({
      code: "not_found",
    });
    expect(mockPrisma.team.update).not.toHaveBeenCalled();
  });

  it("rejects (in_active_league) when engaged in an ongoing league", async () => {
    mockPrisma.leagueParticipant.findFirst.mockResolvedValue({
      season: { league: { name: "Skaven Cup" } },
    });

    const err = await deleteTeam({ teamId, userId }).catch((e) => e);
    expect(err).toBeInstanceOf(TeamDeleteError);
    expect(err.code).toBe("in_active_league");
    expect(err.message).toContain("Skaven Cup");
    expect(mockPrisma.team.update).not.toHaveBeenCalled();
  });

  it("rejects (in_active_cup) when engaged in an ongoing cup", async () => {
    mockPrisma.cupParticipant.findFirst.mockResolvedValue({
      cup: { name: "Coupe d'Hiver" },
    });

    const err = await deleteTeam({ teamId, userId }).catch((e) => e);
    expect(err).toBeInstanceOf(TeamDeleteError);
    expect(err.code).toBe("in_active_cup");
    expect(err.message).toContain("Coupe d'Hiver");
    expect(mockPrisma.team.update).not.toHaveBeenCalled();
  });

  it("prioritises the league guard over the cup guard", async () => {
    mockPrisma.leagueParticipant.findFirst.mockResolvedValue({
      season: { league: { name: "L1" } },
    });
    mockPrisma.cupParticipant.findFirst.mockResolvedValue({
      cup: { name: "C1" },
    });

    const err = await deleteTeam({ teamId, userId }).catch((e) => e);
    expect(err.code).toBe("in_active_league");
  });
});
