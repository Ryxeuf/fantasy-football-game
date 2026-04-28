import { Namespace, Socket } from "socket.io";
import { prisma } from "./prisma";
import { startForfeitTimer, cancelForfeitTimer } from "./services/forfeit-tracker";
import { trackUserJoin, trackUserLeave, resetConnectedUsers } from "./services/connected-users";
import { serverLog } from "./utils/server-log";

/**
 * Tracks which users are connected to which match rooms.
 * Maps matchId → Set of socket IDs.
 */
const matchRooms = new Map<string, Set<string>>();

/**
 * Tracks socket ID → matchId for cleanup on disconnect.
 */
const socketToMatch = new Map<string, string>();

/**
 * Tracks socket ID → userId for identifying authenticated users.
 */
const socketToUser = new Map<string, string>();

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
    // Store userId from authenticated socket
    const userId: string | undefined = socket.data.user?.id;
    if (userId) {
      socketToUser.set(socket.id, userId);
    }

    socket.on("game:join-match", async (payload: JoinMatchPayload, ack?: (response: { ok: boolean; error?: string }) => void) => {
      const { matchId } = payload ?? {};

      if (!matchId || typeof matchId !== "string") {
        ack?.({ ok: false, error: "matchId is required" });
        return;
      }

      if (!userId) {
        ack?.({ ok: false, error: "Authentication required" });
        return;
      }

      // Verify the user is a participant of this match
      const match = await prisma.match.findFirst({
        where: {
          id: matchId,
          players: { some: { id: userId } },
        },
        select: { id: true },
      });

      if (!match) {
        ack?.({ ok: false, error: "You are not a participant of this match" });
        return;
      }

      // Leave any previous match room first
      const previousMatch = socketToMatch.get(socket.id);
      if (previousMatch) {
        leaveRoom(socket, previousMatch);
      }

      // Cancel any pending forfeit timer for this user (reconnection)
      cancelForfeitTimer(matchId, userId);

      // Join the new room
      socket.join(matchId);
      socketToMatch.set(socket.id, matchId);

      if (!matchRooms.has(matchId)) {
        matchRooms.set(matchId, new Set());
      }
      matchRooms.get(matchId)!.add(socket.id);

      // Track in connected-users for push notification decisions
      trackUserJoin(matchId, socket.id, userId);

      const connectedCount = matchRooms.get(matchId)!.size;
      serverLog.log(
        `[game-rooms] Socket ${socket.id} joined room ${matchId} (${connectedCount} connected)`,
      );

      ack?.({ ok: true });

      // Notify other sockets in the room that a player connected
      socket.to(matchId).emit("game:player-connected", {
        matchId,
        userId,
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
      socketToUser.delete(socket.id);
    });
  });
}

function leaveRoom(socket: Socket, matchId: string): void {
  socket.leave(matchId);
  socketToMatch.delete(socket.id);

  // Track in connected-users for push notification decisions
  trackUserLeave(matchId, socket.id);

  const roomSockets = matchRooms.get(matchId);
  if (roomSockets) {
    roomSockets.delete(socket.id);
    const remaining = roomSockets.size;

    if (remaining === 0) {
      matchRooms.delete(matchId);
    }

    serverLog.log(
      `[game-rooms] Socket ${socket.id} left room ${matchId} (${remaining} remaining)`,
    );

    // Notify remaining sockets
    const disconnectedUserId = socketToUser.get(socket.id);
    socket.to(matchId).emit("game:player-disconnected", {
      matchId,
      userId: disconnectedUserId,
      connectedSockets: remaining,
    });

    // Start forfeit countdown if a player disconnected from the room
    if (disconnectedUserId) {
      startForfeitTimer(matchId, disconnectedUserId);
    }
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

/** Get the userId associated with a socket ID. */
export function getUserIdBySocket(socketId: string): string | undefined {
  return socketToUser.get(socketId);
}

/** Reset all room tracking (for testing). */
export function resetRooms(): void {
  matchRooms.clear();
  socketToMatch.clear();
  socketToUser.clear();
  resetConnectedUsers();
}
