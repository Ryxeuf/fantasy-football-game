import { Server as HttpServer } from "node:http";
import { Server, Namespace } from "socket.io";
import { registerGameRoomHandlers } from "./game-rooms";
import { registerGameActionHandlers } from "./game-actions";
import { registerResyncHandler } from "./game-resync";
import { registerGameChatHandlers } from "./game-chat";
import { registerSpectatorHandlers } from "./game-spectator";
import { authSocket } from "./middleware/authSocket";
import { CORS_ORIGINS } from "./config";
import { serverLog } from "./utils/server-log";

let io: Server | null = null;
let gameNamespace: Namespace | null = null;

export interface SocketSetupOptions {
  cors?: {
    origin: string | string[];
    methods?: string[];
  };
}

/**
 * Initialize socket.io on the given HTTP server.
 * Returns the root Server instance.
 */
export function setupSocket(
  httpServer: HttpServer,
  options: SocketSetupOptions = {},
): Server {
  io = new Server(httpServer, {
    cors: options.cors ?? {
      origin: CORS_ORIGINS,
      methods: ["GET", "POST"],
    },
    // Only enable websocket (upgrade from polling) for lower latency
    transports: ["websocket", "polling"],
  });

  gameNamespace = io.of("/game");

  // Authenticate every incoming connection via JWT
  gameNamespace.use(authSocket);

  gameNamespace.on("connection", (socket) => {
    const userId = socket.data.user?.id ?? "unknown";
    serverLog.log(`[socket.io] /game client connected: ${socket.id} (user: ${userId})`);

    socket.on("disconnect", (reason) => {
      serverLog.log(
        `[socket.io] /game client disconnected: ${socket.id} (${reason})`,
      );
    });
  });

  // Register game room handlers (join/leave match rooms)
  registerGameRoomHandlers(gameNamespace);

  // Register game action handlers (move submission via WebSocket)
  registerGameActionHandlers(gameNamespace);

  // Register resync handler (state recovery after reconnection)
  registerResyncHandler(gameNamespace);

  // Register chat handlers (in-match text chat)
  registerGameChatHandlers(gameNamespace);

  // Register spectator handlers (read-only match viewing)
  registerSpectatorHandlers(gameNamespace);

  return io;
}

/** Get the initialized socket.io Server (throws if not yet set up). */
export function getIO(): Server {
  if (!io) {
    throw new Error("socket.io has not been initialized. Call setupSocket first.");
  }
  return io;
}

/** Get the /game namespace (throws if not yet set up). */
export function getGameNamespace(): Namespace {
  if (!gameNamespace) {
    throw new Error("socket.io /game namespace not initialized. Call setupSocket first.");
  }
  return gameNamespace;
}
