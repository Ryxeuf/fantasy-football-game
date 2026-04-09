import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  registerGameChatHandlers,
  resetChatRateLimits,
} from "../apps/server/src/game-chat";
import type { Namespace, Socket } from "socket.io";

// Helper to create a mock socket
function createMockSocket(
  userId?: string,
  socketId?: string,
): Socket & { _trigger: (event: string, ...args: unknown[]) => void } {
  const listeners = new Map<string, Function>();
  return {
    id: socketId ?? `socket-${Math.random().toString(36).slice(2, 8)}`,
    data: {
      user: userId ? { id: userId } : undefined,
    },
    on: vi.fn((event: string, handler: Function) => {
      listeners.set(event, handler);
    }),
    _trigger(event: string, ...args: unknown[]) {
      const handler = listeners.get(event);
      if (handler) handler(...args);
    },
  } as unknown as Socket & {
    _trigger: (event: string, ...args: unknown[]) => void;
  };
}

// Helper to create a mock namespace with emit tracking
function createMockNamespace(): Namespace & {
  _triggerConnection: (socket: Socket) => void;
  _emittedTo: Map<string, Array<{ event: string; data: unknown }>>;
} {
  const connectionHandlers: Function[] = [];
  const emittedTo = new Map<string, Array<{ event: string; data: unknown }>>();

  return {
    on: vi.fn((event: string, handler: Function) => {
      if (event === "connection") connectionHandlers.push(handler);
    }),
    to: vi.fn((room: string) => ({
      emit: vi.fn((event: string, data: unknown) => {
        if (!emittedTo.has(room)) emittedTo.set(room, []);
        emittedTo.get(room)!.push({ event, data });
      }),
    })),
    _triggerConnection(socket: Socket) {
      connectionHandlers.forEach((h) => h(socket));
    },
    _emittedTo: emittedTo,
  } as unknown as Namespace & {
    _triggerConnection: (socket: Socket) => void;
    _emittedTo: Map<string, Array<{ event: string; data: unknown }>>;
  };
}

