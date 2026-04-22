// Pure helpers around socket.io-client for the in-game chat channel.
// Mirrors apps/web useGameChat helpers, but kept React-agnostic so
// the logic can be unit-tested in Node without React Native.

import type { Socket } from "socket.io-client";

// --- Constants ---

export const MAX_CHAT_MESSAGES = 100;
export const MAX_MESSAGE_LENGTH = 500;

// --- Types ---

export interface ChatMessage {
  matchId: string;
  userId: string;
  message: string;
  timestamp: string;
}

export interface ChatAck {
  ok: boolean;
  error?: string;
}

// --- Helpers ---

/**
 * Typed helper functions for chat events on a raw socket.
 * Callers keep hold of the returned object to send, subscribe and cleanup.
 */
export function createGameChatHelpers(socket: Socket) {
  return {
    sendMessage(matchId: string, message: string): Promise<ChatAck> {
      const trimmed = message.trim();

      if (!trimmed) {
        return Promise.resolve({ ok: false, error: "Message cannot be empty" });
      }
      if (trimmed.length > MAX_MESSAGE_LENGTH) {
        return Promise.resolve({
          ok: false,
          error: `Message too long (max ${MAX_MESSAGE_LENGTH} characters)`,
        });
      }

      return new Promise((resolve) => {
        socket.emit(
          "game:chat-message",
          { matchId, message: trimmed },
          (response: ChatAck) => {
            resolve(response);
          },
        );
      });
    },

    onChatMessage(handler: (data: ChatMessage) => void): void {
      socket.on("game:chat-message", handler);
    },

    cleanup(): void {
      socket.off("game:chat-message");
    },
  };
}

export type GameChatHelpers = ReturnType<typeof createGameChatHelpers>;

/**
 * Immutable rolling-buffer append: returns a new array with the latest
 * message at the end, capped to MAX_CHAT_MESSAGES.
 */
export function appendChatMessage(
  prev: ReadonlyArray<ChatMessage>,
  next: ChatMessage,
): ChatMessage[] {
  const appended = [...prev, next];
  return appended.length > MAX_CHAT_MESSAGES
    ? appended.slice(appended.length - MAX_CHAT_MESSAGES)
    : appended;
}
