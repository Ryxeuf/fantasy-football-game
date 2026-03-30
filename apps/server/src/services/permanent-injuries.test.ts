import { describe, it, expect, vi } from "vitest";
import { persistPermanentInjuries, type GameStateForInjuries } from "./permanent-injuries";

describe("persistPermanentInjuries", () => {
  function createMockPrisma() {
    return {
      prisma: {
        teamPlayer: {
          findMany: vi.fn().mockResolvedValue([]),
          update: vi.fn().mockImplementation((args: any) => Promise.resolve(args.data)),
        },
        $transaction: vi.fn().mockImplementation(async (promises: any[]) => {
          return Promise.all(promises);
        }),
      } as any,
    };
  }

  it("returns 0 when lastingInjuryDetails is empty", async () => {
    const { prisma } = createMockPrisma();
    const gameState: GameStateForInjuries = {
      casualtyResults: {},
      lastingInjuryDetails: {},
      players: [],
    };
    const result = await persistPermanentInjuries(prisma, gameState, "teamA", "teamB");
    expect(result).toBe(0);
  });

  it("returns 0 when lastingInjuryDetails is undefined", async () => {
    const { prisma } = createMockPrisma();
    const gameState = {
      casualtyResults: {},
      lastingInjuryDetails: undefined as any,
      players: [],
    } as GameStateForInjuries;
    const result = await persistPermanentInjuries(prisma, gameState, "teamA", "teamB");
    expect(result).toBe(0);
  });

  it("persists niggling injury for serious_injury outcome", async () => {
    const { prisma } = createMockPrisma();

    prisma.teamPlayer.findMany
      .mockResolvedValueOnce([{ id: "db-a3", number: 3 }])
      .mockResolvedValueOnce([]);

    const gameState: GameStateForInjuries = {
      casualtyResults: { A3: "serious_injury" },
      lastingInjuryDetails: {
        A3: { outcome: "serious_injury", injuryType: "niggling", missNextMatch: true },
      },
      players: [{ id: "A3", team: "A", number: 3 }],
    };

    const result = await persistPermanentInjuries(prisma, gameState, "teamA-id", "teamB-id");

    expect(result).toBe(1);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);

    const updateCall = prisma.teamPlayer.update.mock.calls[0][0];
    expect(updateCall.where.id).toBe("db-a3");
    expect(updateCall.data.nigglingInjuries).toEqual({ increment: 1 });
    expect(updateCall.data.missNextMatch).toBe(true);
  });

  it("persists stat reduction for lasting_injury outcome (-1 MA)", async () => {
    const { prisma } = createMockPrisma();

    prisma.teamPlayer.findMany
      .mockResolvedValueOnce([{ id: "db-a5", number: 5 }])
      .mockResolvedValueOnce([]);

    const gameState: GameStateForInjuries = {
      casualtyResults: { A5: "lasting_injury" },
      lastingInjuryDetails: {
        A5: { outcome: "lasting_injury", injuryType: "-1ma", missNextMatch: true },
      },
      players: [{ id: "A5", team: "A", number: 5 }],
    };

    const result = await persistPermanentInjuries(prisma, gameState, "teamA-id", "teamB-id");

    expect(result).toBe(1);
    const updateCall = prisma.teamPlayer.update.mock.calls[0][0];
    expect(updateCall.data.maReduction).toEqual({ increment: 1 });
    expect(updateCall.data.missNextMatch).toBe(true);
  });

  it("persists stat reduction for lasting_injury outcome (-1 ST)", async () => {
    const { prisma } = createMockPrisma();

    prisma.teamPlayer.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "db-b2", number: 2 }]);

    const gameState: GameStateForInjuries = {
      casualtyResults: { B2: "lasting_injury" },
      lastingInjuryDetails: {
        B2: { outcome: "lasting_injury", injuryType: "-1st", missNextMatch: true },
      },
      players: [{ id: "B2", team: "B", number: 2 }],
    };

    const result = await persistPermanentInjuries(prisma, gameState, "teamA-id", "teamB-id");

    expect(result).toBe(1);
    const updateCall = prisma.teamPlayer.update.mock.calls[0][0];
    expect(updateCall.data.stReduction).toEqual({ increment: 1 });
    expect(updateCall.data.missNextMatch).toBe(true);
  });

  it("persists missNextMatch for seriously_hurt without stat changes", async () => {
    const { prisma } = createMockPrisma();

    prisma.teamPlayer.findMany
      .mockResolvedValueOnce([{ id: "db-a1", number: 1 }])
      .mockResolvedValueOnce([]);

    const gameState: GameStateForInjuries = {
      casualtyResults: { A1: "seriously_hurt" },
      lastingInjuryDetails: {
        A1: { outcome: "seriously_hurt", injuryType: "niggling", missNextMatch: true },
      },
      players: [{ id: "A1", team: "A", number: 1 }],
    };

    const result = await persistPermanentInjuries(prisma, gameState, "teamA-id", "teamB-id");

    expect(result).toBe(1);
    const updateCall = prisma.teamPlayer.update.mock.calls[0][0];
    expect(updateCall.data.missNextMatch).toBe(true);
    // No stat changes for seriously_hurt
    expect(updateCall.data.nigglingInjuries).toBeUndefined();
    expect(updateCall.data.maReduction).toBeUndefined();
  });

  it("handles multiple injuries across both teams", async () => {
    const { prisma } = createMockPrisma();

    prisma.teamPlayer.findMany
      .mockResolvedValueOnce([
        { id: "db-a2", number: 2 },
        { id: "db-a7", number: 7 },
      ])
      .mockResolvedValueOnce([{ id: "db-b4", number: 4 }]);

    const gameState: GameStateForInjuries = {
      casualtyResults: {
        A2: "serious_injury",
        A7: "lasting_injury",
        B4: "lasting_injury",
      },
      lastingInjuryDetails: {
        A2: { outcome: "serious_injury", injuryType: "niggling", missNextMatch: true },
        A7: { outcome: "lasting_injury", injuryType: "-1ag", missNextMatch: true },
        B4: { outcome: "lasting_injury", injuryType: "-1av", missNextMatch: true },
      },
      players: [
        { id: "A2", team: "A", number: 2 },
        { id: "A7", team: "A", number: 7 },
        { id: "B4", team: "B", number: 4 },
      ],
    };

    const result = await persistPermanentInjuries(prisma, gameState, "teamA-id", "teamB-id");

    expect(result).toBe(3);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.teamPlayer.update).toHaveBeenCalledTimes(3);
  });

  it("skips injured players not found in database", async () => {
    const { prisma } = createMockPrisma();

    prisma.teamPlayer.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const gameState: GameStateForInjuries = {
      casualtyResults: { A99: "lasting_injury" },
      lastingInjuryDetails: {
        A99: { outcome: "lasting_injury", injuryType: "-1st", missNextMatch: true },
      },
      players: [{ id: "A99", team: "A", number: 99 }],
    };

    const result = await persistPermanentInjuries(prisma, gameState, "teamA-id", "teamB-id");

    expect(result).toBe(0);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
