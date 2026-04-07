import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma before imports
vi.mock("./prisma", () => ({
  prisma: {
    turn: {
      findFirst: vi.fn(),
    },
    match: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "./prisma";
import { handleResyncRequest } from "./game-resync";

describe("game-resync", () => {
  const userId = "user-abc";
  const matchId = "match-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the latest gameState for a valid match participant", async () => {
    const gameState = { currentPlayer: "A", turn: 3, half: 1 };

    vi.mocked(prisma.match.findFirst).mockResolvedValue({
      id: matchId,
    } as any);

    vi.mocked(prisma.turn.findFirst).mockResolvedValue({
      id: "turn-5",
      payload: { gameState },
    } as any);

    const result = await handleResyncRequest(matchId, userId);

    expect(result).toEqual({
      success: true,
      gameState,
      matchId,
    });
  });

  it("verifies the user is a participant of the match", async () => {
    vi.mocked(prisma.match.findFirst).mockResolvedValue(null);

    const result = await handleResyncRequest(matchId, userId);

    expect(result).toEqual({
      success: false,
      error: "You are not a participant of this match",
    });

    expect(prisma.match.findFirst).toHaveBeenCalledWith({
      where: {
        id: matchId,
        players: { some: { id: userId } },
      },
      select: { id: true },
    });
  });

  it("returns error when no game state exists", async () => {
    vi.mocked(prisma.match.findFirst).mockResolvedValue({
      id: matchId,
    } as any);

    vi.mocked(prisma.turn.findFirst).mockResolvedValue(null);

    const result = await handleResyncRequest(matchId, userId);

    expect(result).toEqual({
      success: false,
      error: "No game state found",
    });
  });

  it("fetches the latest turn ordered by number descending", async () => {
    const gameState = { currentPlayer: "B", turn: 5, half: 2 };

    vi.mocked(prisma.match.findFirst).mockResolvedValue({
      id: matchId,
    } as any);

    vi.mocked(prisma.turn.findFirst).mockResolvedValue({
      id: "turn-10",
      payload: { gameState },
    } as any);

    await handleResyncRequest(matchId, userId);

    expect(prisma.turn.findFirst).toHaveBeenCalledWith({
      where: { matchId },
      orderBy: { number: "desc" },
      select: { payload: true },
    });
  });

  it("parses stringified gameState from turn payload", async () => {
    const gameState = { currentPlayer: "A", turn: 1, half: 1 };

    vi.mocked(prisma.match.findFirst).mockResolvedValue({
      id: matchId,
    } as any);

    vi.mocked(prisma.turn.findFirst).mockResolvedValue({
      id: "turn-1",
      payload: { gameState: JSON.stringify(gameState) },
    } as any);

    const result = await handleResyncRequest(matchId, userId);

    expect(result).toEqual({
      success: true,
      gameState,
      matchId,
    });
  });
});
