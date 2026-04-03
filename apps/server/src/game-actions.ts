import type { Namespace, Socket } from "socket.io";
import { processMove } from "./services/move-processor";
import type { Move } from "@bb/game-engine";

export interface SubmitMovePayload {
  matchId: string;
  move: Move;
}

/**
 * Register game action handlers on the /game namespace.
 * Handles game:submit-move for real-time move submission via WebSocket.
 */
export function registerGameActionHandlers(gameNamespace: Namespace): void {
  gameNamespace.on("connection", (socket: Socket) => {
    socket.on(
      "game:submit-move",
      async (
        payload: SubmitMovePayload,
        ack?: (response: unknown) => void,
      ) => {
        const userId: string | undefined = socket.data.user?.id;

        if (!userId) {
          ack?.({
            success: false,
            error: "Authentication required",
            code: "AUTH_REQUIRED",
          });
          return;
        }

        const { matchId, move } = payload ?? {};

        if (!matchId || typeof matchId !== "string" || !move || typeof move !== "object") {
          ack?.({
            success: false,
            error: "matchId and move are required",
            code: "INVALID_PAYLOAD",
          });
          return;
        }

        try {
          const result = await processMove(matchId, userId, move);
          ack?.(result);
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : "Erreur serveur";
          ack?.({
            success: false,
            error: message,
            code: "SERVER_ERROR",
          });
        }
      },
    );
  });
}
