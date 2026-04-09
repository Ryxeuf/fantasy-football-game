/**
 * Tracks which users are connected to which match rooms via WebSocket.
 *
 * Pure in-memory state — no external dependencies.
 * Used by game-rooms.ts (to populate) and move-processor.ts (to query).
 */

/** matchId → Set of socket IDs */
const matchSockets = new Map<string, Set<string>>();

/** socketId → userId */
const socketUserMap = new Map<string, string>();

/**
 * Register a user's socket as connected to a match room.
 */
export function trackUserJoin(
  matchId: string,
  socketId: string,
  userId: string,
): void {
  if (!matchSockets.has(matchId)) {
    matchSockets.set(matchId, new Set());
  }
  matchSockets.get(matchId)!.add(socketId);
  socketUserMap.set(socketId, userId);
}

/**
 * Unregister a socket from a match room.
 */
export function trackUserLeave(matchId: string, socketId: string): void {
  const sockets = matchSockets.get(matchId);
  if (sockets) {
    sockets.delete(socketId);
    if (sockets.size === 0) {
      matchSockets.delete(matchId);
    }
  }
  socketUserMap.delete(socketId);
}

/**
 * Check whether a user has at least one active WebSocket connection
 * to a specific match room. Used to decide whether to send a push
 * notification (skip if user is already watching the game live).
 */
export function isUserConnectedToMatch(
  matchId: string,
  userId: string,
): boolean {
  const sockets = matchSockets.get(matchId);
  if (!sockets) return false;

  for (const socketId of sockets) {
    if (socketUserMap.get(socketId) === userId) {
      return true;
    }
  }
  return false;
}

/**
 * Reset all tracking state. For testing only.
 */
export function resetConnectedUsers(): void {
  matchSockets.clear();
  socketUserMap.clear();
}