describe("game-chat", () => {
  let mockNamespace: ReturnType<typeof createMockNamespace>;

  beforeEach(() => {
    vi.clearAllMocks();
    resetChatRateLimits();
    mockNamespace = createMockNamespace();
    registerGameChatHandlers(mockNamespace);
  });

  describe("sending messages", () => {
    it("broadcasts a chat message to the match room", () => {
      const socket = createMockSocket("user-1", "sock-1");
      mockNamespace._triggerConnection(socket);

      const ack = vi.fn();
      socket._trigger("game:chat-message", {
        matchId: "match-1",
        message: "Hello opponent!",
      }, ack);

      expect(ack).toHaveBeenCalledWith({ ok: true });

      const emitted = mockNamespace._emittedTo.get("match-1");
      expect(emitted).toBeDefined();
      expect(emitted).toHaveLength(1);
      expect(emitted![0].event).toBe("game:chat-message");

      const broadcast = emitted![0].data as {
        matchId: string;
        userId: string;
        message: string;
        timestamp: string;
      };
      expect(broadcast.matchId).toBe("match-1");
      expect(broadcast.userId).toBe("user-1");
      expect(broadcast.message).toBe("Hello opponent!");
      expect(broadcast.timestamp).toBeDefined();
    });

    it("trims whitespace from message text", () => {
      const socket = createMockSocket("user-1", "sock-1");
      mockNamespace._triggerConnection(socket);

      const ack = vi.fn();
      socket._trigger("game:chat-message", {
        matchId: "match-1",
        message: "  Hello!  ",
      }, ack);

      expect(ack).toHaveBeenCalledWith({ ok: true });
      const broadcast = mockNamespace._emittedTo.get("match-1")![0]
        .data as { message: string };
      expect(broadcast.message).toBe("Hello!");
    });

    it("sets userId to anonymous when not authenticated", () => {
      const socket = createMockSocket(undefined, "sock-anon");
      mockNamespace._triggerConnection(socket);

      const ack = vi.fn();
      socket._trigger("game:chat-message", {
        matchId: "match-1",
        message: "Hi",
      }, ack);

      expect(ack).toHaveBeenCalledWith({ ok: true });
      const broadcast = mockNamespace._emittedTo.get("match-1")![0]
        .data as { userId: string };
      expect(broadcast.userId).toBe("anonymous");
    });
  });

  describe("validation", () => {
    it("rejects a message without matchId", () => {
      const socket = createMockSocket("user-1");
      mockNamespace._triggerConnection(socket);

      const ack = vi.fn();
      socket._trigger("game:chat-message", { message: "No match id" }, ack);

      expect(ack).toHaveBeenCalledWith({
        ok: false,
        error: "matchId and message are required",
      });
    });

    it("rejects a message without message text", () => {
      const socket = createMockSocket("user-1");
      mockNamespace._triggerConnection(socket);

      const ack = vi.fn();
      socket._trigger("game:chat-message", { matchId: "m1" }, ack);

      expect(ack).toHaveBeenCalledWith({
        ok: false,
        error: "matchId and message are required",
      });
    });

    it("rejects an empty (whitespace-only) message", () => {
      const socket = createMockSocket("user-1");
      mockNamespace._triggerConnection(socket);

      const ack = vi.fn();
      socket._trigger("game:chat-message", {
        matchId: "m1",
        message: "   ",
      }, ack);

      expect(ack).toHaveBeenCalledWith({
        ok: false,
        error: "matchId and message are required",
      });
    });

    it("rejects messages longer than 500 characters", () => {
      const socket = createMockSocket("user-1");
      mockNamespace._triggerConnection(socket);

      const ack = vi.fn();
      socket._trigger("game:chat-message", {
        matchId: "m1",
        message: "x".repeat(501),
      }, ack);

      expect(ack).toHaveBeenCalledWith({
        ok: false,
        error: "Message too long (max 500 characters)",
      });
    });

    it("accepts messages of exactly 500 characters", () => {
      const socket = createMockSocket("user-1");
      mockNamespace._triggerConnection(socket);

      const ack = vi.fn();
      socket._trigger("game:chat-message", {
        matchId: "m1",
        message: "x".repeat(500),
      }, ack);

      expect(ack).toHaveBeenCalledWith({ ok: true });
    });

    it("rejects a non-string matchId", () => {
      const socket = createMockSocket("user-1");
      mockNamespace._triggerConnection(socket);

      const ack = vi.fn();
      socket._trigger("game:chat-message", {
        matchId: 42,
        message: "Hi",
      }, ack);

      expect(ack).toHaveBeenCalledWith({
        ok: false,
        error: "matchId and message are required",
      });
    });
  });

  describe("rate limiting", () => {
    it("allows up to 10 messages in quick succession", () => {
      const socket = createMockSocket("user-1", "rate-socket");
      mockNamespace._triggerConnection(socket);

      for (let i = 0; i < 10; i++) {
        const ack = vi.fn();
        socket._trigger("game:chat-message", {
          matchId: "m1",
          message: `Message ${i}`,
        }, ack);
        expect(ack).toHaveBeenCalledWith({ ok: true });
      }
    });

    it("rate-limits the 11th message", () => {
      const socket = createMockSocket("user-1", "rate-socket-2");
      mockNamespace._triggerConnection(socket);

      for (let i = 0; i < 10; i++) {
        const ack = vi.fn();
        socket._trigger("game:chat-message", {
          matchId: "m1",
          message: `Msg ${i}`,
        }, ack);
      }

      const ack = vi.fn();
      socket._trigger("game:chat-message", {
        matchId: "m1",
        message: "Too fast!",
      }, ack);

      expect(ack).toHaveBeenCalledWith(
        expect.objectContaining({
          ok: false,
          error: expect.stringContaining("rate"),
        }),
      );
    });

    it("cleans up rate limit data on disconnect", () => {
      const socket = createMockSocket("user-1", "rate-cleanup");
      mockNamespace._triggerConnection(socket);

      // Send a few messages
      for (let i = 0; i < 5; i++) {
        socket._trigger("game:chat-message", {
          matchId: "m1",
          message: `Msg ${i}`,
        }, vi.fn());
      }

      // Disconnect
      socket._trigger("disconnect");

      // resetChatRateLimits is called in beforeEach, but the disconnect
      // handler itself should have cleaned up this socket's entries
      // If we reconnect with same ID, we should be able to send again
      const socket2 = createMockSocket("user-1", "rate-cleanup");
      mockNamespace._triggerConnection(socket2);

      for (let i = 0; i < 10; i++) {
        const ack = vi.fn();
        socket2._trigger("game:chat-message", {
          matchId: "m1",
          message: `Msg ${i}`,
        }, ack);
        expect(ack).toHaveBeenCalledWith({ ok: true });
      }
    });
  });

  describe("broadcast format", () => {
    it("includes matchId, userId, message, and timestamp in broadcast", () => {
      const socket = createMockSocket("user-42", "sock-42");
      mockNamespace._triggerConnection(socket);

      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-04-09T12:00:00Z"));

      socket._trigger("game:chat-message", {
        matchId: "match-format",
        message: "Test format",
      }, vi.fn());

      vi.useRealTimers();

      const emitted = mockNamespace._emittedTo.get("match-format");
      expect(emitted).toHaveLength(1);

      const broadcast = emitted![0].data as Record<string, unknown>;
      expect(broadcast).toEqual({
        matchId: "match-format",
        userId: "user-42",
        message: "Test format",
        timestamp: "2026-04-09T12:00:00.000Z",
      });
    });
  });
});
