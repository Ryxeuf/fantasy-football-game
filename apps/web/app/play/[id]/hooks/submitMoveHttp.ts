import type { Move } from "@bb/game-engine";
import type { MoveAckPayload } from "./useGameSocket";

/**
 * Submit a game move via HTTP POST as a fallback when WebSocket is unavailable.
 * Calls POST /match/:matchId/move with Bearer JWT auth.
 */
export async function submitMoveHttp(
  apiBase: string,
  matchId: string,
  move: Move,
): Promise<MoveAckPayload> {
  const authToken = localStorage.getItem("auth_token");
  if (!authToken) {
    return {
      success: false,
      error: "Authentication required",
      code: "AUTH_REQUIRED",
    };
  }

  try {
    const res = await fetch(`${apiBase}/match/${matchId}/move`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ move }),
    });

    const data = await res.json().catch(() => ({ error: "Invalid server response" }));

    if (!res.ok) {
      return {
        success: false,
        error: data?.error ?? `HTTP ${res.status}`,
        code: data?.code,
      };
    }

    return data as MoveAckPayload;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Network error";
    return {
      success: false,
      error: message,
      code: "NETWORK_ERROR",
    };
  }
}
