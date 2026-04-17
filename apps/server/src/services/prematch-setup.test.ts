import { describe, it, expect, vi, beforeEach } from "vitest";
import { ensureSetupPhasePersisted } from "./prematch-setup";

/**
 * These unit tests stub the Prisma client with vi.fn() factories and verify
 * the read-modify-write behaviour of `ensureSetupPhasePersisted`:
 *
 *   - no-op when the latest gameState is already past `idle`
 *   - transitions `idle → setup` and persists a new `setup-init` turn
 *   - idempotency when a second call sees the persisted setup state
 *   - returns null for unknown matches or wrong status
 */

interface Turn {
  id: string;
  number: number;
  payload: any;
  createdAt: Date;
}

function makeIdleGameState() {
  return {
    players: [
      { id: "p1", team: "A", pos: { x: 0, y: 0 } },
      { id: "p2", team: "B", pos: { x: 0, y: 0 } },
    ],
    preMatch: { phase: "idle" },
    half: 0,
    teamNames: { teamA: "A", teamB: "B" },
    gameLog: [],
    height: 15,
    width: 26,
  };
}

function createMockPrisma({
  match,
  turns,
  selections,
  roster,
}: {
  match: any;
  turns: Turn[];
  selections: any[];
  roster?: any;
}) {
  const state = {
    turns: [...turns],
    match: { ...match },
  };

  const tx = {
    match: {
      findUnique: vi.fn().mockImplementation(async (args: any) => {
        if (args.where.id !== state.match.id) return null;
        return {
          ...state.match,
          turns: [...state.turns].sort((a, b) => a.number - b.number),
        };
      }),
      update: vi.fn().mockImplementation(async (args: any) => {
        state.match = { ...state.match, ...args.data };
        return state.match;
      }),
    },
    teamSelection: {
      findMany: vi.fn().mockResolvedValue(selections),
    },
    turn: {
      create: vi.fn().mockImplementation(async (args: any) => {
        const turn: Turn = {
          id: `turn-${state.turns.length + 1}`,
          number: args.data.number,
          payload: args.data.payload,
          createdAt: new Date(),
        };
        state.turns.push(turn);
        return turn;
      }),
    },
    roster: {
      findFirst: vi.fn().mockResolvedValue(roster ?? null),
    },
  };

  return {
    prisma: {
      $transaction: vi
        .fn()
        .mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(tx)),
      ...tx,
    },
    tx,
    state,
  };
}

