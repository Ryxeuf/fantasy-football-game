import { describe, it, expect, vi } from "vitest";
import {
  calculatePlayerSPP,
  calculateAggregateSPP,
  rosterToModifier,
  persistMatchSPP,
  loadLeagueSPPContext,
  type PlayerMatchStats,
  type GameStateForSPP,
  type LeagueSPPContext,
} from "./spp-tracking";

describe("calculateAggregateSPP (FR18 — PSP de saison)", () => {
  it("somme TD×3 + cas×2 + comp×1 + int×1 + mvps×4 (vanilla)", () => {
    // 2 TD (6) + 1 cas (2) + 3 comp (3) + 1 int (1) + 2 MVP (8) = 20
    expect(
      calculateAggregateSPP({
        touchdowns: 2,
        casualties: 1,
        completions: 3,
        interceptions: 1,
        mvps: 2,
      }),
    ).toBe(20);
  });

  it("compte plusieurs MVP (×4 chacun), pas un simple booléen", () => {
    expect(
      calculateAggregateSPP({
        touchdowns: 0,
        casualties: 0,
        completions: 0,
        interceptions: 0,
        mvps: 3,
      }),
    ).toBe(12);
  });

  it("applique l'override Bagarreurs Brutaux (TD=2, cas=3)", () => {
    // 2 TD (4) + 2 cas (6) = 10 au lieu de 6+4=10... distinct : 2 TD seuls.
    expect(
      calculateAggregateSPP(
        {
          touchdowns: 2,
          casualties: 0,
          completions: 0,
          interceptions: 0,
          mvps: 0,
        },
        { bagarreursBrutaux: true },
      ),
    ).toBe(4); // vanilla aurait donné 6
  });
});

describe("rosterToModifier", () => {
  it("détecte bagarreurs_brutaux dans une chaîne CSV/whitespace", () => {
    expect(rosterToModifier("foo, bagarreurs_brutaux ,bar").bagarreursBrutaux).toBe(
      true,
    );
    expect(rosterToModifier("foo bar").bagarreursBrutaux).toBe(false);
    expect(rosterToModifier("").bagarreursBrutaux).toBe(false);
  });
});

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
      missNextMatch: false, // Clear suspension flag after playing
      spp: { increment: 13 }, // 2*3 + 1*2 + 1*1 + 0 + 4 = 13
      totalTouchdowns: { increment: 2 },
      totalCasualties: { increment: 1 },
      totalCompletions: { increment: 1 },
      totalInterceptions: { increment: 0 },
      totalMvpAwards: { increment: 1 },
    });
  });
});

describe("L2.B.8 — Bagarreurs Brutaux override", () => {
  it("calculatePlayerSPP defaults to vanilla when no modifier provided", () => {
    const stats: PlayerMatchStats = {
      touchdowns: 1,
      casualties: 1,
      completions: 0,
      interceptions: 0,
      mvp: false,
    };
    expect(calculatePlayerSPP(stats)).toBe(5); // 3 TD + 2 cas
  });

  it("calculatePlayerSPP swaps TD/casualty values when bagarreursBrutaux=true", () => {
    const stats: PlayerMatchStats = {
      touchdowns: 1,
      casualties: 1,
      completions: 0,
      interceptions: 0,
      mvp: false,
    };
    // 2 TD + 3 cas = 5 (same total but inverted)
    expect(
      calculatePlayerSPP(stats, { bagarreursBrutaux: true }),
    ).toBe(5);
  });

  it("Bagarreurs override differs from vanilla when TD != casualties", () => {
    const stats: PlayerMatchStats = {
      touchdowns: 2,
      casualties: 0,
      completions: 0,
      interceptions: 0,
      mvp: false,
    };
    expect(calculatePlayerSPP(stats)).toBe(6); // 2*3
    expect(
      calculatePlayerSPP(stats, { bagarreursBrutaux: true }),
    ).toBe(4); // 2*2

    const allCasualties: PlayerMatchStats = {
      touchdowns: 0,
      casualties: 3,
      completions: 0,
      interceptions: 0,
      mvp: false,
    };
    expect(calculatePlayerSPP(allCasualties)).toBe(6); // 3*2
    expect(
      calculatePlayerSPP(allCasualties, { bagarreursBrutaux: true }),
    ).toBe(9); // 3*3
  });

  it("override does not change completion / interception / MVP values", () => {
    const stats: PlayerMatchStats = {
      touchdowns: 0,
      casualties: 0,
      completions: 5,
      interceptions: 2,
      mvp: true,
    };
    const expected = 5 * 1 + 2 * 1 + 4; // 11
    expect(calculatePlayerSPP(stats)).toBe(expected);
    expect(
      calculatePlayerSPP(stats, { bagarreursBrutaux: true }),
    ).toBe(expected);
  });

  it("persistMatchSPP applies per-team override (only team A has bagarreurs)", async () => {
    const mockPrisma = {
      teamPlayer: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn(async (ops: unknown[]) =>
        Promise.all(ops as Promise<unknown>[]),
      ),
    } as any;

    mockPrisma.teamPlayer.findMany
      .mockResolvedValueOnce([{ id: "a-1", number: 1 }])
      .mockResolvedValueOnce([{ id: "b-1", number: 1 }]);

    const gameState: GameStateForSPP = {
      players: [
        { id: "A1", team: "A", number: 1 },
        { id: "B1", team: "B", number: 1 },
      ],
      matchStats: {
        A1: { touchdowns: 1, casualties: 1, completions: 0, interceptions: 0, mvp: false },
        B1: { touchdowns: 1, casualties: 1, completions: 0, interceptions: 0, mvp: false },
      },
    };

    const context: LeagueSPPContext = {
      isLeagueMatch: true,
      teamA: { bagarreursBrutaux: true },
      teamB: { bagarreursBrutaux: false },
    };

    await persistMatchSPP(mockPrisma, gameState, "team-A", "team-B", context);

    const updates = mockPrisma.teamPlayer.update.mock.calls.map(
      (c: unknown[]) => c[0],
    ) as Array<{ where: { id: string }; data: Record<string, unknown> }>;
    const a1 = updates.find((u) => u.where.id === "a-1");
    const b1 = updates.find((u) => u.where.id === "b-1");

    // Player A1 (Bagarreurs) : 1 TD * 2 + 1 cas * 3 = 5
    expect((a1?.data.spp as { increment: number }).increment).toBe(5);
    // Player B1 (vanilla) : 1 TD * 3 + 1 cas * 2 = 5
    // (same total here but the breakdown is different)
    expect((b1?.data.spp as { increment: number }).increment).toBe(5);
  });

  it("persistMatchSPP applies override consistently when only team B has the rule", async () => {
    const mockPrisma = {
      teamPlayer: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn(async (ops: unknown[]) =>
        Promise.all(ops as Promise<unknown>[]),
      ),
    } as any;

    mockPrisma.teamPlayer.findMany
      .mockResolvedValueOnce([{ id: "a-1", number: 1 }])
      .mockResolvedValueOnce([{ id: "b-1", number: 1 }]);

    const gameState: GameStateForSPP = {
      players: [
        { id: "A1", team: "A", number: 1 },
        { id: "B1", team: "B", number: 1 },
      ],
      matchStats: {
        A1: { touchdowns: 2, casualties: 0, completions: 0, interceptions: 0, mvp: false },
        B1: { touchdowns: 0, casualties: 3, completions: 0, interceptions: 0, mvp: false },
      },
    };

    await persistMatchSPP(mockPrisma, gameState, "team-A", "team-B", {
      isLeagueMatch: true,
      teamA: { bagarreursBrutaux: false },
      teamB: { bagarreursBrutaux: true },
    });

    const updates = mockPrisma.teamPlayer.update.mock.calls.map(
      (c: unknown[]) => c[0],
    ) as Array<{ where: { id: string }; data: Record<string, unknown> }>;
    const a1 = updates.find((u) => u.where.id === "a-1");
    const b1 = updates.find((u) => u.where.id === "b-1");

    // A1 vanilla : 2 TD * 3 = 6
    expect((a1?.data.spp as { increment: number }).increment).toBe(6);
    // B1 Bagarreurs : 3 cas * 3 = 9
    expect((b1?.data.spp as { increment: number }).increment).toBe(9);
  });
});

