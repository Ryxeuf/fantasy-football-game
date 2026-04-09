import type { Namespace, Socket } from "socket.io";

const MAX_MESSAGE_LENGTH = 500;
const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX = 10;

export interface ChatMessagePayload {
  matchId: string;
  message: string;
}

export interface ChatBroadcast {
  matchId: string;
  userId: string;
  message: string;
  timestamp: string;
}

/**
 * Simple sliding-window rate limiter per socket.
 * Tracks timestamps of recent messages; drops oldest entries outside the window.
 */
const rateLimitMap = new Map<string, number[]>();

function isRateLimited(socketId: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(socketId) ?? [];

  // Remove entries outside the window
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  rateLimitMap.set(socketId, recent);

  if (recent.length >= RATE_LIMIT_MAX) {
    return true;
  }

  recent.push(now);
  return false;
}

/**
 * Register chat event handlers on the /game namespace.
 * Handles game:chat-message for in-match text chat.
 */
export function registerGameChatHandlers(gameNamespace: Namespace): void {
  gameNamespace.on("connection", (socket: Socket) => {
    socket.on(
      "game:chat-message",
      (
        payload: ChatMessagePayload,
        ack?: (response: { ok: boolean; error?: string }) => void,
      ) => {
        const userId: string | undefined = socket.data.user?.id;

        const { matchId, message } = payload ?? {};

        // Validate required fields
        if (
          !matchId ||
          typeof matchId !== "string" ||
          !message ||
          typeof message !== "string" ||
          message.trim().length === 0
        ) {
          ack?.({ ok: false, error: "matchId and message are required" });
          return;
        }

        // Validate message length
        if (message.length > MAX_MESSAGE_LENGTH) {
          ack?.({
            ok: false,
            error: `Message too long (max ${MAX_MESSAGE_LENGTH} characters)`,
          });
          return;
        }

        // Rate limiting
        if (isRateLimited(socket.id)) {
          ack?.({ ok: false, error: "Too many messages — rate limited" });
          return;
        }

        // Broadcast to everyone in the room (including sender)
        const broadcast: ChatBroadcast = {
          matchId,
          userId: userId ?? "anonymous",
          message: message.trim(),
          timestamp: new Date().toISOString(),
        };

        gameNamespace.to(matchId).emit("game:chat-message", broadcast);

        ack?.({ ok: true });
      },
    );

    // Clean up rate limit entries on disconnect
    socket.on("disconnect", () => {
      rateLimitMap.delete(socket.id);
    });
  });
}

/** Reset rate limit tracking (for testing). */
export function resetChatRateLimits(): void {
  rateLimitMap.clear();
}
