import { Namespace, Socket } from "socket.io";

/**
 * Tracks which users are connected to which match rooms.
 * Maps matchId → Set of socket IDs.
 */
const matchRooms = new Map<string, Set<string>>();

/**
 * Tracks socket ID → matchId for cleanup on disconnect.
 */
const socketToMatch = new Map<string, string>();

export interface JoinMatchPayload {
  matchId: string;
}

export interface RoomInfo {
  matchId: string;
  connectedSockets: number;
}

/**
 * Register game room event handlers on the /game namespace.
 * Handles join-match, leave-match, and disconnect.
 */
export function registerGameRoomHandlers(gameNamespace: Namespace): void {
  gameNamespace.on("connection", (socket: Socket) => {
    socket.on("game:join-match", (payload: JoinMatchPayload, ack?: (response: { ok: boolean; error?: string }) => void) => {
      const { matchId } = payload ?? {};

      if (!matchId || typeof matchId !== "string") {
        ack?.({ ok: false, error: "matchId is required" });
        return;
      }

      // Leave any previous match room first
      const previousMatch = socketToMatch.get(socket.id);
      if (previousMatch) {
        leaveRoom(socket, previousMatch);
      }

      // Join the new room
      socket.join(matchId);
      socketToMatch.set(socket.id, matchId);

      if (!matchRooms.has(matchId)) {
        matchRooms.set(matchId, new Set());
      }
      matchRooms.get(matchId)!.add(socket.id);

      const connectedCount = matchRooms.get(matchId)!.size;
      console.log(
        `[game-rooms] Socket ${socket.id} joined room ${matchId} (${connectedCount} connected)`,
      );

      ack?.({ ok: true });

      // Notify other sockets in the room that a player connected
      socket.to(matchId).emit("game:player-connected", {
        matchId,
        connectedSockets: connectedCount,
      });
    });

    socket.on("game:leave-match", (payload: JoinMatchPayload, ack?: (response: { ok: boolean }) => void) => {
      const { matchId } = payload ?? {};

      if (!matchId || typeof matchId !== "string") {
        ack?.({ ok: false });
        return;
      }

      leaveRoom(socket, matchId);
      ack?.({ ok: true });
    });

    socket.on("disconnect", () => {
      const matchId = socketToMatch.get(socket.id);
      if (matchId) {
        leaveRoom(socket, matchId);
      }
    });
  });
}

function leaveRoom(socket: Socket, matchId: string): void {
  socket.leave(matchId);
  socketToMatch.delete(socket.id);

  const roomSockets = matchRooms.get(matchId);
  if (roomSockets) {
    roomSockets.delete(socket.id);
    const remaining = roomSockets.size;

    if (remaining === 0) {
      matchRooms.delete(matchId);
    }

    console.log(
      `[game-rooms] Socket ${socket.id} left room ${matchId} (${remaining} remaining)`,
    );

    // Notify remaining sockets
    socket.to(matchId).emit("game:player-disconnected", {
      matchId,
      connectedSockets: remaining,
    });
  }
}

/** Get the number of connected sockets in a match room. */
export function getRoomSize(matchId: string): number {
  return matchRooms.get(matchId)?.size ?? 0;
}

/** Get all active match room IDs. */
export function getActiveRooms(): string[] {
  return Array.from(matchRooms.keys());
}

/** Reset all room tracking (for testing). */
export function resetRooms(): void {
  matchRooms.clear();
  socketToMatch.clear();
}
