import { describe, it, expect, vi } from "vitest";
import { persistPlayerDeaths, type GameStateForDeaths } from "./player-death";

describe("persistPlayerDeaths", () => {
  function createMockPrisma() {
    const updateCalls: any[] = [];

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
          return Promise.all(promises);
        }),
      } as any,
      updateCalls,
    };
  }

  it("returns 0 when casualtyResults is empty", async () => {
    const { prisma } = createMockPrisma();
    const gameState: GameStateForDeaths = {
      casualtyResults: {},
      players: [],
    };
    const result = await persistPlayerDeaths(prisma, gameState, "teamA", "teamB");
    expect(result).toBe(0);
  });

  it("returns 0 when no players died", async () => {
    const { prisma } = createMockPrisma();
    const gameState: GameStateForDeaths = {
      casualtyResults: {
        A1: "badly_hurt",
        B3: "seriously_hurt",
        A5: "serious_injury",
      },
      players: [
        { id: "A1", team: "A", number: 1 },
        { id: "B3", team: "B", number: 3 },
        { id: "A5", team: "A", number: 5 },
      ],
    };
    const result = await persistPlayerDeaths(prisma, gameState, "teamA", "teamB");
    expect(result).toBe(0);
    expect(prisma.teamPlayer.findMany).not.toHaveBeenCalled();
  });

  it("marks dead players in the database", async () => {
    const { prisma } = createMockPrisma();

    prisma.teamPlayer.findMany
      .mockResolvedValueOnce([
        { id: "db-a1", number: 1 },
        { id: "db-a7", number: 7 },
      ])
      .mockResolvedValueOnce([
        { id: "db-b3", number: 3 },
      ]);

    const gameState: GameStateForDeaths = {
      casualtyResults: {
        A7: "dead",
        B3: "badly_hurt",
        A1: "lasting_injury",
      },
      players: [
        { id: "A1", team: "A", number: 1 },
        { id: "A7", team: "A", number: 7 },
        { id: "B3", team: "B", number: 3 },
      ],
    };

    const result = await persistPlayerDeaths(prisma, gameState, "teamA-id", "teamB-id");

    expect(result).toBe(1); // Only A7 died
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);

    // Verify the update was for the correct player
    const updateCall = prisma.teamPlayer.update.mock.calls[0][0];
    expect(updateCall.where.id).toBe("db-a7");
    expect(updateCall.data.dead).toBe(true);
    expect(updateCall.data.diedAt).toBeInstanceOf(Date);
  });

  it("handles multiple deaths across both teams", async () => {
    const { prisma } = createMockPrisma();

    prisma.teamPlayer.findMany
      .mockResolvedValueOnce([
        { id: "db-a2", number: 2 },
        { id: "db-a5", number: 5 },
      ])
      .mockResolvedValueOnce([
        { id: "db-b1", number: 1 },
      ]);

    const gameState: GameStateForDeaths = {
      casualtyResults: {
        A2: "dead",
        A5: "dead",
        B1: "dead",
      },
      players: [
        { id: "A2", team: "A", number: 2 },
        { id: "A5", team: "A", number: 5 },
        { id: "B1", team: "B", number: 1 },
      ],
    };

    const result = await persistPlayerDeaths(prisma, gameState, "teamA-id", "teamB-id");

    expect(result).toBe(3);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.teamPlayer.update).toHaveBeenCalledTimes(3);
  });

  it("skips dead players not found in database", async () => {
    const { prisma } = createMockPrisma();

    // No matching players in DB
    prisma.teamPlayer.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const gameState: GameStateForDeaths = {
      casualtyResults: {
        A99: "dead",
      },
      players: [
        { id: "A99", team: "A", number: 99 },
      ],
    };

    const result = await persistPlayerDeaths(prisma, gameState, "teamA-id", "teamB-id");

    expect(result).toBe(0);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
