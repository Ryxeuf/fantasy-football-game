import { getGameNamespace } from "../socket";
import { truncateGameLog } from "@bb/game-engine";

/**
 * Nombre maximal d'entrées de `gameLog` envoyées dans un broadcast WebSocket.
 *
 * Pourquoi : sur un long match (plusieurs centaines d'entrées), broadcaster
 * l'état complet à chaque action gonfle inutilement les payloads. Tronquer le
 * log aux N entrées les plus récentes conserve un historique court (suffisant
 * pour le scrolling immédiat côté client) sans dégrader l'UX.
 *
 * Les clients qui ont besoin de l'historique complet peuvent le récupérer via
 * l'API REST de match.
 */
export const MAX_BROADCAST_LOG_ENTRIES = 100;

/**
 * Si l'objet `state` ressemble à un GameState (tableau `gameLog` présent),
 * retourne une copie avec le log tronqué. Sinon retourne l'objet tel quel.
 *
 * Le typage volontairement permissif (`unknown`) reflète l'API publique des
 * fonctions de broadcast qui acceptent un `unknown` (les tests envoient des
 * fragments, et le call-site applicatif passe le GameState complet).
 */
function maybeTruncateLog(state: unknown): unknown {
  if (
    state !== null &&
    typeof state === "object" &&
    Array.isArray((state as { gameLog?: unknown }).gameLog)
  ) {
    return truncateGameLog(
      state as Parameters<typeof truncateGameLog>[0],
      MAX_BROADCAST_LOG_ENTRIES,
    );
  }
  return state;
}

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
      gameState: maybeTruncateLog(gameState),
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
      gameState: maybeTruncateLog(gameState),
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Socket.io may not be initialized in tests or during startup
  }
}

/**
 * Broadcast turn timer info to all players in a match room.
 * Sent whenever a new turn starts so clients can display the countdown.
 */
export function broadcastTurnTimerStarted(
  matchId: string,
  deadline: number,
  turnTimerSeconds: number,
): void {
  try {
    const gameNs = getGameNamespace();
    gameNs.to(matchId).emit("game:turn-timer-started", {
      matchId,
      deadline,
      turnTimerSeconds,
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Socket.io may not be initialized in tests or during startup
  }
}

/**
 * Broadcast match forfeit event to all players in a match room.
 * Sent when a player disconnects for longer than the forfeit timeout.
 */
export function broadcastMatchForfeited(
  matchId: string,
  forfeitingUserId: string,
  gameState: unknown,
): void {
  try {
    const gameNs = getGameNamespace();
    gameNs.to(matchId).emit("game:match-forfeited", {
      matchId,
      forfeitingUserId,
      gameState: maybeTruncateLog(gameState),
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Socket.io may not be initialized in tests or during startup
  }
}
