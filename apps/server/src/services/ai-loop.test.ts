/**
 * Tests for the server-side AI loop safeguards.
 *
 * We mock the game engine (`applyMove`, `computeAIMove`) and the broadcast
 * module so the tests focus on orchestration: iteration cap, wall-clock
 * timeout, stagnation detection, null-move fallback, concurrency lock.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@bb/game-engine", async () => {
  const actual = await vi.importActual<any>("@bb/game-engine");
  return {
    ...actual,
    applyMove: vi.fn(),
    isMatchEnded: vi.fn().mockReturnValue(false),
    makeRNG: () => () => 0.5,
  };
});

vi.mock("./ai-turn", () => ({
  computeAIMove: vi.fn(),
  isAITurnToAct: vi.fn().mockReturnValue(true),
}));

vi.mock("./game-broadcast", () => ({
  broadcastGameState: vi.fn(),
  broadcastMatchEnd: vi.fn(),
}));

import { applyMove, isMatchEnded } from "@bb/game-engine";
import { computeAIMove, isAITurnToAct } from "./ai-turn";
import { runAILoop, MAX_MOVES_PER_TURN } from "./ai-loop";

function baseState(overrides: any = {}) {
  return {
    currentPlayer: "B",
    turn: 1,
    half: 1,
    score: { teamA: 0, teamB: 0 },
    players: [],
    ...overrides,
  };
}

function makePrismaMock(opts: {
  match?: any;
  turns?: any[];
  selections?: any[];
}) {
  const match = opts.match ?? {
    id: "m1",
    status: "active",
    aiOpponent: true,
    aiTeamSide: "B",
    aiUserId: "ai-user",
    aiDifficulty: "medium",
  };
  const turns = opts.turns ?? [
    {
      number: 1,
      payload: { gameState: baseState() },
    },
  ];
  const selections = opts.selections ?? [
    { userId: "u1" },
    { userId: "ai-user" },
  ];
  return {
    match: {
      findUnique: vi.fn().mockResolvedValue(match),
      update: vi.fn().mockResolvedValue(undefined),
    },
    turn: {
      findMany: vi.fn().mockResolvedValue(turns),
      create: vi.fn().mockImplementation(async ({ data }: any) => {
        turns.push({ number: data.number, payload: data.payload });
        return data;
      }),
    },
    teamSelection: {
      findMany: vi.fn().mockResolvedValue(selections),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  (isMatchEnded as any).mockReturnValue(false);
  (isAITurnToAct as any).mockReturnValue(true);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("runAILoop — happy path", () => {
  it("applies one move and stops when turn changes to the human", async () => {
    const db = makePrismaMock({});
    (computeAIMove as any).mockReturnValue({
      move: { type: "END_TURN" },
      isAITurn: true,
    });
    (applyMove as any).mockImplementation((s: any) => ({
      ...s,
      currentPlayer: "A",
    }));

    const report = await runAILoop({ matchId: "m1" }, db as any);
    expect(report.abortReason).toBe("turn-over");
    expect(report.movesApplied).toBe(1);
  });

  it("chains multiple moves while still AI turn, then exits", async () => {
    const db = makePrismaMock({});
    let calls = 0;
    (computeAIMove as any).mockImplementation(() => ({
      move: { type: "MOVE", playerId: "p", to: { x: calls, y: 0 } },
      isAITurn: true,
    }));
    (applyMove as any).mockImplementation((s: any) => {
      calls += 1;
      const moved = {
        ...s,
        players: [{ id: "p", pos: { x: calls, y: 0 } }],
      };
      return calls < 3 ? moved : { ...moved, currentPlayer: "A" };
    });

    const report = await runAILoop({ matchId: "m1" }, db as any);
    expect(report.abortReason).toBe("turn-over");
    expect(report.movesApplied).toBe(3);
  });
});

describe("runAILoop — safeguards", () => {
  it("hits max-moves when AI keeps returning moves without releasing the turn", async () => {
    const db = makePrismaMock({});
    (computeAIMove as any).mockReturnValue({
      move: { type: "MOVE", playerId: "p", to: { x: 0, y: 0 } },
      isAITurn: true,
    });
    (applyMove as any).mockImplementation((s: any, _m: any) => ({
      ...s,
      // mutate the player pos so anti-stagnation is happy
      players: [{ id: "p", pos: { x: Math.random(), y: 0 } }],
    }));

    const report = await runAILoop(
      { matchId: "m1", maxMoves: 5 },
      db as any,
    );
    expect(report.abortReason).toBe("max-moves");
    expect(report.movesApplied).toBe(5);
  });

  it("aborts on wall-clock timeout", async () => {
    const db = makePrismaMock({});
    (computeAIMove as any).mockReturnValue({
      move: { type: "MOVE", playerId: "p", to: { x: 0, y: 0 } },
      isAITurn: true,
    });
    (applyMove as any).mockImplementation((s: any) => ({
      ...s,
      players: [{ id: "p", pos: { x: Math.random(), y: 0 } }],
    }));

    let t = 0;
    const now = () => {
      t += 2_000;
      return t;
    };
    const report = await runAILoop(
      { matchId: "m1", maxMs: 3_000, now, maxMoves: 1000 },
      db as any,
    );
    expect(report.abortReason).toBe("timeout");
  });

  it("aborts on stagnation (same progress hash twice)", async () => {
    const db = makePrismaMock({});
    (computeAIMove as any).mockReturnValue({
      move: { type: "MOVE", playerId: "p", to: { x: 0, y: 0 } },
      isAITurn: true,
    });
    // identical state returned each time
    (applyMove as any).mockImplementation((s: any) => s);

    const report = await runAILoop({ matchId: "m1" }, db as any);
    expect(report.abortReason).toBe("stagnation");
  });

  it("forces a single END_TURN when computeAIMove returns null", async () => {
    const db = makePrismaMock({});
    (computeAIMove as any).mockReturnValue({
      move: null,
      isAITurn: true,
    });
    (applyMove as any).mockImplementation((s: any, m: any) => {
      expect(m.type).toBe("END_TURN");
      return { ...s, currentPlayer: "B" }; // stays B to exercise the null guard
    });

    const report = await runAILoop({ matchId: "m1" }, db as any);
    expect(report.abortReason).toBe("no-legal-move");
    expect(report.movesApplied).toBe(1);
  });

  it("exits when the match is not configured for AI", async () => {
    const db = makePrismaMock({
      match: { id: "m1", status: "active", aiOpponent: false },
    });
    const report = await runAILoop({ matchId: "m1" }, db as any);
    expect(report.abortReason).toBe("not-configured");
  });

  it("exits when the match is not active", async () => {
    const db = makePrismaMock({
      match: {
        id: "m1",
        status: "prematch-setup",
        aiOpponent: true,
        aiTeamSide: "B",
        aiUserId: "ai",
        aiDifficulty: "easy",
      },
    });
    const report = await runAILoop({ matchId: "m1" }, db as any);
    expect(report.abortReason).toBe("not-configured");
  });

  it("ends the match and broadcasts end when isMatchEnded becomes true", async () => {
    const db = makePrismaMock({});
    (computeAIMove as any).mockReturnValue({
      move: { type: "END_TURN" },
      isAITurn: true,
    });
    (applyMove as any).mockImplementation((s: any) => ({
      ...s,
      currentPlayer: "A",
    }));
    (isMatchEnded as any).mockReturnValueOnce(false).mockReturnValue(true);

    const report = await runAILoop({ matchId: "m1" }, db as any);
    expect(report.abortReason).toBe("match-ended");
    expect(db.match.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "ended" }),
      }),
    );
  });
});

describe("runAILoop — concurrency lock", () => {
  it("coalesces concurrent runs for the same matchId", async () => {
    const db = makePrismaMock({});
    (computeAIMove as any).mockReturnValue({
      move: { type: "END_TURN" },
      isAITurn: true,
    });
    (applyMove as any).mockImplementation((s: any) => ({
      ...s,
      currentPlayer: "A",
    }));

    const [a, b] = await Promise.all([
      runAILoop({ matchId: "concurrent" }, db as any),
      runAILoop({ matchId: "concurrent" }, db as any),
    ]);
    // One run does the work, the other is coalesced and reports 0 moves.
    const total = a.movesApplied + b.movesApplied;
    expect(total).toBe(1);
  });
});

describe("runAILoop — guardrails constants", () => {
  it("exports MAX_MOVES_PER_TURN = 64", () => {
    expect(MAX_MOVES_PER_TURN).toBe(64);
  });
});
