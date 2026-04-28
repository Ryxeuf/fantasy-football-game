import { describe, it, expect, vi, beforeEach } from "vitest";
import { cancelMatch } from "./match-cancel";

function makePrismaMock(
  initial: {
    match?: any;
    turnCount?: number;
  } = {},
) {
  const state = {
    match: initial.match,
    turnCount: initial.turnCount ?? 0,
    createdTurns: [] as any[],
    updatedMatch: null as any,
  };

  const prisma = {
    match: {
      findUnique: vi.fn(async (_args: any) => state.match || null),
      update: vi.fn(async (args: any) => {
        state.updatedMatch = { ...state.match, ...args.data };
        state.match = state.updatedMatch;
        return state.updatedMatch;
      }),
    },
    turn: {
      count: vi.fn(async () => state.turnCount),
      create: vi.fn(async (args: any) => {
        state.createdTurns.push(args.data);
        state.turnCount += 1;
        return args.data;
      }),
    },
  };
  return { prisma, state };
}

describe("cancelMatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when the match does not exist", async () => {
    const { prisma } = makePrismaMock({ match: null });

    const result = await cancelMatch(prisma as any, {
      matchId: "missing",
      userId: "u1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
      expect(result.error).toMatch(/introuvable/i);
    }
  });

  it("rejects when the match has already started (status !== pending)", async () => {
    const { prisma } = makePrismaMock({
      match: {
        id: "m1",
        status: "active",
        players: [{ id: "u1" }, { id: "u2" }],
      },
    });

    const result = await cancelMatch(prisma as any, {
      matchId: "m1",
      userId: "u1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toMatch(/deja commence|annule/i);
    }
  });

  it("forbids users who are not part of the match", async () => {
    const { prisma } = makePrismaMock({
      match: {
        id: "m1",
        status: "pending",
        players: [{ id: "u1" }, { id: "u2" }],
      },
    });

    const result = await cancelMatch(prisma as any, {
      matchId: "m1",
      userId: "stranger",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
    }
  });

  it("cancels a pending match for a registered player and writes an audit turn", async () => {
    const { prisma, state } = makePrismaMock({
      match: {
        id: "m1",
        status: "pending",
        players: [{ id: "u1" }, { id: "u2" }],
      },
      turnCount: 2,
    });

    const result = await cancelMatch(prisma as any, {
      matchId: "m1",
      userId: "u1",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe("cancelled");
    }
    expect(prisma.match.update).toHaveBeenCalledWith({
      where: { id: "m1" },
      data: { status: "cancelled" },
    });
    expect(state.createdTurns).toHaveLength(1);
    expect(state.createdTurns[0]).toMatchObject({
      matchId: "m1",
      number: 3,
      payload: expect.objectContaining({ type: "cancel", userId: "u1" }),
    });
  });

  it("works when the match has no recorded players list (defensive)", async () => {
    const { prisma } = makePrismaMock({
      match: {
        id: "m1",
        status: "pending",
        // players intentionally undefined
      },
    });

    const result = await cancelMatch(prisma as any, {
      matchId: "m1",
      userId: "u1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
    }
  });
});
