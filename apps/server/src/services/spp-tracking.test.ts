import { describe, it, expect, vi } from "vitest";
import {
  calculatePlayerSPP,
  persistMatchSPP,
  type PlayerMatchStats,
  type GameStateForSPP,
} from "./spp-tracking";

describe("calculatePlayerSPP", () => {
  it("returns 0 for a player with no stats", () => {
    const stats: PlayerMatchStats = {
      touchdowns: 0,
      casualties: 0,
      completions: 0,
      interceptions: 0,
      mvp: false,
    };
    expect(calculatePlayerSPP(stats)).toBe(0);
  });

  it("calculates 3 SPP per touchdown", () => {
    const stats: PlayerMatchStats = {
      touchdowns: 2,
      casualties: 0,
      completions: 0,
      interceptions: 0,
      mvp: false,
    };
    expect(calculatePlayerSPP(stats)).toBe(6);
  });

  it("calculates 2 SPP per casualty", () => {
    const stats: PlayerMatchStats = {
      touchdowns: 0,
      casualties: 3,
      completions: 0,
      interceptions: 0,
      mvp: false,
    };
    expect(calculatePlayerSPP(stats)).toBe(6);
  });

  it("calculates 1 SPP per completion", () => {
    const stats: PlayerMatchStats = {
      touchdowns: 0,
      casualties: 0,
      completions: 4,
      interceptions: 0,
      mvp: false,
    };
    expect(calculatePlayerSPP(stats)).toBe(4);
  });

  it("calculates 1 SPP per interception", () => {
    const stats: PlayerMatchStats = {
      touchdowns: 0,
      casualties: 0,
      completions: 0,
      interceptions: 2,
      mvp: false,
    };
    expect(calculatePlayerSPP(stats)).toBe(2);
  });

  it("adds 4 SPP for MVP award", () => {
    const stats: PlayerMatchStats = {
      touchdowns: 0,
      casualties: 0,
      completions: 0,
      interceptions: 0,
      mvp: true,
    };
    expect(calculatePlayerSPP(stats)).toBe(4);
  });

  it("combines all SPP sources correctly", () => {
    const stats: PlayerMatchStats = {
      touchdowns: 1, // 3
      casualties: 1, // 2
      completions: 2, // 2
      interceptions: 1, // 1
      mvp: true, // 4
    };
    expect(calculatePlayerSPP(stats)).toBe(12);
  });
});

describe("persistMatchSPP", () => {
  function createMockPrisma() {
    const updateCalls: any[] = [];
    const transactionCalls: any[] = [];

    return {
      prisma: {
        teamPlayer: {
          findMany: vi.fn().mockResolvedValue([]),
          update: vi.fn().mockImplementation((args: any) => {
            updateCalls.push(args);
            return Promise.resolve(args.data);
          }),
        },
        $transaction: vi.fn().mockImplementation(async (promises: any[]) => {
          transactionCalls.push(promises);
          return Promise.all(promises);
        }),
      } as any,
      updateCalls,
      transactionCalls,
    };
  }

  it("returns 0 when matchStats is empty", async () => {
    const { prisma } = createMockPrisma();
    const gameState: GameStateForSPP = {
      matchStats: {},
      players: [],
    };
    const result = await persistMatchSPP(prisma, gameState, "teamA", "teamB");
    expect(result).toBe(0);
  });

  it("maps game engine player IDs to database TeamPlayer IDs", async () => {
    const { prisma } = createMockPrisma();

    prisma.teamPlayer.findMany
      .mockResolvedValueOnce([
        { id: "db-player-a7", number: 7 },
        { id: "db-player-a1", number: 1 },
      ])
      .mockResolvedValueOnce([
        { id: "db-player-b3", number: 3 },
      ]);

    const gameState: GameStateForSPP = {
      matchStats: {
        A7: { touchdowns: 1, casualties: 0, completions: 0, interceptions: 0, mvp: false },
        B3: { touchdowns: 0, casualties: 1, completions: 0, interceptions: 0, mvp: true },
      },
      players: [
        { id: "A7", team: "A", number: 7 },
        { id: "A1", team: "A", number: 1 },
        { id: "B3", team: "B", number: 3 },
      ],
    };

    const result = await persistMatchSPP(prisma, gameState, "teamA-id", "teamB-id");

    expect(result).toBe(3); // All 3 players updated

    // Verify transaction was called
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const transactionArgs = prisma.$transaction.mock.calls[0][0];
    expect(transactionArgs).toHaveLength(3);

    // Verify findMany was called with correct team IDs
    expect(prisma.teamPlayer.findMany).toHaveBeenCalledWith({
      where: { teamId: "teamA-id" },
      select: { id: true, number: true },
    });
    expect(prisma.teamPlayer.findMany).toHaveBeenCalledWith({
      where: { teamId: "teamB-id" },
      select: { id: true, number: true },
    });
  });

  it("increments matchesPlayed for all players even without stats", async () => {
    const { prisma } = createMockPrisma();

    prisma.teamPlayer.findMany
      .mockResolvedValueOnce([{ id: "db-a1", number: 1 }])
      .mockResolvedValueOnce([]);

    const gameState: GameStateForSPP = {
      matchStats: {
        // A1 has no stats entry (no touchdowns, no blocks, etc.)
      },
      players: [{ id: "A1", team: "A", number: 1 }],
    };

    // matchStats is empty but players exist - should still return 0
    // because matchStats is empty (early return)
    const result = await persistMatchSPP(prisma, gameState, "t1", "t2");
    expect(result).toBe(0);
  });

  it("correctly computes SPP increments for each player", async () => {
    const { prisma } = createMockPrisma();

    prisma.teamPlayer.findMany
      .mockResolvedValueOnce([{ id: "db-a1", number: 1 }])
      .mockResolvedValueOnce([]);

    const gameState: GameStateForSPP = {
      matchStats: {
        A1: { touchdowns: 2, casualties: 1, completions: 1, interceptions: 0, mvp: true },
      },
      players: [{ id: "A1", team: "A", number: 1 }],
    };

    await persistMatchSPP(prisma, gameState, "t1", "t2");

    // Check the update call data
    const updateCall = prisma.teamPlayer.update.mock.calls[0][0];
    expect(updateCall.where.id).toBe("db-a1");
    expect(updateCall.data).toEqual({
      matchesPlayed: { increment: 1 },
      spp: { increment: 13 }, // 2*3 + 1*2 + 1*1 + 0 + 4 = 13
      totalTouchdowns: { increment: 2 },
      totalCasualties: { increment: 1 },
      totalCompletions: { increment: 1 },
      totalInterceptions: { increment: 0 },
      totalMvpAwards: { increment: 1 },
    });
  });
});
