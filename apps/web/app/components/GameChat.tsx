"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { ChatMessage, ChatAck } from "../play-hidden/[id]/hooks/useGameChat";

export interface GameChatProps {
  messages: ChatMessage[];
  sendMessage: (text: string) => Promise<ChatAck>;
  currentUserId?: string;
}

/**
 * Collapsible in-game chat panel, fixed bottom-right.
 * Shows messages and allows sending text to the opponent.
 */
export default function GameChat({
  messages,
  sendMessage,
  currentUserId,
}: GameChatProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const prevMessageCountRef = useRef(messages.length);

  // Track unread messages when chat is closed
  useEffect(() => {
    if (!open && messages.length > prevMessageCountRef.current) {
      setUnreadCount((c) => c + (messages.length - prevMessageCountRef.current));
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length, open]);

  // Clear unread when opening
  useEffect(() => {
    if (open) setUnreadCount(0);
  }, [open]);

  // Auto-scroll to bottom when new messages arrive and chat is open
  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, open]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setError(null);

    const result = await sendMessage(trimmed);

    setSending(false);

    if (result.ok) {
      setInput("");
    } else {
      setError(result.error ?? "Failed to send");
    }
  }, [input, sending, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  // Collapsed: show toggle button
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-4 z-50 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg transition-colors"
        title="Ouvrir le chat"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
    );
  }

  // Expanded: chat panel
  return (
    <div className="fixed bottom-4 left-4 z-50 w-80 max-h-96 bg-white border border-gray-300 rounded-lg shadow-xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-indigo-600 text-white rounded-t-lg">
        <span className="text-sm font-semibold">Chat</span>
        <button
          onClick={() => setOpen(false)}
          className="text-white hover:text-gray-200 transition-colors"
          title="Fermer le chat"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-[120px] max-h-[240px]">
        {messages.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">
            Aucun message. Dites bonjour !
          </p>
        )}
        {messages.map((msg, i) => {
          const isMe = currentUserId && msg.userId === currentUserId;
          return (
            <div
              key={`${msg.timestamp}-${i}`}
              className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
            >
              <div
                className={`text-xs px-3 py-1.5 rounded-lg max-w-[85%] break-words ${
                  isMe
                    ? "bg-indigo-100 text-indigo-900"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {msg.message}
              </div>
              <span className="text-[10px] text-gray-400 mt-0.5">
                {new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="px-3 py-1 text-xs text-red-600 bg-red-50 border-t border-red-200">
          {error}
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-gray-200">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message..."
          maxLength={500}
          className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-indigo-500"
          disabled={sending}
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className="text-sm px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {sending ? "..." : "Envoyer"}
        </button>
      </div>
    </div>
  );
}