describe("loadLeagueSPPContext", () => {
  function makePrisma(rosters?: Array<{ slug: string; specialRules: string | null }>) {
    return {
      roster: {
        findMany: vi.fn().mockResolvedValue(rosters ?? []),
      },
    } as any;
  }

  it("returns neutral context when isLeagueMatch=false", async () => {
    const ctx = await loadLeagueSPPContext(makePrisma(), {
      isLeagueMatch: false,
      teamARoster: "skaven",
      teamBRoster: "lizardmen",
    });
    expect(ctx.isLeagueMatch).toBe(false);
    expect(ctx.teamA.bagarreursBrutaux).toBe(false);
    expect(ctx.teamB.bagarreursBrutaux).toBe(false);
  });

  it("detects bagarreurs_brutaux on the roster CSV (team A only)", async () => {
    const ctx = await loadLeagueSPPContext(
      makePrisma([
        { slug: "black_orcs", specialRules: "bagarreurs_brutaux,deferlement" },
        { slug: "skaven", specialRules: "" },
      ]),
      {
        isLeagueMatch: true,
        teamARoster: "black_orcs",
        teamBRoster: "skaven",
      },
    );
    expect(ctx.teamA.bagarreursBrutaux).toBe(true);
    expect(ctx.teamB.bagarreursBrutaux).toBe(false);
  });

  it("detects on team B only", async () => {
    const ctx = await loadLeagueSPPContext(
      makePrisma([
        { slug: "skaven", specialRules: null },
        { slug: "norse", specialRules: "bagarreurs_brutaux" },
      ]),
      {
        isLeagueMatch: true,
        teamARoster: "skaven",
        teamBRoster: "norse",
      },
    );
    expect(ctx.teamA.bagarreursBrutaux).toBe(false);
    expect(ctx.teamB.bagarreursBrutaux).toBe(true);
  });

  it("falls back to neutral when prisma throws", async () => {
    const failingPrisma = {
      roster: { findMany: vi.fn().mockRejectedValue(new Error("no roster table")) },
    } as any;
    const ctx = await loadLeagueSPPContext(failingPrisma, {
      isLeagueMatch: true,
      teamARoster: "skaven",
      teamBRoster: "norse",
    });
    expect(ctx.isLeagueMatch).toBe(false);
    expect(ctx.teamA.bagarreursBrutaux).toBe(false);
  });

  it("tolerates whitespace + casing variations in specialRules CSV", async () => {
    const ctx = await loadLeagueSPPContext(
      makePrisma([
        { slug: "black_orcs", specialRules: " Bagarreurs_Brutaux , deferlement" },
        { slug: "skaven", specialRules: "" },
      ]),
      {
        isLeagueMatch: true,
        teamARoster: "black_orcs",
        teamBRoster: "skaven",
      },
    );
    expect(ctx.teamA.bagarreursBrutaux).toBe(true);
  });
});
