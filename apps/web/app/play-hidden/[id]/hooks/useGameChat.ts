"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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

// --- Pure helpers (testable without React) ---

/**
 * Typed helper functions for chat events on a raw socket.
 */
export function createGameChatHelpers(socket: Socket) {
  return {
    sendMessage(matchId: string, message: string): Promise<ChatAck> {
      const trimmed = message.trim();

      // Client-side validation
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

// --- React hook ---

export interface UseGameChatOptions {
  /** Socket instance from useGameSocket (or null if not connected). */
  socket: Socket | null;
  /** The match ID to scope chat messages. */
  matchId: string;
}

export interface UseGameChatResult {
  /** Chat messages received so far (most recent last). */
  messages: ChatMessage[];
  /** Send a chat message. Returns the ack payload. */
  sendMessage: (text: string) => Promise<ChatAck>;
}

/**
 * React hook for in-game chat within a match room.
 *
 * Listens for chat messages on the socket and exposes a `sendMessage` function.
 * Keeps a rolling buffer of the last MAX_CHAT_MESSAGES messages.
 */
export function useGameChat({
  socket,
  matchId,
}: UseGameChatOptions): UseGameChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const helpersRef = useRef<ReturnType<typeof createGameChatHelpers> | null>(
    null,
  );

  useEffect(() => {
    if (!socket) return;

    const helpers = createGameChatHelpers(socket);
    helpersRef.current = helpers;

    helpers.onChatMessage((data) => {
      if (data.matchId !== matchId) return;
      setMessages((prev) => {
        const next = [...prev, data];
        // Keep only the last MAX_CHAT_MESSAGES
        return next.length > MAX_CHAT_MESSAGES
          ? next.slice(next.length - MAX_CHAT_MESSAGES)
          : next;
      });
    });

    return () => {
      helpers.cleanup();
      helpersRef.current = null;
    };
  }, [socket, matchId]);

  const sendMessage = useCallback(
    async (text: string): Promise<ChatAck> => {
      if (!helpersRef.current) {
        return { ok: false, error: "Not connected" };
      }
      return helpersRef.current.sendMessage(matchId, text);
    },
    [matchId],
  );

  return { messages, sendMessage };
}
