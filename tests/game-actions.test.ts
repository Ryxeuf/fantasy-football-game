import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock move-processor before importing game-actions
vi.mock("../apps/server/src/services/move-processor", () => ({
  processMove: vi.fn(),
}));

import { registerGameActionHandlers } from "../apps/server/src/game-actions";
import { processMove } from "../apps/server/src/services/move-processor";
import type { Namespace, Socket } from "socket.io";

// Helper to create a mock socket
function createMockSocket(userId?: string): Socket {
  const listeners = new Map<string, Function>();
  return {
    id: `socket-${Math.random().toString(36).slice(2, 8)}`,
    data: {
      user: userId ? { id: userId } : undefined,
    },
    on: vi.fn((event: string, handler: Function) => {
      listeners.set(event, handler);
    }),
    // Allow tests to trigger registered handlers
    _trigger(event: string, ...args: unknown[]) {
      const handler = listeners.get(event);
      if (handler) handler(...args);
    },
  } as unknown as Socket & { _trigger: (event: string, ...args: unknown[]) => void };
}

// Helper to create a mock namespace
function createMockNamespace(): Namespace & { _triggerConnection: (socket: Socket) => void } {
  const connectionHandlers: Function[] = [];
  return {
    on: vi.fn((event: string, handler: Function) => {
      if (event === "connection") connectionHandlers.push(handler);
    }),
    _triggerConnection(socket: Socket) {
      connectionHandlers.forEach((h) => h(socket));
    },
  } as unknown as Namespace & { _triggerConnection: (socket: Socket) => void };
}

describe("game-actions", () => {
  let mockNamespace: ReturnType<typeof createMockNamespace>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNamespace = createMockNamespace();
  });

  it("registers a connection handler on the namespace", () => {
    registerGameActionHandlers(mockNamespace);
    expect(mockNamespace.on).toHaveBeenCalledWith("connection", expect.any(Function));
  });

  it("registers game:submit-move handler on each connected socket", () => {
    registerGameActionHandlers(mockNamespace);
    const socket = createMockSocket("user-1");
    mockNamespace._triggerConnection(socket);

    expect(socket.on).toHaveBeenCalledWith("game:submit-move", expect.any(Function));
  });

  describe("game:submit-move handler", () => {
    it("calls processMove with correct params and acks success", async () => {
      const successResult = {
        success: true,
        gameState: { currentPlayer: "B", turn: 1, half: 1 },
        isMyTurn: false,
        moveCount: 1,
      };
      vi.mocked(processMove).mockResolvedValue(successResult as any);

      registerGameActionHandlers(mockNamespace);
      const socket = createMockSocket("user-abc") as Socket & { _trigger: Function };
      mockNamespace._triggerConnection(socket);

      const ack = vi.fn();
      await (socket as any)._trigger("game:submit-move", {
        matchId: "match-123",
        move: { type: "END_TURN" },
      }, ack);

      // Wait for async handler
      await vi.waitFor(() => {
        expect(processMove).toHaveBeenCalledWith("match-123", "user-abc", { type: "END_TURN" });
      });

      await vi.waitFor(() => {
        expect(ack).toHaveBeenCalledWith(successResult);
      });
    });

    it("returns error when processMove fails", async () => {
      const errorResult = {
        success: false,
        error: "Ce n'est pas votre tour.",
        code: "NOT_YOUR_TURN",
      };
      vi.mocked(processMove).mockResolvedValue(errorResult as any);

      registerGameActionHandlers(mockNamespace);
      const socket = createMockSocket("user-xyz") as Socket & { _trigger: Function };
      mockNamespace._triggerConnection(socket);

      const ack = vi.fn();
      await (socket as any)._trigger("game:submit-move", {
        matchId: "match-456",
        move: { type: "MOVE", playerId: "p1", to: { x: 5, y: 3 } },
      }, ack);

      await vi.waitFor(() => {
        expect(ack).toHaveBeenCalledWith(errorResult);
      });
    });

    it("rejects unauthenticated sockets", async () => {
      registerGameActionHandlers(mockNamespace);
      const socket = createMockSocket() as Socket & { _trigger: Function }; // no userId
      mockNamespace._triggerConnection(socket);

      const ack = vi.fn();
      await (socket as any)._trigger("game:submit-move", {
        matchId: "match-789",
        move: { type: "END_TURN" },
      }, ack);

      await vi.waitFor(() => {
        expect(ack).toHaveBeenCalledWith({
          success: false,
          error: "Authentication required",
          code: "AUTH_REQUIRED",
        });
      });
      expect(processMove).not.toHaveBeenCalled();
    });

    it("rejects missing matchId", async () => {
      registerGameActionHandlers(mockNamespace);
      const socket = createMockSocket("user-1") as Socket & { _trigger: Function };
      mockNamespace._triggerConnection(socket);

      const ack = vi.fn();
      await (socket as any)._trigger("game:submit-move", {
        move: { type: "END_TURN" },
      }, ack);

      await vi.waitFor(() => {
        expect(ack).toHaveBeenCalledWith({
          success: false,
          error: "matchId and move are required",
          code: "INVALID_PAYLOAD",
        });
      });
      expect(processMove).not.toHaveBeenCalled();
    });

    it("rejects missing move", async () => {
      registerGameActionHandlers(mockNamespace);
      const socket = createMockSocket("user-1") as Socket & { _trigger: Function };
      mockNamespace._triggerConnection(socket);

      const ack = vi.fn();
      await (socket as any)._trigger("game:submit-move", {
        matchId: "match-123",
      }, ack);

      await vi.waitFor(() => {
        expect(ack).toHaveBeenCalledWith({
          success: false,
          error: "matchId and move are required",
          code: "INVALID_PAYLOAD",
        });
      });
    });

    it("handles processMove throwing an exception", async () => {
      vi.mocked(processMove).mockRejectedValue(new Error("DB connection lost"));

      registerGameActionHandlers(mockNamespace);
      const socket = createMockSocket("user-1") as Socket & { _trigger: Function };
      mockNamespace._triggerConnection(socket);

      const ack = vi.fn();
      await (socket as any)._trigger("game:submit-move", {
        matchId: "match-err",
        move: { type: "END_TURN" },
      }, ack);

      await vi.waitFor(() => {
        expect(ack).toHaveBeenCalledWith({
          success: false,
          error: "DB connection lost",
          code: "SERVER_ERROR",
        });
      });
    });

    it("works without ack callback (fire-and-forget)", async () => {
      const successResult = {
        success: true,
        gameState: { currentPlayer: "A" },
        isMyTurn: true,
        moveCount: 1,
      };
      vi.mocked(processMove).mockResolvedValue(successResult as any);

      registerGameActionHandlers(mockNamespace);
      const socket = createMockSocket("user-1") as Socket & { _trigger: Function };
      mockNamespace._triggerConnection(socket);

      // No ack — should not throw
      await (socket as any)._trigger("game:submit-move", {
        matchId: "match-ok",
        move: { type: "END_TURN" },
      });

      await vi.waitFor(() => {
        expect(processMove).toHaveBeenCalledWith("match-ok", "user-1", { type: "END_TURN" });
      });
    });
  });
});
