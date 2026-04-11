import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { submitMoveWithFallback } from "./submitMoveWithFallback";
import type { MoveAckPayload } from "./useGameSocket";
import type { Move } from "@bb/game-engine";

// Mock submitMoveHttp
vi.mock("./submitMoveHttp", () => ({
  submitMoveHttp: vi.fn(),
}));

import { submitMoveHttp } from "./submitMoveHttp";

const mockSubmitMoveHttp = vi.mocked(submitMoveHttp);

describe("submitMoveWithFallback", () => {
  const matchId = "match-fallback-1";
  const move: Move = { type: "END_TURN" } as any;
  const apiBase = "http://localhost:8201";
  const wsTimeout = 5000;

  const successPayload: MoveAckPayload = {
    success: true,
    gameState: { currentPlayer: "B" } as any,
    isMyTurn: false,
    moveCount: 1,
  };

  const errorPayload: MoveAckPayload = {
    success: false,
    error: "Server error",
    code: "SERVER_ERROR",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("uses WebSocket when socket is connected and responds in time", async () => {
    const wsSubmit = vi.fn().mockResolvedValue(successPayload);

    const resultPromise = submitMoveWithFallback({
      matchId,
      move,
      apiBase,
      wsConnected: true,
      wsSubmit,
      wsTimeout,
    });

    const result = await resultPromise;

    expect(result).toEqual(successPayload);
    expect(result.success).toBe(true);
    expect(wsSubmit).toHaveBeenCalledWith(matchId, move);
    expect(mockSubmitMoveHttp).not.toHaveBeenCalled();
  });

  it("falls back to HTTP when WebSocket is not connected", async () => {
    mockSubmitMoveHttp.mockResolvedValue(successPayload);

    const result = await submitMoveWithFallback({
      matchId,
      move,
      apiBase,
      wsConnected: false,
      wsSubmit: vi.fn(),
      wsTimeout,
    });

    expect(result).toEqual(successPayload);
    expect(mockSubmitMoveHttp).toHaveBeenCalledWith(apiBase, matchId, move);
  });

  it("falls back to HTTP when WebSocket times out", async () => {
    // WS never resolves
    const wsSubmit = vi.fn().mockReturnValue(new Promise(() => {}));
    mockSubmitMoveHttp.mockResolvedValue(successPayload);

    const resultPromise = submitMoveWithFallback({
      matchId,
      move,
      apiBase,
      wsConnected: true,
      wsSubmit,
      wsTimeout: 100,
    });

    // Advance past timeout
    await vi.advanceTimersByTimeAsync(150);

    const result = await resultPromise;

    expect(result).toEqual(successPayload);
    expect(wsSubmit).toHaveBeenCalled();
    expect(mockSubmitMoveHttp).toHaveBeenCalledWith(apiBase, matchId, move);
  });

  it("falls back to HTTP when WebSocket rejects", async () => {
    const wsSubmit = vi.fn().mockRejectedValue(new Error("WS error"));
    mockSubmitMoveHttp.mockResolvedValue(successPayload);

    const result = await submitMoveWithFallback({
      matchId,
      move,
      apiBase,
      wsConnected: true,
      wsSubmit,
      wsTimeout,
    });

    expect(result).toEqual(successPayload);
    expect(mockSubmitMoveHttp).toHaveBeenCalledWith(apiBase, matchId, move);
  });

  it("returns HTTP error when both WS and HTTP fail", async () => {
    const wsSubmit = vi.fn().mockRejectedValue(new Error("WS error"));
    mockSubmitMoveHttp.mockResolvedValue(errorPayload);

    const result = await submitMoveWithFallback({
      matchId,
      move,
      apiBase,
      wsConnected: true,
      wsSubmit,
      wsTimeout,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Server error");
  });

  it("does not call HTTP when wsSubmit returns null (not connected)", async () => {
    mockSubmitMoveHttp.mockResolvedValue(successPayload);

    const wsSubmit = vi.fn().mockResolvedValue(null);

    const result = await submitMoveWithFallback({
      matchId,
      move,
      apiBase,
      wsConnected: true,
      wsSubmit,
      wsTimeout,
    });

    // When wsSubmit returns null, it means socket disconnected mid-call — fall back
    expect(mockSubmitMoveHttp).toHaveBeenCalledWith(apiBase, matchId, move);
    expect(result).toEqual(successPayload);
  });
});
