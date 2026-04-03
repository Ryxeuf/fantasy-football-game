import { getGameNamespace } from "../socket";

/**
 * Broadcast updated game state to all players in a match room
 * after an action (move/block/pass/etc.) is applied.
 */
export function broadcastGameState(
  matchId: string,
  gameState: unknown,
  move: unknown,
  userId: string,
): void {
  try {
    const gameNs = getGameNamespace();
    gameNs.to(matchId).emit("game:state-updated", {
      matchId,
      gameState,
      move,
      userId,
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Socket.io may not be initialized in tests or during startup
  }
}

/**
 * Broadcast match end event to all players in a match room.
 */
export function broadcastMatchEnd(
  matchId: string,
  gameState: unknown,
): void {
  try {
    const gameNs = getGameNamespace();
    gameNs.to(matchId).emit("game:match-ended", {
      matchId,
      gameState,
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Socket.io may not be initialized in tests or during startup
  }
}
