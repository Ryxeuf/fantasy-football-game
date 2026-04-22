// React hook that manages the in-game chat channel on the /game namespace.
// Mirrors apps/web useGameChat, reusing the mobile socket exposed by
// useGameSocket.

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import {
  appendChatMessage,
  createGameChatHelpers,
  type ChatAck,
  type ChatMessage,
  type GameChatHelpers,
} from "./game-chat";

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
 * Listens for chat messages on the provided socket and exposes a
 * `sendMessage` function. Keeps a rolling buffer of the last
 * MAX_CHAT_MESSAGES messages.
 */
export function useGameChat({
  socket,
  matchId,
}: UseGameChatOptions): UseGameChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const helpersRef = useRef<GameChatHelpers | null>(null);

  useEffect(() => {
    if (!socket) return;

    const helpers = createGameChatHelpers(socket);
    helpersRef.current = helpers;

    helpers.onChatMessage((data) => {
      if (data.matchId !== matchId) return;
      setMessages((prev) => appendChatMessage(prev, data));
    });

    return () => {
      helpers.cleanup();
      helpersRef.current = null;
    };
  }, [socket, matchId]);

  const sendMessage = useCallback(
    async (text: string): Promise<ChatAck> => {
      const helpers = helpersRef.current;
      if (!helpers) {
        return { ok: false, error: "Not connected" };
      }
      return helpers.sendMessage(matchId, text);
    },
    [matchId],
  );

  return { messages, sendMessage };
}
