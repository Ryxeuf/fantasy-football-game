import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { submitMoveHttp } from "./submitMoveHttp";
import type { Move } from "@bb/game-engine";
import type { MoveAckPayload } from "./useGameSocket";

describe("submitMoveHttp — HTTP fallback for move submission", () => {
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
    const mockResponse: MoveAckPayload = {
      success: true,
      gameState: { currentPlayer: "B" } as any,
      isMyTurn: false,
      moveCount: 1,
    };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    }));

    await submitMoveHttp(apiBase, matchId, move);

    expect(fetch).toHaveBeenCalledWith(
      `${apiBase}/match/${matchId}/move`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ move }),
      },
    );
  });

  it("returns MoveAckPayload on success", async () => {
    const mockResponse: MoveAckPayload = {
      success: true,
      gameState: { currentPlayer: "B" } as any,
      isMyTurn: false,
      moveCount: 2,
    };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    }));

    const result = await submitMoveHttp(apiBase, matchId, move);

    expect(result.success).toBe(true);
    expect(result.gameState).toEqual({ currentPlayer: "B" });
    expect(result.moveCount).toBe(2);
  });

  it("returns error payload when server returns HTTP error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: "Not your turn" }),
    }));

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
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error("Invalid JSON")),
    }));

    const result = await submitMoveHttp(apiBase, matchId, move);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
