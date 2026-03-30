import { Server as HttpServer } from "node:http";
import { Server, Namespace } from "socket.io";
import { registerGameRoomHandlers } from "./game-rooms";

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
      origin: "*",
      methods: ["GET", "POST"],
    },
    // Only enable websocket (upgrade from polling) for lower latency
    transports: ["websocket", "polling"],
  });

  gameNamespace = io.of("/game");

  gameNamespace.on("connection", (socket) => {
    console.log(`[socket.io] /game client connected: ${socket.id}`);

    socket.on("disconnect", (reason) => {
      console.log(
        `[socket.io] /game client disconnected: ${socket.id} (${reason})`,
      );
    });
  });

  // Register game room handlers (join/leave match rooms)
  registerGameRoomHandlers(gameNamespace);

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
