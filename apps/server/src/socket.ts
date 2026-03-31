import { Server as HttpServer } from "node:http";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

export interface AuthenticatedSocket extends Socket {
  userId: string;
  userRoles: string[];
}

let io: Server | null = null;

/**
 * Initialize socket.io server attached to an existing HTTP server.
 * Authenticates connections via JWT token in handshake auth.
 */
export function initSocketIO(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    path: "/socket.io",
    pingInterval: 25000,
    pingTimeout: 60000,
  });

  // JWT authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error("Authentication required"));
    }
    try {
      const payload = jwt.verify(token, JWT_SECRET) as any;
      (socket as AuthenticatedSocket).userId = payload.sub;
      (socket as AuthenticatedSocket).userRoles = Array.isArray(payload.roles)
        ? payload.roles
        : payload.role
          ? [payload.role]
          : [];
      return next();
    } catch {
      return next(new Error("Invalid token"));
    }
  });

  io.on("connection", (rawSocket: Socket) => {
    const socket = rawSocket as AuthenticatedSocket;
    console.log(`[WS] User ${socket.userId} connected (socket ${socket.id})`);

    // Join a match room
    socket.on("match:join", (matchId: string) => {
      if (typeof matchId !== "string" || !matchId) return;
      socket.join(`match:${matchId}`);
      console.log(`[WS] User ${socket.userId} joined match:${matchId}`);
    });

    // Leave a match room
    socket.on("match:leave", (matchId: string) => {
      if (typeof matchId !== "string" || !matchId) return;
      socket.leave(`match:${matchId}`);
      console.log(`[WS] User ${socket.userId} left match:${matchId}`);
    });

    socket.on("disconnect", (reason) => {
      console.log(
        `[WS] User ${socket.userId} disconnected (${reason})`,
      );
    });
  });

  return io;
}

/**
 * Get the socket.io server instance.
 * Returns null if not initialized.
 */
export function getIO(): Server | null {
  return io;
}

/**
 * Emit a game state update to all clients in a match room.
 */
export function emitGameStateUpdate(
  matchId: string,
  gameState: unknown,
  moveCount: number,
): void {
  if (!io) return;
  io.to(`match:${matchId}`).emit("game:state-update", {
    matchId,
    gameState,
    moveCount,
  });
}

/**
 * Emit a match status change to all clients in a match room.
 */
export function emitMatchStatusChange(
  matchId: string,
  status: string,
  data?: Record<string, unknown>,
): void {
  if (!io) return;
  io.to(`match:${matchId}`).emit("game:match-status", {
    matchId,
    status,
    ...data,
  });
}

/**
 * Emit a turn change notification to all clients in a match room.
 */
export function emitTurnChange(
  matchId: string,
  currentTeam: string,
  currentUserId: string | null,
): void {
  if (!io) return;
  io.to(`match:${matchId}`).emit("game:turn-change", {
    matchId,
    currentTeam,
    currentUserId,
  });
}
