import type { Move } from "@bb/game-engine";
import type { MoveAckPayload } from "./useGameSocket";
import { submitMoveHttp } from "./submitMoveHttp";

export interface SubmitMoveWithFallbackOptions {
  matchId: string;
  move: Move;
  apiBase: string;
  wsConnected: boolean;
  wsSubmit: (matchId: string, move: Move) => Promise<MoveAckPayload | null>;
  /** Timeout in ms before falling back to HTTP. Default: 5000. */
  wsTimeout?: number;
}

/**
 * Submit a move via WebSocket with automatic HTTP fallback.
 *
 * Strategy:
 * 1. If WebSocket is not connected, go directly to HTTP.
 * 2. If WebSocket is connected, try WS with a timeout.
 * 3. If WS times out, returns null, or rejects — fall back to HTTP.
 */
export async function submitMoveWithFallback(
  options: SubmitMoveWithFallbackOptions,
): Promise<MoveAckPayload> {
  const { matchId, move, apiBase, wsConnected, wsSubmit, wsTimeout = 5000 } = options;

  // If WS is not connected, skip straight to HTTP
  if (!wsConnected) {
    return submitMoveHttp(apiBase, matchId, move);
  }

  // Try WS with timeout
  try {
    const result = await Promise.race([
      wsSubmit(matchId, move),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), wsTimeout)),
    ]);

    // null means timeout or socket disconnected mid-call
    if (result === null) {
      return submitMoveHttp(apiBase, matchId, move);
    }

    return result;
  } catch {
    // WS rejected — fall back to HTTP
    return submitMoveHttp(apiBase, matchId, move);
  }
}
