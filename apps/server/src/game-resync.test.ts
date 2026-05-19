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

vi.mock("./game-spectator", () => ({
  getSpectateMatchId: vi.fn(),
}));

import { prisma } from "./prisma";
import { handleResyncRequest } from "./game-resync";
import { getSpectateMatchId } from "./game-spectator";

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

  // Audit round 11 (CRITICAL) : tests anti-bypass spectator.
  describe("spectator access control", () => {
    it("autorise un spectateur qui spectate EXACTEMENT le matchId demande", async () => {
      vi.mocked(getSpectateMatchId).mockReturnValue(matchId);
      vi.mocked(prisma.turn.findFirst).mockResolvedValue({
        payload: { gameState: { foo: "bar" } },
      } as any);

      const result = await handleResyncRequest(matchId, userId, "socket-A");

      expect(result.success).toBe(true);
      // findFirst sur match NE DOIT PAS etre appele : spectator legitime.
      expect(prisma.match.findFirst).not.toHaveBeenCalled();
    });

    it("BLOQUE un spectateur d'un autre match qui tente de resync un match prive", async () => {
      // Socket spectate match-OTHER, mais tente request-resync sur match-123 (prive).
      vi.mocked(getSpectateMatchId).mockReturnValue("match-OTHER");
      vi.mocked(prisma.match.findFirst).mockResolvedValue(null); // pas participant

      const result = await handleResyncRequest(matchId, userId, "socket-attacker");

      expect(result).toEqual({
        success: false,
        error: "You are not a participant of this match",
      });
      // findFirst DOIT etre appele : pas un spectator legitime → check participant.
      expect(prisma.match.findFirst).toHaveBeenCalled();
    });

    it("BLOQUE un socket qui ne spectate rien et n'est pas participant", async () => {
      vi.mocked(getSpectateMatchId).mockReturnValue(undefined);
      vi.mocked(prisma.match.findFirst).mockResolvedValue(null);

      const result = await handleResyncRequest(matchId, userId, "socket-X");

      expect(result.success).toBe(false);
      expect(prisma.match.findFirst).toHaveBeenCalled();
    });
  });
});