describe("ensureSetupPhasePersisted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when match does not exist", async () => {
    const { prisma } = createMockPrisma({
      match: { id: "other" },
      turns: [],
      selections: [],
    });

    const result = await ensureSetupPhasePersisted("missing", prisma as any);
    expect(result).toBeNull();
  });

  it("returns null when match status is not prematch-setup/active", async () => {
    const { prisma } = createMockPrisma({
      match: { id: "m1", status: "pending" },
      turns: [],
      selections: [],
    });

    const result = await ensureSetupPhasePersisted("m1", prisma as any);
    expect(result).toBeNull();
  });

  it("returns the current state without writing when phase is already setup", async () => {
    const setupState = {
      ...makeIdleGameState(),
      preMatch: { phase: "setup", currentCoach: "A" },
    };
    const { prisma, tx } = createMockPrisma({
      match: { id: "m1", status: "prematch-setup" },
      turns: [
        {
          id: "t1",
          number: 1,
          payload: { type: "coin-toss", receivingUserId: "u1", gameState: { preMatch: { phase: "idle" } } },
          createdAt: new Date(),
        },
        {
          id: "t2",
          number: 2,
          payload: { type: "setup-init", gameState: setupState },
          createdAt: new Date(),
        },
      ],
      selections: [],
    });

    const result = await ensureSetupPhasePersisted("m1", prisma as any);
    expect(result?.persisted).toBe(false);
    expect(result?.gameState.preMatch.phase).toBe("setup");
    expect(tx.turn.create).not.toHaveBeenCalled();
  });

  it("transitions idle → setup and persists a new setup-init turn", async () => {
    const idleState = makeIdleGameState();
    const { prisma, tx, state } = createMockPrisma({
      match: { id: "m1", status: "prematch-setup" },
      turns: [
        {
          id: "t1",
          number: 1,
          payload: {
            type: "coin-toss",
            receivingUserId: "userA",
            kickingUserId: "userB",
            gameState: idleState,
          },
          createdAt: new Date(),
        },
      ],
      selections: [
        { userId: "userA", teamRef: null },
        { userId: "userB", teamRef: null },
      ],
    });

    const result = await ensureSetupPhasePersisted("m1", prisma as any);

    expect(result?.persisted).toBe(true);
    expect(result?.gameState.preMatch.phase).toBe("setup");
    expect(result?.gameState.preMatch.currentCoach).toBe("A");

    expect(tx.match.update).toHaveBeenCalledWith({
      where: { id: "m1" },
      data: { status: "prematch-setup" },
    });
    expect(tx.turn.create).toHaveBeenCalledTimes(1);
    expect(state.turns).toHaveLength(2);
    expect(state.turns[1].payload.type).toBe("setup-init");
    expect(state.turns[1].payload.gameState.preMatch.phase).toBe("setup");
  });

  it("is idempotent: a second call after a persisted setup-init does not write again", async () => {
    const idleState = makeIdleGameState();
    const { prisma, tx } = createMockPrisma({
      match: { id: "m1", status: "prematch-setup" },
      turns: [
        {
          id: "t1",
          number: 1,
          payload: {
            type: "coin-toss",
            receivingUserId: "userA",
            kickingUserId: "userB",
            gameState: idleState,
          },
          createdAt: new Date(),
        },
      ],
      selections: [
        { userId: "userA", teamRef: null },
        { userId: "userB", teamRef: null },
      ],
    });

    const first = await ensureSetupPhasePersisted("m1", prisma as any);
    expect(first?.persisted).toBe(true);
    const firstTurnCount = tx.turn.create.mock.calls.length;

    const second = await ensureSetupPhasePersisted("m1", prisma as any);
    expect(second?.persisted).toBe(false);
    expect(second?.gameState.preMatch.phase).toBe("setup");
    expect(tx.turn.create.mock.calls.length).toBe(firstTurnCount);
  });

  it("derives receivingTeam=B when coin-toss names the second user as receiver", async () => {
    const idleState = makeIdleGameState();
    const { prisma } = createMockPrisma({
      match: { id: "m1", status: "prematch-setup" },
      turns: [
        {
          id: "t1",
          number: 1,
          payload: {
            type: "coin-toss",
            receivingUserId: "userB",
            kickingUserId: "userA",
            gameState: idleState,
          },
          createdAt: new Date(),
        },
      ],
      selections: [
        { userId: "userA", teamRef: null },
        { userId: "userB", teamRef: null },
      ],
    });

    const result = await ensureSetupPhasePersisted("m1", prisma as any);
    expect(result?.persisted).toBe(true);
    expect(result?.gameState.preMatch.currentCoach).toBe("B");
  });

  it("returns existing state (no-op) if there is no coin-toss yet", async () => {
    const idleState = makeIdleGameState();
    const { prisma, tx } = createMockPrisma({
      match: { id: "m1", status: "prematch-setup" },
      turns: [
        {
          id: "t1",
          number: 1,
          payload: { type: "start", gameState: idleState },
          createdAt: new Date(),
        },
      ],
      selections: [],
    });

    const result = await ensureSetupPhasePersisted("m1", prisma as any);
    expect(result?.persisted).toBe(false);
    expect(result?.gameState.preMatch.phase).toBe("idle");
    expect(tx.turn.create).not.toHaveBeenCalled();
  });
});
