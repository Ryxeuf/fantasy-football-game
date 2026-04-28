import { Namespace, Socket } from "socket.io";
import { serverLog } from "./utils/server-log";

/**
 * Tracks spectator sockets per match room.
 * Maps matchId → Set of spectator socket IDs.
 */
const spectatorSockets = new Map<string, Set<string>>();

/**
 * Tracks socket ID → matchId for cleanup on disconnect.
 */
const socketToSpectateMatch = new Map<string, string>();

export interface SpectateMatchPayload {
  matchId: string;
}

/**
 * Register spectator event handlers on the /game namespace.
 * Spectators join the same socket.io room as players to receive broadcasts,
 * but they cannot submit moves and do not trigger forfeit timers.
 */
export function registerSpectatorHandlers(gameNamespace: Namespace): void {
  gameNamespace.on("connection", (socket: Socket) => {
    socket.on(
      "game:spectate-match",
      (
        payload: SpectateMatchPayload,
        ack?: (response: { ok: boolean; error?: string }) => void,
      ) => {
        const { matchId } = payload ?? {};

        if (!matchId || typeof matchId !== "string") {
          ack?.({ ok: false, error: "matchId is required" });
          return;
        }

        // Leave any previous spectate room first
        const previousMatch = socketToSpectateMatch.get(socket.id);
        if (previousMatch) {
          leaveSpectate(socket, previousMatch, gameNamespace);
        }

        // Join the room (same room as players — receives all broadcasts)
        socket.join(matchId);
        socketToSpectateMatch.set(socket.id, matchId);

        if (!spectatorSockets.has(matchId)) {
          spectatorSockets.set(matchId, new Set());
        }
        spectatorSockets.get(matchId)!.add(socket.id);

        const count = spectatorSockets.get(matchId)!.size;
        serverLog.log(
          `[game-spectator] Socket ${socket.id} spectating ${matchId} (${count} spectators)`,
        );

        ack?.({ ok: true });

        // Notify the room about updated spectator count
        gameNamespace.to(matchId).emit("game:spectator-count", {
          matchId,
          spectatorCount: count,
        });
      },
    );

    socket.on(
      "game:leave-spectate",
      (
        payload: SpectateMatchPayload,
        ack?: (response: { ok: boolean }) => void,
      ) => {
        const { matchId } = payload ?? {};

        if (!matchId || typeof matchId !== "string") {
          ack?.({ ok: false });
          return;
        }

        leaveSpectate(socket, matchId, gameNamespace);
        ack?.({ ok: true });
      },
    );

    socket.on("disconnect", () => {
      const matchId = socketToSpectateMatch.get(socket.id);
      if (matchId) {
        leaveSpectate(socket, matchId, gameNamespace);
      }
    });
  });
}

function leaveSpectate(
  socket: Socket,
  matchId: string,
  gameNamespace: Namespace,
): void {
  socket.leave(matchId);
  socketToSpectateMatch.delete(socket.id);

  const roomSpectators = spectatorSockets.get(matchId);
  if (roomSpectators) {
    roomSpectators.delete(socket.id);
    const remaining = roomSpectators.size;

    if (remaining === 0) {
      spectatorSockets.delete(matchId);
    }

    serverLog.log(
      `[game-spectator] Socket ${socket.id} stopped spectating ${matchId} (${remaining} spectators)`,
    );

    // Notify the room about updated spectator count
    gameNamespace.to(matchId).emit("game:spectator-count", {
      matchId,
      spectatorCount: remaining,
    });
  }
}

/** Get the number of spectators for a match. */
export function getSpectatorCount(matchId: string): number {
  return spectatorSockets.get(matchId)?.size ?? 0;
}

/** Check if a socket ID is a spectator (not a player). */
export function isSpectator(socketId: string): boolean {
  return socketToSpectateMatch.has(socketId);
}

/** Reset all spectator tracking (for testing). */
export function resetSpectators(): void {
  spectatorSockets.clear();
  socketToSpectateMatch.clear();
}
