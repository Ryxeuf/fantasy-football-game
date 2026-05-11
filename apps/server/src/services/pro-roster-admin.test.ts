import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proTeam: { findUnique: vi.fn() },
    proTeamRoster: {
      deleteMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { prisma } from "../prisma";
import {
  regenerateRoster,
  retirePlayer,
  RosterAdminError,
} from "./pro-roster-admin";

const mockedPrisma = prisma as unknown as {
  proTeam: { findUnique: ReturnType<typeof vi.fn> };
  proTeamRoster: {
    deleteMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("regenerateRoster", () => {
  it("rejette count < 1", async () => {
    await expect(
      regenerateRoster({ teamId: "t1", count: 0 }),
    ).rejects.toThrow(RosterAdminError);
  });

  it("rejette count > 30", async () => {
    await expect(
      regenerateRoster({ teamId: "t1", count: 31 }),
    ).rejects.toThrow(RosterAdminError);
  });

  it("rejette si team introuvable", async () => {
    mockedPrisma.proTeam.findUnique.mockResolvedValueOnce(null);
    await expect(
      regenerateRoster({ teamId: "missing", count: 12 }),
    ).rejects.toMatchObject({
      code: "TEAM_NOT_FOUND",
    });
  });

  it("wipe + re-seed avec le count fourni", async () => {
    mockedPrisma.proTeam.findUnique
      .mockResolvedValueOnce({ id: "t1" })
      .mockResolvedValueOnce({ id: "t1", race: "Orc", slug: "pit-smashers" });
    mockedPrisma.proTeamRoster.deleteMany.mockResolvedValueOnce({ count: 12 });
    mockedPrisma.proTeamRoster.count.mockResolvedValueOnce(0);
    mockedPrisma.proTeamRoster.create.mockResolvedValue({});

    const result = await regenerateRoster({ teamId: "t1", count: 12 });

    expect(result).toEqual({ teamId: "t1", deleted: 12, created: 12 });
    expect(mockedPrisma.proTeamRoster.deleteMany).toHaveBeenCalledWith({
      where: { teamId: "t1" },
    });
    expect(mockedPrisma.proTeamRoster.create).toHaveBeenCalledTimes(12);
  });

  it("supporte count personnalise", async () => {
    mockedPrisma.proTeam.findUnique
      .mockResolvedValueOnce({ id: "t1" })
      .mockResolvedValueOnce({ id: "t1", race: "Orc", slug: "x" });
    mockedPrisma.proTeamRoster.deleteMany.mockResolvedValueOnce({ count: 5 });
    mockedPrisma.proTeamRoster.count.mockResolvedValueOnce(0);
    mockedPrisma.proTeamRoster.create.mockResolvedValue({});

    const result = await regenerateRoster({ teamId: "t1", count: 16 });

    expect(result.created).toBe(16);
    expect(mockedPrisma.proTeamRoster.create).toHaveBeenCalledTimes(16);
  });
});

describe("retirePlayer", () => {
  it("rejette si joueur introuvable", async () => {
    mockedPrisma.proTeamRoster.findUnique.mockResolvedValueOnce(null);
    await expect(retirePlayer("missing")).rejects.toMatchObject({
      code: "ROSTER_NOT_FOUND",
    });
  });

  it("met le status a retired et retourne previousStatus", async () => {
    mockedPrisma.proTeamRoster.findUnique.mockResolvedValueOnce({
      id: "p1",
      status: "active",
    });
    mockedPrisma.proTeamRoster.update.mockResolvedValueOnce({});

    const result = await retirePlayer("p1");

    expect(result).toEqual({ playerId: "p1", previousStatus: "active" });
    expect(mockedPrisma.proTeamRoster.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { status: "retired" },
    });
  });

  it("idempotent si deja retired (no-op)", async () => {
    mockedPrisma.proTeamRoster.findUnique.mockResolvedValueOnce({
      id: "p1",
      status: "retired",
    });

    const result = await retirePlayer("p1");

    expect(result).toEqual({ playerId: "p1", previousStatus: "retired" });
    expect(mockedPrisma.proTeamRoster.update).not.toHaveBeenCalled();
  });

  it("fonctionne pour un joueur injured", async () => {
    mockedPrisma.proTeamRoster.findUnique.mockResolvedValueOnce({
      id: "p1",
      status: "injured",
    });
    mockedPrisma.proTeamRoster.update.mockResolvedValueOnce({});

    const result = await retirePlayer("p1");

    expect(result.previousStatus).toBe("injured");
  });
});
