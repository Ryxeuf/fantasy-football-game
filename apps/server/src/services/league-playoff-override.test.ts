/**
 * Lot D — Tests pour overridePlayoffParticipants.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    leagueSeason: { findUnique: vi.fn() },
    leagueParticipant: { findMany: vi.fn() },
    leagueRound: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    leaguePairing: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("./league", () => ({
  computeSeasonStandings: vi.fn(),
}));

import { prisma } from "../prisma";
import {
  overridePlayoffParticipants,
  PlayoffOverrideError,
} from "./league-playoffs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;

describe("Lot D — overridePlayoffParticipants", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.$transaction.mockResolvedValue([]);
  });

  it("rejects if season not found", async () => {
    mockPrisma.leagueSeason.findUnique.mockResolvedValue(null);
    await expect(
      overridePlayoffParticipants({
        seasonId: "x",
        participantIds: ["a", "b", "c", "d"],
      }),
    ).rejects.toMatchObject({ code: "season_not_found" });
  });

  it("rejects if playoffSize is 0", async () => {
    mockPrisma.leagueSeason.findUnique.mockResolvedValue({
      id: "s1",
      playoffSize: 0,
    });
    await expect(
      overridePlayoffParticipants({
        seasonId: "s1",
        participantIds: ["a", "b", "c", "d"],
      }),
    ).rejects.toMatchObject({ code: "playoffs_not_started" });
  });

  it("rejects mismatched participant count", async () => {
    mockPrisma.leagueSeason.findUnique.mockResolvedValue({
      id: "s1",
      playoffSize: 4,
    });
    await expect(
      overridePlayoffParticipants({
        seasonId: "s1",
        participantIds: ["a", "b"],
      }),
    ).rejects.toMatchObject({ code: "size_mismatch" });
  });

  it("rejects duplicate participants", async () => {
    mockPrisma.leagueSeason.findUnique.mockResolvedValue({
      id: "s1",
      playoffSize: 4,
    });
    await expect(
      overridePlayoffParticipants({
        seasonId: "s1",
        participantIds: ["a", "a", "b", "c"],
      }),
    ).rejects.toMatchObject({ code: "duplicate_participant" });
  });

  it("rejects non-active participant", async () => {
    mockPrisma.leagueSeason.findUnique.mockResolvedValue({
      id: "s1",
      playoffSize: 2,
    });
    mockPrisma.leagueParticipant.findMany.mockResolvedValue([
      { id: "a", seasonId: "s1", status: "active" },
      { id: "b", seasonId: "s1", status: "withdrawn" },
    ]);
    await expect(
      overridePlayoffParticipants({
        seasonId: "s1",
        participantIds: ["a", "b"],
      }),
    ).rejects.toMatchObject({ code: "participant_not_active" });
  });

  it("rejects participant from another season", async () => {
    mockPrisma.leagueSeason.findUnique.mockResolvedValue({
      id: "s1",
      playoffSize: 2,
    });
    mockPrisma.leagueParticipant.findMany.mockResolvedValue([
      { id: "a", seasonId: "s1", status: "active" },
      { id: "b", seasonId: "OTHER", status: "active" },
    ]);
    await expect(
      overridePlayoffParticipants({
        seasonId: "s1",
        participantIds: ["a", "b"],
      }),
    ).rejects.toMatchObject({ code: "participant_not_active" });
  });

  it("rejects when playoffs haven't started", async () => {
    mockPrisma.leagueSeason.findUnique.mockResolvedValue({
      id: "s1",
      playoffSize: 2,
    });
    mockPrisma.leagueParticipant.findMany.mockResolvedValue([
      { id: "a", seasonId: "s1", status: "active" },
      { id: "b", seasonId: "s1", status: "active" },
    ]);
    mockPrisma.leagueRound.findMany.mockResolvedValue([]);
    await expect(
      overridePlayoffParticipants({
        seasonId: "s1",
        participantIds: ["a", "b"],
      }),
    ).rejects.toMatchObject({ code: "playoffs_not_started" });
  });

  it("rejects when a playoff match is already in progress", async () => {
    mockPrisma.leagueSeason.findUnique.mockResolvedValue({
      id: "s1",
      playoffSize: 2,
    });
    mockPrisma.leagueParticipant.findMany.mockResolvedValue([
      { id: "a", seasonId: "s1", status: "active" },
      { id: "b", seasonId: "s1", status: "active" },
    ]);
    mockPrisma.leagueRound.findMany.mockResolvedValue([
      {
        id: "r1",
        bracketSlot: "final",
        pairings: [{ id: "p1", status: "played", matchId: "m1" }],
      },
    ]);
    await expect(
      overridePlayoffParticipants({
        seasonId: "s1",
        participantIds: ["a", "b"],
      }),
    ).rejects.toMatchObject({ code: "playoffs_in_progress" });
  });

  it("rebuilds bracket when no matches consumed yet", async () => {
    mockPrisma.leagueSeason.findUnique.mockResolvedValue({
      id: "s1",
      playoffSize: 2,
    });
    mockPrisma.leagueParticipant.findMany.mockResolvedValue([
      { id: "a", seasonId: "s1", status: "active" },
      { id: "b", seasonId: "s1", status: "active" },
    ]);
    mockPrisma.leagueRound.findMany.mockResolvedValue([
      {
        id: "r1",
        bracketSlot: "final",
        pairings: [{ id: "p1", status: "scheduled", matchId: null }],
      },
    ]);
    mockPrisma.leagueRound.findFirst.mockResolvedValue({ roundNumber: 5 });
    mockPrisma.leagueRound.create.mockResolvedValue({ id: "r2" });
    mockPrisma.leaguePairing.create.mockResolvedValue({});

    const out = await overridePlayoffParticipants({
      seasonId: "s1",
      participantIds: ["a", "b"],
    });
    expect(out.rebuilt).toBe(1);
    expect(out.rebuiltSlots).toContain("final");
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it("PlayoffOverrideError preserves code", () => {
    const e = new PlayoffOverrideError("size_mismatch", "x");
    expect(e.code).toBe("size_mismatch");
    expect(e).toBeInstanceOf(Error);
  });
});
