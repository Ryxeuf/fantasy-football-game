import type { Move } from "@bb/game-engine";
import type { MoveAckPayload } from "./useGameSocket";

/**
 * Submit a game move via HTTP POST as a fallback when WebSocket is unavailable.
 * Calls POST /match/:matchId/move with Bearer JWT auth.
 *
 * S25.5m — the server now returns the standard `ApiResponse<T>` envelope :
 *   succès : `{ success: true, data: { gameState, isMyTurn, moveCount } }`
 *   erreur : `{ success: false, error }`
 *
 * Le client adapte l'enveloppe vers `MoveAckPayload` (le contrat WS reste
 * inchange). Le format pre-S25.5m (`{ success, gameState, ... }` sans `data`)
 * reste accepte pour ne pas casser un deploy progressif.
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

    const body = await res
      .json()
      .catch(() => ({ error: "Invalid server response" }));

    if (!res.ok) {
      const errorMsg =
        (body as { error?: string })?.error ?? `HTTP ${res.status}`;
      return {
        success: false,
        error: errorMsg,
        code: (body as { code?: string })?.code,
      };
    }

    return mapMoveResponse(body);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Network error";
    return {
      success: false,
      error: message,
      code: "NETWORK_ERROR",
    };
  }
}

interface MoveSuccessData {
  gameState?: unknown;
  isMyTurn?: boolean;
  moveCount?: number;
}

function mapMoveResponse(body: unknown): MoveAckPayload {
  if (!body || typeof body !== "object") {
    return { success: false, error: "Invalid server response" };
  }
  const obj = body as Record<string, unknown>;

  // ApiResponse<T> : succes => { success: true, data: {...} }
  if (obj.success === true && obj.data && typeof obj.data === "object") {
    const data = obj.data as MoveSuccessData;
    return {
      success: true,
      gameState: data.gameState as MoveAckPayload["gameState"],
      isMyTurn: data.isMyTurn,
      moveCount: data.moveCount,
    };
  }

  // ApiResponse<T> : erreur => { success: false, error }
  if (obj.success === false) {
    return {
      success: false,
      error: (obj.error as string | undefined) ?? "Unknown error",
      code: obj.code as string | undefined,
    };
  }

  // Fallback legacy (pre-S25.5m) : { success: true, gameState, isMyTurn, moveCount }
  return obj as unknown as MoveAckPayload;
}
