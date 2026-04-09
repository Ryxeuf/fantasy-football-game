import type { Namespace, Socket } from "socket.io";
import { prisma } from "./prisma";
import { isSpectator } from "./game-spectator";

export interface ResyncRequestPayload {
  matchId: string;
}

export interface ResyncResponse {
  success: boolean;
  gameState?: unknown;
  matchId?: string;
  error?: string;
}

/**
 * Load the latest game state for a match from the database.
 * Used to resync a client after a WebSocket reconnection.
 */
export async function handleResyncRequest(
  matchId: string,
  userId: string,
  socketId?: string,
): Promise<ResyncResponse> {
  // Spectators can also resync — skip participant check for them
  const spectator = socketId ? isSpectator(socketId) : false;

  if (!spectator) {
    // Verify the user is a participant of this match
    const match = await prisma.match.findFirst({
      where: {
        id: matchId,
        players: { some: { id: userId } },
      },
      select: { id: true },
    });

    if (!match) {
      return { success: false, error: "You are not a participant of this match" };
    }
  }

  // Fetch the latest turn with a game state
  const latestTurn = await prisma.turn.findFirst({
    where: { matchId },
    orderBy: { number: "desc" },
    select: { payload: true },
  });

  if (!latestTurn) {
    return { success: false, error: "No game state found" };
  }

  const payload = latestTurn.payload as Record<string, unknown> | null;
  let gameState = payload?.gameState;

  if (typeof gameState === "string") {
    gameState = JSON.parse(gameState);
  }

  if (!gameState) {
    return { success: false, error: "No game state found" };
  }

  return { success: true, gameState, matchId };
}

/**
 * Register the game:request-resync handler on the /game namespace.
 */
export function registerResyncHandler(gameNamespace: Namespace): void {
  gameNamespace.on("connection", (socket: Socket) => {
    socket.on(
      "game:request-resync",
      async (
        payload: ResyncRequestPayload,
        ack?: (response: ResyncResponse) => void,
      ) => {
        const userId: string | undefined = socket.data.user?.id;

        if (!userId) {
          ack?.({ success: false, error: "Authentication required" });
          return;
        }

        const { matchId } = payload ?? {};

        if (!matchId || typeof matchId !== "string") {
          ack?.({ success: false, error: "matchId is required" });
          return;
        }

        try {
          const result = await handleResyncRequest(matchId, userId, socket.id);
          ack?.(result);
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : "Server error";
          ack?.({ success: false, error: message });
        }
      },
    );
  });
}
