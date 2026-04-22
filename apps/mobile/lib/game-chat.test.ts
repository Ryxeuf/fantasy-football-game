import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mock socket ---
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  connected: true,
  id: "test-socket-id",
};

// Must import after mock setup
import {
  createGameChatHelpers,
  MAX_CHAT_MESSAGES,
  MAX_MESSAGE_LENGTH,
  appendChatMessage,
  type ChatMessage,
} from "./game-chat";

describe("game-chat — createGameChatHelpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.on.mockReset();
    mockSocket.off.mockReset();
    mockSocket.emit.mockReset();
  });

  describe("sendMessage", () => {
    it("emits game:chat-message with matchId and trimmed message", () => {
      mockSocket.emit.mockImplementation(
        (_event: string, _payload: unknown, ack: (res: unknown) => void) => {
          ack({ ok: true });
        },
      );

      const { sendMessage } = createGameChatHelpers(mockSocket as any);
      sendMessage("match-1", "  Hello!  ");

      expect(mockSocket.emit).toHaveBeenCalledWith(
        "game:chat-message",
        { matchId: "match-1", message: "Hello!" },
        expect.any(Function),
      );
    });

    it("resolves with ack payload on success", async () => {
      mockSocket.emit.mockImplementation(
        (_event: string, _payload: unknown, ack: (res: unknown) => void) => {
          ack({ ok: true });
        },
      );

      const { sendMessage } = createGameChatHelpers(mockSocket as any);
      const result = await sendMessage("match-1", "Test");

      expect(result.ok).toBe(true);
    });

    it("resolves with error on server rejection", async () => {
      mockSocket.emit.mockImplementation(
        (_event: string, _payload: unknown, ack: (res: unknown) => void) => {
          ack({ ok: false, error: "Rate limited" });
        },
      );

      const { sendMessage } = createGameChatHelpers(mockSocket as any);
      const result = await sendMessage("match-1", "Spam");

      expect(result.ok).toBe(false);
      expect(result.error).toBe("Rate limited");
    });

    it("rejects empty/whitespace messages client-side without emitting", async () => {
      const { sendMessage } = createGameChatHelpers(mockSocket as any);
      const result = await sendMessage("match-1", "   ");

      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    it("rejects messages exceeding MAX_MESSAGE_LENGTH", async () => {
      const { sendMessage } = createGameChatHelpers(mockSocket as any);
      const result = await sendMessage(
        "match-1",
        "x".repeat(MAX_MESSAGE_LENGTH + 1),
      );

      expect(result.ok).toBe(false);
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe("event registration", () => {
    it("onChatMessage registers listener for game:chat-message", () => {
      const handler = vi.fn();
      const { onChatMessage } = createGameChatHelpers(mockSocket as any);
      onChatMessage(handler);

      expect(mockSocket.on).toHaveBeenCalledWith("game:chat-message", handler);
    });
  });

  describe("cleanup", () => {
    it("removes chat event listener on cleanup", () => {
      const { cleanup } = createGameChatHelpers(mockSocket as any);
      cleanup();

      expect(mockSocket.off).toHaveBeenCalledWith("game:chat-message");
    });
  });

  describe("constants", () => {
    it("MAX_CHAT_MESSAGES is 100", () => {
      expect(MAX_CHAT_MESSAGES).toBe(100);
    });

    it("MAX_MESSAGE_LENGTH is 500", () => {
      expect(MAX_MESSAGE_LENGTH).toBe(500);
    });
  });
});

describe("game-chat — appendChatMessage (rolling buffer)", () => {
  const baseMsg: ChatMessage = {
    matchId: "match-1",
    userId: "user-a",
    message: "hi",
    timestamp: "2026-04-22T10:00:00.000Z",
  };

  it("appends a message to an empty list", () => {
    const next = appendChatMessage([], baseMsg);
    expect(next).toHaveLength(1);
    expect(next[0]).toEqual(baseMsg);
  });

  it("appends messages preserving order", () => {
    const a = { ...baseMsg, message: "a" };
    const b = { ...baseMsg, message: "b" };
    const next = appendChatMessage([a], b);
    expect(next.map((m) => m.message)).toEqual(["a", "b"]);
  });

  it("returns a new array (immutable)", () => {
    const prev: ChatMessage[] = [];
    const next = appendChatMessage(prev, baseMsg);
    expect(next).not.toBe(prev);
  });

  it("keeps only the last MAX_CHAT_MESSAGES when overflowing", () => {
    const initial: ChatMessage[] = Array.from(
      { length: MAX_CHAT_MESSAGES },
      (_, i) => ({ ...baseMsg, message: `m${i}` }),
    );
    const newest = { ...baseMsg, message: "newest" };
    const next = appendChatMessage(initial, newest);

    expect(next).toHaveLength(MAX_CHAT_MESSAGES);
    expect(next[next.length - 1]).toEqual(newest);
    expect(next[0].message).toBe("m1");
  });
});
