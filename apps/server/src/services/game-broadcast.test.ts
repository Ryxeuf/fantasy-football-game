import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the socket module before importing game-broadcast
vi.mock("../socket", () => ({
  getGameNamespace: vi.fn(),
}));

import {
  broadcastGameState,
  broadcastMatchEnd,
  broadcastMatchForfeited,
  MAX_BROADCAST_LOG_ENTRIES,
} from "./game-broadcast";
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

    it("truncates gameLog to the last MAX_BROADCAST_LOG_ENTRIES entries", () => {
      const oversizedLog = Array.from({ length: MAX_BROADCAST_LOG_ENTRIES + 50 }, (_, i) => ({
        id: `log-${i}`,
        timestamp: i,
        type: "info" as const,
        message: `entry-${i}`,
      }));
      const stateWithLog = { ...gameState, gameLog: oversizedLog };

      broadcastGameState(matchId, stateWithLog, move, userId);

      const payload = mockEmit.mock.calls[0][1];
      expect(payload.gameState.gameLog).toHaveLength(MAX_BROADCAST_LOG_ENTRIES);
      // Doit conserver les entrées les plus récentes (fin du tableau)
      const lastIndex = MAX_BROADCAST_LOG_ENTRIES + 50 - 1;
      expect(payload.gameState.gameLog[MAX_BROADCAST_LOG_ENTRIES - 1].message).toBe(
        `entry-${lastIndex}`,
      );
    });

    it("does not mutate the input game state when truncating", () => {
      const oversizedLog = Array.from({ length: MAX_BROADCAST_LOG_ENTRIES + 10 }, (_, i) => ({
        id: `log-${i}`,
        timestamp: i,
        type: "info" as const,
        message: `entry-${i}`,
      }));
      const stateWithLog = { ...gameState, gameLog: oversizedLog };

      broadcastGameState(matchId, stateWithLog, move, userId);

      expect(stateWithLog.gameLog).toHaveLength(MAX_BROADCAST_LOG_ENTRIES + 10);
    });

    it("leaves gameState untouched when no gameLog is present", () => {
      broadcastGameState(matchId, gameState, move, userId);

      const payload = mockEmit.mock.calls[0][1];
      expect(payload.gameState).toBe(gameState);
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

    it("truncates gameLog when present", () => {
      const oversizedLog = Array.from({ length: MAX_BROADCAST_LOG_ENTRIES + 10 }, (_, i) => ({
        id: `log-${i}`,
        timestamp: i,
        type: "info" as const,
        message: `entry-${i}`,
      }));
      const stateWithLog = { ...gameState, gameLog: oversizedLog };

      broadcastMatchEnd(matchId, stateWithLog);

      const payload = mockEmit.mock.calls[0][1];
      expect(payload.gameState.gameLog).toHaveLength(MAX_BROADCAST_LOG_ENTRIES);
    });
  });

  describe("broadcastMatchForfeited", () => {
    const matchId = "match-789";
    const forfeitingUserId = "user-forfeit";
    const gameState = { gamePhase: "ended", matchResult: { winner: "B", forfeit: true } };

    it("emits game:match-forfeited to the match room", () => {
      broadcastMatchForfeited(matchId, forfeitingUserId, gameState);

      expect(mockTo).toHaveBeenCalledWith(matchId);
      expect(mockEmit).toHaveBeenCalledWith("game:match-forfeited", {
        matchId,
        forfeitingUserId,
        gameState,
        timestamp: expect.any(String),
      });
    });

    it("does not throw if socket.io is not initialized", () => {
      vi.mocked(getGameNamespace).mockImplementation(() => {
        throw new Error("socket.io not initialized");
      });

      expect(() =>
        broadcastMatchForfeited(matchId, forfeitingUserId, gameState),
      ).not.toThrow();
    });

    it("truncates gameLog when present", () => {
      const oversizedLog = Array.from({ length: MAX_BROADCAST_LOG_ENTRIES + 5 }, (_, i) => ({
        id: `log-${i}`,
        timestamp: i,
        type: "info" as const,
        message: `entry-${i}`,
      }));
      const stateWithLog = { ...gameState, gameLog: oversizedLog };

      broadcastMatchForfeited(matchId, forfeitingUserId, stateWithLog);

      const payload = mockEmit.mock.calls[0][1];
      expect(payload.gameState.gameLog).toHaveLength(MAX_BROADCAST_LOG_ENTRIES);
    });
  });
});
