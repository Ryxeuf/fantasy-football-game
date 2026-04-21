/**
 * L.7 — Tests integration resultat match -> ligue (Sprint 17).
 *
 * Verifie que `recordLeagueMatchResult` :
 *  - ignore les matchs hors ligue
 *  - est idempotent (un match ne peut pas etre comptabilise deux fois)
 *  - distribue points/wins/losses/draws/td/cas selon le bareme de la ligue
 *  - marque round + saison "completed" quand plus aucun match n'est en attente
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    match: {
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    leagueSeason: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    leagueRound: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    leagueParticipant: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    teamSelection: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
  },
}));

import { prisma } from "../prisma";
import { recordLeagueMatchResult } from "./league-match-result";

const mockPrisma = prisma as unknown as {
  match: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  leagueSeason: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  leagueRound: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  leagueParticipant: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  teamSelection: {
    findMany: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

const LEAGUE = {
  winPoints: 3,
  drawPoints: 1,
  lossPoints: 0,
  forfeitPoints: -1,
};

function baseMatch(overrides: Record<string, unknown> = {}) {
  return {
    id: "match-1",
    status: "ended",
    leagueSeasonId: "season-1",
    leagueRoundId: "round-1",
    leagueScoredAt: null,
    leagueSeason: { id: "season-1", leagueId: "league-1", league: LEAGUE },
    ...overrides,
  };
}

describe("Rule: recordLeagueMatchResult (L.7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (ops: unknown) => {
      if (Array.isArray(ops)) return Promise.all(ops as Promise<unknown>[]);
      if (typeof ops === "function") {
        return (ops as (tx: typeof prisma) => Promise<unknown>)(prisma);
      }
      return ops;
    });
  });

  it("ignores matches not attached to a league", async () => {
    mockPrisma.match.findUnique.mockResolvedValue(
      baseMatch({ leagueSeasonId: null, leagueSeason: null }),
    );

    const result = await recordLeagueMatchResult({
      matchId: "match-1",
      scoreA: 2,
      scoreB: 1,
      casualtiesA: 1,
      casualtiesB: 0,
    });

    expect(result).toEqual({ skipped: true, reason: "not-a-league-match" });
    expect(mockPrisma.leagueParticipant.update).not.toHaveBeenCalled();
  });

  it("is idempotent when leagueScoredAt is already set", async () => {
    mockPrisma.match.findUnique.mockResolvedValue(
      baseMatch({ leagueScoredAt: new Date("2026-04-20") }),
    );

    const result = await recordLeagueMatchResult({
      matchId: "match-1",
      scoreA: 2,
      scoreB: 1,
      casualtiesA: 1,
      casualtiesB: 0,
    });

    expect(result).toEqual({ skipped: true, reason: "already-scored" });
    expect(mockPrisma.leagueParticipant.update).not.toHaveBeenCalled();
  });

  it("awards winPoints / lossPoints and updates td/cas counters on a win", async () => {
    mockPrisma.match.findUnique.mockResolvedValue(baseMatch());
    mockPrisma.teamSelection.findMany.mockResolvedValue([
      { teamId: "team-A", userId: "user-A" },
      { teamId: "team-B", userId: "user-B" },
    ]);
    mockPrisma.leagueParticipant.findUnique.mockImplementation(
      async (args: { where: { seasonId_teamId: { teamId: string } } }) => ({
        id: `p-${args.where.seasonId_teamId.teamId}`,
        teamId: args.where.seasonId_teamId.teamId,
      }),
    );
    mockPrisma.leagueRound.findMany.mockResolvedValue([]); // no other rounds

    const result = await recordLeagueMatchResult({
      matchId: "match-1",
      scoreA: 3,
      scoreB: 1,
      casualtiesA: 2,
      casualtiesB: 1,
    });

    expect(result).toMatchObject({
      recorded: true,
      winner: "A",
      pointsDelta: { teamA: 3, teamB: 0 },
    });

    const updates = mockPrisma.leagueParticipant.update.mock.calls.map(
      (c: { 0: { where: { id: string }; data: Record<string, unknown> } }[]) =>
        c[0],
    ) as Array<{
      where: { id: string };
      data: Record<string, { increment?: number } | number>;
    }>;

    const aUpdate = updates.find((u) => u.where.id === "p-team-A");
    const bUpdate = updates.find((u) => u.where.id === "p-team-B");
    expect(aUpdate?.data.wins).toEqual({ increment: 1 });
    expect(aUpdate?.data.points).toEqual({ increment: 3 });
    expect(aUpdate?.data.touchdownsFor).toEqual({ increment: 3 });
    expect(aUpdate?.data.touchdownsAgainst).toEqual({ increment: 1 });
    expect(aUpdate?.data.casualtiesFor).toEqual({ increment: 2 });
    expect(aUpdate?.data.casualtiesAgainst).toEqual({ increment: 1 });
    expect(bUpdate?.data.losses).toEqual({ increment: 1 });
    expect(bUpdate?.data.points).toEqual({ increment: 0 });
    expect(bUpdate?.data.touchdownsFor).toEqual({ increment: 1 });

    expect(mockPrisma.match.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "match-1" },
        data: expect.objectContaining({ leagueScoredAt: expect.any(Date) }),
      }),
    );
  });

  it("awards drawPoints to both teams on a draw", async () => {
    mockPrisma.match.findUnique.mockResolvedValue(baseMatch());
    mockPrisma.teamSelection.findMany.mockResolvedValue([
      { teamId: "team-A", userId: "user-A" },
      { teamId: "team-B", userId: "user-B" },
    ]);
    mockPrisma.leagueParticipant.findUnique.mockImplementation(
      async (args: { where: { seasonId_teamId: { teamId: string } } }) => ({
        id: `p-${args.where.seasonId_teamId.teamId}`,
        teamId: args.where.seasonId_teamId.teamId,
      }),
    );
    mockPrisma.leagueRound.findMany.mockResolvedValue([]);

    const result = await recordLeagueMatchResult({
      matchId: "match-1",
      scoreA: 1,
      scoreB: 1,
      casualtiesA: 0,
      casualtiesB: 0,
    });

    expect(result).toMatchObject({
      recorded: true,
      winner: "draw",
      pointsDelta: { teamA: 1, teamB: 1 },
    });
  });

  it("marks the round completed when no pending match remains", async () => {
    mockPrisma.match.findUnique.mockResolvedValue(baseMatch());
    mockPrisma.teamSelection.findMany.mockResolvedValue([
      { teamId: "team-A", userId: "user-A" },
      { teamId: "team-B", userId: "user-B" },
    ]);
    mockPrisma.leagueParticipant.findUnique.mockImplementation(
      async (args: { where: { seasonId_teamId: { teamId: string } } }) => ({
        id: `p-${args.where.seasonId_teamId.teamId}`,
        teamId: args.where.seasonId_teamId.teamId,
      }),
    );
    mockPrisma.match.count.mockResolvedValue(0); // no unfinished matches in round
    // findMany is called with where: { status: { not: "completed" } } —
    // an empty result means "no round left -> season completed".
    mockPrisma.leagueRound.findMany.mockResolvedValue([]);

    await recordLeagueMatchResult({
      matchId: "match-1",
      scoreA: 2,
      scoreB: 0,
      casualtiesA: 0,
      casualtiesB: 0,
    });

    expect(mockPrisma.leagueRound.update).toHaveBeenCalledWith({
      where: { id: "round-1" },
      data: { status: "completed" },
    });
    expect(mockPrisma.leagueSeason.update).toHaveBeenCalledWith({
      where: { id: "season-1" },
      data: { status: "completed" },
    });
  });

  it("keeps the round in progress when other matches are still pending", async () => {
    mockPrisma.match.findUnique.mockResolvedValue(baseMatch());
    mockPrisma.teamSelection.findMany.mockResolvedValue([
      { teamId: "team-A", userId: "user-A" },
      { teamId: "team-B", userId: "user-B" },
    ]);
    mockPrisma.leagueParticipant.findUnique.mockImplementation(
      async (args: { where: { seasonId_teamId: { teamId: string } } }) => ({
        id: `p-${args.where.seasonId_teamId.teamId}`,
      }),
    );
    mockPrisma.match.count.mockResolvedValue(2); // 2 matches still unfinished

    await recordLeagueMatchResult({
      matchId: "match-1",
      scoreA: 2,
      scoreB: 1,
      casualtiesA: 0,
      casualtiesB: 0,
    });

    expect(mockPrisma.leagueRound.update).not.toHaveBeenCalled();
    expect(mockPrisma.leagueSeason.update).not.toHaveBeenCalled();
  });

  it("gracefully skips when a participant is missing (team withdrew)", async () => {
    mockPrisma.match.findUnique.mockResolvedValue(baseMatch());
    mockPrisma.teamSelection.findMany.mockResolvedValue([
      { teamId: "team-A", userId: "user-A" },
      { teamId: "team-B", userId: "user-B" },
    ]);
    mockPrisma.leagueParticipant.findUnique.mockResolvedValueOnce({
      id: "p-team-A",
    });
    mockPrisma.leagueParticipant.findUnique.mockResolvedValueOnce(null);

    const result = await recordLeagueMatchResult({
      matchId: "match-1",
      scoreA: 2,
      scoreB: 0,
      casualtiesA: 0,
      casualtiesB: 0,
    });

    expect(result).toEqual({ skipped: true, reason: "participant-missing" });
    expect(mockPrisma.leagueParticipant.update).not.toHaveBeenCalled();
  });
});
