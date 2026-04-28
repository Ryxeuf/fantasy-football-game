import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { submitMoveHttp } from "./submitMoveHttp";
import type { Move } from "@bb/game-engine";

describe("submitMoveHttp — HTTP fallback for move submission (S25.5m ApiResponse<T>)", () => {
  const matchId = "match-http-1";
  const move: Move = { type: "END_TURN" } as any;
  const apiBase = "http://localhost:8201";
  const authToken = "test-jwt-token";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => {
        if (key === "auth_token") return authToken;
        return null;
      }),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("sends POST request to /match/:id/move with auth header", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              gameState: { currentPlayer: "B" },
              isMyTurn: false,
              moveCount: 1,
            },
          }),
      }),
    );

    await submitMoveHttp(apiBase, matchId, move);

    expect(fetch).toHaveBeenCalledWith(`${apiBase}/match/${matchId}/move`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ move }),
    });
  });

  it("unwraps ApiResponse<T> success into MoveAckPayload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              gameState: { currentPlayer: "B" },
              isMyTurn: false,
              moveCount: 2,
            },
          }),
      }),
    );

    const result = await submitMoveHttp(apiBase, matchId, move);

    expect(result.success).toBe(true);
    expect(result.gameState).toEqual({ currentPlayer: "B" });
    expect(result.isMyTurn).toBe(false);
    expect(result.moveCount).toBe(2);
  });

  it("unwraps ApiResponse<T> error into MoveAckPayload error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: () =>
          Promise.resolve({ success: false, error: "Not your turn" }),
      }),
    );

    const result = await submitMoveHttp(apiBase, matchId, move);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Not your turn");
  });

  it("returns error payload when network request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    const result = await submitMoveHttp(apiBase, matchId, move);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Network error");
    expect(result.code).toBe("NETWORK_ERROR");
  });

  it("returns error when no auth token is available", async () => {
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });

    const result = await submitMoveHttp(apiBase, matchId, move);

    expect(result.success).toBe(false);
    expect(result.code).toBe("AUTH_REQUIRED");
  });

  it("returns error payload when server returns non-JSON response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error("Invalid JSON")),
      }),
    );

    const result = await submitMoveHttp(apiBase, matchId, move);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("falls back to legacy non-enveloped payload (forward compatibility)", async () => {
    // If the server still returns the pre-S25.5m shape (no `data` wrapper),
    // submitMoveHttp must keep working so a rolling deploy doesn't break.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            gameState: { currentPlayer: "A" },
            isMyTurn: true,
            moveCount: 5,
          }),
      }),
    );

    const result = await submitMoveHttp(apiBase, matchId, move);

    expect(result.success).toBe(true);
    expect(result.gameState).toEqual({ currentPlayer: "A" });
    expect(result.moveCount).toBe(5);
  });
});
