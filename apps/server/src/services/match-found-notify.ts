import { getGameNamespace } from "../socket";
import { sendMatchFoundPush } from "./push-notifications";

/**
 * Notify a user that a match has been found via the best available channel.
 *
 * - If the user has active WebSocket connections in the /game namespace,
 *   emit "matchmaking:found" to all their sockets (they'll see it live).
 * - If the user is NOT connected via WebSocket, send a push notification
 *   instead so they still get alerted (e.g. tab closed, navigated away).
 *
 * This mirrors the smart push gating pattern used by sendTurnPush (G.3).
 *
 * @returns true if the user was notified via WebSocket, false otherwise.
 */
export function notifyMatchFound(userId: string, matchId: string): boolean {
  let notifiedViaSocket = false;

  try {
    const gameNs = getGameNamespace();
    for (const [, socket] of gameNs.sockets) {
      if (socket.data.user?.id === userId) {
        socket.emit("matchmaking:found", { matchId });
        notifiedViaSocket = true;
      }
    }
  } catch {
    // socket.io may not be initialized (e.g., in tests)
  }

  if (!notifiedViaSocket) {
    sendMatchFoundPush(userId, matchId);
  }

  return notifiedViaSocket;
}
