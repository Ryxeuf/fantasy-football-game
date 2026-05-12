/**
 * Sprint R — Lot R.E.1 : tests du service async-match.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    match: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    turn: {
      create: vi.fn(),
    },
    teamSelection: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("../utils/server-log", () => ({
  serverLog: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@bb/game-engine", () => ({
  applyMove: vi.fn(),
  isMatchEnded: vi.fn(),
  makeRNG: vi.fn(() => () => 0.5),
}));

import { prisma } from "../prisma";
import { applyMove, isMatchEnded } from "@bb/game-engine";
import {
  AsyncMatchError,
  DEFAULT_TURN_DEADLINE_HOURS,
  MAX_TURN_DEADLINE_HOURS,
  MIN_TURN_DEADLINE_HOURS,
  computeDeadline,
  findExpiredAsyncMatches,
  forceEndTurnOnDeadline,
  getAsyncMatchView,
  markTurnDeadline,
  sweepExpiredAsyncMatches,
} from "./async-match";

const mocked = prisma as unknown as {
  match: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  turn: { create: ReturnType<typeof vi.fn> };
  teamSelection: { findMany: ReturnType<typeof vi.fn> };
};

const mockedApplyMove = vi.mocked(applyMove);
const mockedIsMatchEnded = vi.mocked(isMatchEnded);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("computeDeadline", () => {
  it("retourne now + hours en milliseconds", () => {
    const now = new Date("2026-05-12T10:00:00Z");
    const deadline = computeDeadline(now, 24);
    expect(deadline.toISOString()).toBe("2026-05-13T10:00:00.000Z");
  });

  it("clamp en dessous du min (1h)", () => {
    const now = new Date("2026-05-12T10:00:00Z");
    const deadline = computeDeadline(now, 0);
    expect(deadline.getTime() - now.getTime()).toBe(
      MIN_TURN_DEADLINE_HOURS * 60 * 60 * 1000,
    );
  });

  it("clamp au-dessus du max (1 semaine)", () => {
    const now = new Date("2026-05-12T10:00:00Z");
    const deadline = computeDeadline(now, 9999);
    expect(deadline.getTime() - now.getTime()).toBe(
      MAX_TURN_DEADLINE_HOURS * 60 * 60 * 1000,
    );
  });

  it("default 24h", () => {
    expect(DEFAULT_TURN_DEADLINE_HOURS).toBe(24);
  });
});

describe("markTurnDeadline", () => {
  it("set deadline = now + hours en mode async actif", async () => {
    const now = new Date("2026-05-12T10:00:00Z");
    mocked.match.findUnique.mockResolvedValue({
      mode: "async",
      turnDeadlineHours: 24,
      status: "active",
    } as never);

    await markTurnDeadline("m_1", { now });

    expect(mocked.match.update).toHaveBeenCalledWith({
      where: { id: "m_1" },
      data: {
        currentTurnDeadline: new Date("2026-05-13T10:00:00Z"),
      },
    });
  });

  it("no-op en mode realtime", async () => {
    mocked.match.findUnique.mockResolvedValue({
      mode: "realtime",
      turnDeadlineHours: 24,
      status: "active",
    } as never);

    await markTurnDeadline("m_1");

    expect(mocked.match.update).not.toHaveBeenCalled();
  });

  it("reset deadline a null quand match termine (matchEnded=true)", async () => {
    mocked.match.findUnique.mockResolvedValue({
      mode: "async",
      turnDeadlineHours: 24,
      status: "active",
    } as never);

    await markTurnDeadline("m_1", { matchEnded: true });

    expect(mocked.match.update).toHaveBeenCalledWith({
      where: { id: "m_1" },
      data: { currentTurnDeadline: null },
    });
  });

  it("reset deadline a null si status != active", async () => {
    mocked.match.findUnique.mockResolvedValue({
      mode: "async",
      turnDeadlineHours: 24,
      status: "ended",
    } as never);

    await markTurnDeadline("m_1");

    expect(mocked.match.update).toHaveBeenCalledWith({
      where: { id: "m_1" },
      data: { currentTurnDeadline: null },
    });
  });

  it("no-op si match inexistant", async () => {
    mocked.match.findUnique.mockResolvedValue(null as never);
    await markTurnDeadline("missing");
    expect(mocked.match.update).not.toHaveBeenCalled();
  });
});

describe("findExpiredAsyncMatches", () => {
  it("filtre mode=async + status=active + deadline < now", async () => {
    const now = new Date("2026-05-12T10:00:00Z");
    mocked.match.findMany.mockResolvedValue([
      {
        id: "m_1",
        currentTurnUserId: "u_1",
        currentTurnDeadline: new Date("2026-05-12T09:00:00Z"),
      },
    ] as never);

    const result = await findExpiredAsyncMatches(now);

    expect(mocked.match.findMany).toHaveBeenCalledWith({
      where: {
        mode: "async",
        status: "active",
        currentTurnDeadline: { lt: now },
      },
      select: expect.any(Object),
      take: 100,
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("m_1");
  });
});

describe("forceEndTurnOnDeadline", () => {
  const baseMatch = {
    id: "m_1",
    mode: "async",
    status: "active",
    seed: "abc",
    currentTurnDeadline: new Date("2026-05-12T09:00:00Z"),
    turnDeadlineHours: 24,
    turns: [
      {
        number: 1,
        payload: {
          type: "gameplay-move",
          gameState: { currentPlayer: "A", players: [] },
        },
      },
    ],
  };
  const now = new Date("2026-05-12T10:00:00Z");

  it("throw MATCH_NOT_FOUND si introuvable", async () => {
    mocked.match.findUnique.mockResolvedValue(null as never);
    await expect(
      forceEndTurnOnDeadline("missing", now),
    ).rejects.toMatchObject({ code: "MATCH_NOT_FOUND" });
  });

  it("throw MATCH_NOT_ASYNC si mode=realtime", async () => {
    mocked.match.findUnique.mockResolvedValue({
      ...baseMatch,
      mode: "realtime",
    } as never);
    await expect(
      forceEndTurnOnDeadline("m_1", now),
    ).rejects.toMatchObject({ code: "MATCH_NOT_ASYNC" });
  });

  it("throw MATCH_NOT_ACTIVE si status != active", async () => {
    mocked.match.findUnique.mockResolvedValue({
      ...baseMatch,
      status: "ended",
    } as never);
    await expect(
      forceEndTurnOnDeadline("m_1", now),
    ).rejects.toMatchObject({ code: "MATCH_NOT_ACTIVE" });
  });

  it("throw DEADLINE_NOT_EXPIRED si deadline > now", async () => {
    mocked.match.findUnique.mockResolvedValue({
      ...baseMatch,
      currentTurnDeadline: new Date("2026-05-12T11:00:00Z"),
    } as never);
    await expect(
      forceEndTurnOnDeadline("m_1", now),
    ).rejects.toMatchObject({ code: "DEADLINE_NOT_EXPIRED" });
  });

  it("apply END_TURN, persist Turn forced, update deadline + currentTurnUserId", async () => {
    mocked.match.findUnique.mockResolvedValue(baseMatch as never);
    mockedApplyMove.mockReturnValue({
      currentPlayer: "B",
      players: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    mockedIsMatchEnded.mockReturnValue(false);
    mocked.teamSelection.findMany.mockResolvedValue([
      { userId: "u_a" },
      { userId: "u_b" },
    ] as never);
    mocked.turn.create.mockResolvedValue({} as never);
    mocked.match.update.mockResolvedValue({} as never);

    const out = await forceEndTurnOnDeadline("m_1", now);

    expect(out.previousPlayer).toBe("A");
    expect(out.nextPlayer).toBe("B");
    expect(out.nextUserId).toBe("u_b");
    expect(out.matchEnded).toBe(false);
    expect(out.newDeadline).toEqual(new Date("2026-05-13T10:00:00Z"));

    // Turn cree avec forced=true
    expect(mocked.turn.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        matchId: "m_1",
        payload: expect.objectContaining({
          forced: true,
          forcedReason: "deadline",
          move: { type: "END_TURN" },
        }),
      }),
    });

    // Match update : currentTurnUserId + nouvelle deadline
    expect(mocked.match.update).toHaveBeenCalledWith({
      where: { id: "m_1" },
      data: expect.objectContaining({
        currentTurnUserId: "u_b",
        currentTurnDeadline: new Date("2026-05-13T10:00:00Z"),
        lastMoveAt: now,
      }),
    });
  });

  it("si match termine : status=ended, deadline=null, currentTurnUserId=null", async () => {
    mocked.match.findUnique.mockResolvedValue(baseMatch as never);
    mockedApplyMove.mockReturnValue({
      currentPlayer: "B",
      players: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    mockedIsMatchEnded.mockReturnValue(true);
    mocked.teamSelection.findMany.mockResolvedValue([
      { userId: "u_a" },
      { userId: "u_b" },
    ] as never);
    mocked.turn.create.mockResolvedValue({} as never);
    mocked.match.update.mockResolvedValue({} as never);

    const out = await forceEndTurnOnDeadline("m_1", now);

    expect(out.matchEnded).toBe(true);
    expect(out.newDeadline).toBeNull();
    expect(mocked.match.update).toHaveBeenCalledWith({
      where: { id: "m_1" },
      data: expect.objectContaining({
        status: "ended",
        currentTurnUserId: null,
        currentTurnDeadline: null,
      }),
    });
  });

  it("throw NO_GAMESTATE si aucun turn n'a de gameState", async () => {
    mocked.match.findUnique.mockResolvedValue({
      ...baseMatch,
      turns: [{ number: 1, payload: { type: "system" } }],
    } as never);
    await expect(
      forceEndTurnOnDeadline("m_1", now),
    ).rejects.toMatchObject({ code: "NO_GAMESTATE" });
  });

  it("instanceof AsyncMatchError", async () => {
    mocked.match.findUnique.mockResolvedValue(null as never);
    try {
      await forceEndTurnOnDeadline("missing");
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(AsyncMatchError);
    }
  });
});

describe("sweepExpiredAsyncMatches", () => {
  const now = new Date("2026-05-12T10:00:00Z");

  it("retourne inspected=0 si pas de match expire", async () => {
    mocked.match.findMany.mockResolvedValue([] as never);
    const out = await sweepExpiredAsyncMatches(now);
    expect(out).toEqual({ inspected: 0, forced: 0, failed: 0 });
  });

  it("force end-turn pour chaque match expire", async () => {
    mocked.match.findMany.mockResolvedValue([
      {
        id: "m_1",
        currentTurnUserId: "u_1",
        currentTurnDeadline: new Date("2026-05-12T09:00:00Z"),
      },
    ] as never);
    // Mock pour le findUnique dans forceEndTurnOnDeadline.
    mocked.match.findUnique.mockResolvedValue({
      id: "m_1",
      mode: "async",
      status: "active",
      seed: "abc",
      currentTurnDeadline: new Date("2026-05-12T09:00:00Z"),
      turnDeadlineHours: 24,
      turns: [
        {
          number: 1,
          payload: {
            type: "gameplay-move",
            gameState: { currentPlayer: "A", players: [] },
          },
        },
      ],
    } as never);
    mockedApplyMove.mockReturnValue({
      currentPlayer: "B",
      players: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    mockedIsMatchEnded.mockReturnValue(false);
    mocked.teamSelection.findMany.mockResolvedValue([
      { userId: "u_a" },
      { userId: "u_b" },
    ] as never);
    mocked.turn.create.mockResolvedValue({} as never);
    mocked.match.update.mockResolvedValue({} as never);

    const out = await sweepExpiredAsyncMatches(now);
    expect(out).toEqual({ inspected: 1, forced: 1, failed: 0 });
  });

  it("compte failed sans throw quand un match plante", async () => {
    mocked.match.findMany.mockResolvedValue([
      {
        id: "m_1",
        currentTurnUserId: "u_1",
        currentTurnDeadline: new Date("2026-05-12T09:00:00Z"),
      },
    ] as never);
    mocked.match.findUnique.mockResolvedValue(null as never); // → MATCH_NOT_FOUND

    const out = await sweepExpiredAsyncMatches(now);
    expect(out).toEqual({ inspected: 1, forced: 0, failed: 1 });
  });
});

describe("getAsyncMatchView", () => {
  it("retourne null si match inexistant", async () => {
    mocked.match.findUnique.mockResolvedValue(null as never);
    const view = await getAsyncMatchView("missing", "u_1");
    expect(view).toBeNull();
  });

  it("calcule isYourTurn + hoursRemaining pour async actif", async () => {
    const now = new Date("2026-05-12T10:00:00Z");
    mocked.match.findUnique.mockResolvedValue({
      id: "m_1",
      mode: "async",
      status: "active",
      currentTurnUserId: "u_1",
      currentTurnDeadline: new Date("2026-05-13T10:00:00Z"),
      turnDeadlineHours: 24,
    } as never);

    const view = await getAsyncMatchView("m_1", "u_1", now);
    expect(view).toMatchObject({
      isYourTurn: true,
      hoursRemaining: 24,
      isDeadlineExpired: false,
      mode: "async",
    });
  });

  it("isYourTurn=false pour autre user", async () => {
    const now = new Date("2026-05-12T10:00:00Z");
    mocked.match.findUnique.mockResolvedValue({
      id: "m_1",
      mode: "async",
      status: "active",
      currentTurnUserId: "u_1",
      currentTurnDeadline: new Date("2026-05-13T10:00:00Z"),
      turnDeadlineHours: 24,
    } as never);

    const view = await getAsyncMatchView("m_1", "u_other", now);
    expect(view?.isYourTurn).toBe(false);
  });

  it("isDeadlineExpired=true quand depasse", async () => {
    const now = new Date("2026-05-12T10:00:00Z");
    mocked.match.findUnique.mockResolvedValue({
      id: "m_1",
      mode: "async",
      status: "active",
      currentTurnUserId: "u_1",
      currentTurnDeadline: new Date("2026-05-12T09:00:00Z"),
      turnDeadlineHours: 24,
    } as never);

    const view = await getAsyncMatchView("m_1", "u_1", now);
    expect(view?.isDeadlineExpired).toBe(true);
    expect(view?.hoursRemaining).toBe(0);
  });

  it("hoursRemaining=null en realtime", async () => {
    mocked.match.findUnique.mockResolvedValue({
      id: "m_1",
      mode: "realtime",
      status: "active",
      currentTurnUserId: "u_1",
      currentTurnDeadline: null,
      turnDeadlineHours: 24,
    } as never);

    const view = await getAsyncMatchView("m_1", "u_1");
    expect(view?.hoursRemaining).toBeNull();
    expect(view?.isDeadlineExpired).toBe(false);
  });
});
