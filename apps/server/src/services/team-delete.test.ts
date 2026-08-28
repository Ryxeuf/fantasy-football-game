import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    team: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    leagueParticipant: { findFirst: vi.fn() },
    cupParticipant: { findFirst: vi.fn() },
  },
}));

// Le journal d'équipe n'est pas le sujet ici : il est déjà couvert par
// `team-audit`, et `safeRecordTeamAudit` avale ses propres erreurs.
vi.mock("./team-audit", () => ({
  captureTeamState: vi.fn(async () => null),
  safeRecordTeamAudit: vi.fn(async () => {}),
}));

import { prisma } from "../prisma";
import { safeRecordTeamAudit } from "./team-audit";
import {
  adminSoftDeleteTeam,
  deleteTeam,
  restoreTeam,
  TeamDeleteError,
} from "./team-delete";

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


describe("adminSoftDeleteTeam", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.team.findUnique.mockResolvedValue({
      id: teamId,
      name: "Les Rats",
      ownerId: userId,
      deletedAt: null,
    });
    mockPrisma.leagueParticipant.findFirst.mockResolvedValue(null);
    mockPrisma.cupParticipant.findFirst.mockResolvedValue(null);
    mockPrisma.team.update.mockResolvedValue({ id: teamId });
  });

  it("soft-delete : pose deletedAt, ne supprime rien", async () => {
    const result = await adminSoftDeleteTeam({ teamId });

    expect(mockPrisma.team.update).toHaveBeenCalledWith({
      where: { id: teamId },
      data: { deletedAt: expect.any(Date) },
    });
    expect(result.deletedAt).toBeInstanceOf(Date);
    expect(result.teamName).toBe("Les Rats");
    expect(result.ownerId).toBe(userId);
    expect(result.warnings).toEqual([]);
    expect(safeRecordTeamAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ teamId, action: "team.delete" }),
    );
  });

  it("n'est PAS bloqué par une compétition en cours (contrairement au coach)", async () => {
    mockPrisma.leagueParticipant.findFirst.mockResolvedValue({
      season: { league: { name: "Ligue du Chaos" } },
    });
    mockPrisma.cupParticipant.findFirst.mockResolvedValue({
      cup: { name: "Coupe de Nuffle" },
    });

    const result = await adminSoftDeleteTeam({ teamId });

    expect(mockPrisma.team.update).toHaveBeenCalled();
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings[0]).toContain("Ligue du Chaos");
    expect(result.warnings[1]).toContain("Coupe de Nuffle");
  });

  it("refuse (already_deleted) si l'équipe est déjà supprimée", async () => {
    mockPrisma.team.findUnique.mockResolvedValue({
      id: teamId,
      name: "Les Rats",
      ownerId: userId,
      deletedAt: new Date("2026-05-01"),
    });

    const err = await adminSoftDeleteTeam({ teamId }).catch((e) => e);

    expect(err).toBeInstanceOf(TeamDeleteError);
    expect(err.code).toBe("already_deleted");
    expect(mockPrisma.team.update).not.toHaveBeenCalled();
  });

  it("404 (not_found) si l'équipe n'existe pas", async () => {
    mockPrisma.team.findUnique.mockResolvedValue(null);

    const err = await adminSoftDeleteTeam({ teamId }).catch((e) => e);

    expect(err).toBeInstanceOf(TeamDeleteError);
    expect(err.code).toBe("not_found");
    expect(mockPrisma.team.update).not.toHaveBeenCalled();
  });
});

describe("restoreTeam", () => {
  const deletedAt = new Date("2026-05-01T10:00:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.team.findUnique.mockResolvedValue({
      id: teamId,
      name: "Les Rats",
      ownerId: userId,
      deletedAt,
    });
    mockPrisma.team.update.mockResolvedValue({ id: teamId });
  });

  it("efface deletedAt et journalise team.restore", async () => {
    const result = await restoreTeam({ teamId });

    expect(mockPrisma.team.update).toHaveBeenCalledWith({
      where: { id: teamId },
      data: { deletedAt: null },
    });
    expect(result.previousDeletedAt).toEqual(deletedAt);
    expect(result.teamName).toBe("Les Rats");
    expect(safeRecordTeamAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ teamId, action: "team.restore" }),
    );
  });

  it("refuse (not_deleted) si l'équipe est active", async () => {
    mockPrisma.team.findUnique.mockResolvedValue({
      id: teamId,
      name: "Les Rats",
      ownerId: userId,
      deletedAt: null,
    });

    const err = await restoreTeam({ teamId }).catch((e) => e);

    expect(err).toBeInstanceOf(TeamDeleteError);
    expect(err.code).toBe("not_deleted");
    expect(mockPrisma.team.update).not.toHaveBeenCalled();
  });

  it("404 (not_found) si l'équipe n'existe pas", async () => {
    mockPrisma.team.findUnique.mockResolvedValue(null);

    const err = await restoreTeam({ teamId }).catch((e) => e);

    expect(err).toBeInstanceOf(TeamDeleteError);
    expect(err.code).toBe("not_found");
  });
});
