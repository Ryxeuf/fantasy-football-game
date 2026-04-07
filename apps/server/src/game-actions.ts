import type { Namespace, Socket } from "socket.io";
import { processMove } from "./services/move-processor";
import { processInducementSubmission } from "./services/inducement-processor";
import type { Move, InducementSelection } from "@bb/game-engine";

export interface SubmitMovePayload {
  matchId: string;
  move: Move;
}

export interface SubmitInducementsPayload {
  matchId: string;
  selection: InducementSelection;
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

    socket.on(
      "game:submit-inducements",
      async (
        payload: SubmitInducementsPayload,
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

        const { matchId, selection } = payload ?? {};

        if (!matchId || typeof matchId !== "string" || !selection) {
          ack?.({
            success: false,
            error: "matchId and selection are required",
            code: "INVALID_PAYLOAD",
          });
          return;
        }

        try {
          const result = await processInducementSubmission(
            matchId,
            userId,
            selection,
          );
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
