import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the socket module before importing game-broadcast
vi.mock("../socket", () => ({
  getGameNamespace: vi.fn(),
}));

import { broadcastGameState, broadcastMatchEnd } from "./game-broadcast";
import { getGameNamespace } from "../socket";

describe("game-broadcast", () => {
  const mockEmit = vi.fn();
  const mockTo = vi.fn(() => ({ emit: mockEmit }));
  const mockNamespace = { to: mockTo } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getGameNamespace).mockReturnValue(mockNamespace);
  });

  describe("broadcastGameState", () => {
    const matchId = "match-123";
    const gameState = { currentPlayer: "A", turn: 3, half: 1 };
    const move = { type: "move", playerId: "p1", to: { x: 5, y: 3 } };
    const userId = "user-abc";

    it("emits game:state-updated to the match room", () => {
      broadcastGameState(matchId, gameState, move, userId);

      expect(mockTo).toHaveBeenCalledWith(matchId);
      expect(mockEmit).toHaveBeenCalledWith("game:state-updated", {
        matchId,
        gameState,
        move,
        userId,
        timestamp: expect.any(String),
      });
    });

    it("includes ISO timestamp in the payload", () => {
      broadcastGameState(matchId, gameState, move, userId);

      const payload = mockEmit.mock.calls[0][1];
      expect(() => new Date(payload.timestamp)).not.toThrow();
      expect(new Date(payload.timestamp).toISOString()).toBe(payload.timestamp);
    });

    it("does not throw if socket.io is not initialized", () => {
      vi.mocked(getGameNamespace).mockImplementation(() => {
        throw new Error("socket.io not initialized");
      });

      expect(() =>
        broadcastGameState(matchId, gameState, move, userId),
      ).not.toThrow();
    });
  });

  describe("broadcastMatchEnd", () => {
    const matchId = "match-456";
    const gameState = { currentPlayer: "A", turn: 9, half: 2, score: { A: 2, B: 1 } };

    it("emits game:match-ended to the match room", () => {
      broadcastMatchEnd(matchId, gameState);

      expect(mockTo).toHaveBeenCalledWith(matchId);
      expect(mockEmit).toHaveBeenCalledWith("game:match-ended", {
        matchId,
        gameState,
        timestamp: expect.any(String),
      });
    });

    it("does not throw if socket.io is not initialized", () => {
      vi.mocked(getGameNamespace).mockImplementation(() => {
        throw new Error("socket.io not initialized");
      });

      expect(() => broadcastMatchEnd(matchId, gameState)).not.toThrow();
    });
  });
});
