import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// --- Mock socket.io-client ---
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  connected: false,
  id: "test-socket-id",
  io: {
    on: vi.fn(),
    off: vi.fn(),
  },
};

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => mockSocket),
}));

// Must import after mock setup
import { io } from "socket.io-client";
import {
  createGameSocket,
  type GameSocketEvents,
} from "./useGameSocket";

describe("useGameSocket — createGameSocket", () => {
  const matchId = "match-123";
  const authToken = "test-jwt-token";

  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.connected = false;
    // Reset on/off/emit tracking
    mockSocket.on.mockReset();
    mockSocket.off.mockReset();
    mockSocket.emit.mockReset();
    mockSocket.io.on.mockReset();
    mockSocket.io.off.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("connection", () => {
    it("creates a socket.io connection to the /game namespace", () => {
      const socket = createGameSocket("http://localhost:8201", authToken);
      expect(io).toHaveBeenCalledWith("http://localhost:8201/game", expect.objectContaining({
        auth: { token: `Bearer ${authToken}` },
        transports: ["websocket", "polling"],
        autoConnect: false,
      }));
      expect(socket).toBe(mockSocket);
    });

    it("does not auto-connect (explicit connect required)", () => {
      createGameSocket("http://localhost:8201", authToken);
      expect(mockSocket.connect).not.toHaveBeenCalled();
    });
  });

  describe("joinMatch", () => {
    it("emits game:join-match with matchId and handles ack", () => {
      mockSocket.emit.mockImplementation(
        (event: string, payload: unknown, ack: (res: { ok: boolean }) => void) => {
          ack({ ok: true });
        },
      );

      const { joinMatch } = createGameSocketHelpers(mockSocket as any);
      const result = joinMatch(matchId);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        "game:join-match",
        { matchId },
        expect.any(Function),
      );
    });
  });

  describe("leaveMatch", () => {
    it("emits game:leave-match with matchId", () => {
      const { leaveMatch } = createGameSocketHelpers(mockSocket as any);
      leaveMatch(matchId);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        "game:leave-match",
        { matchId },
        expect.any(Function),
      );
    });
  });

  describe("event registration", () => {
    it("registers listener for game:state-updated", () => {
      const handler = vi.fn();
      const { onStateUpdated } = createGameSocketHelpers(mockSocket as any);
      onStateUpdated(handler);

      expect(mockSocket.on).toHaveBeenCalledWith("game:state-updated", handler);
    });

    it("registers listener for game:player-connected", () => {
      const handler = vi.fn();
      const { onPlayerConnected } = createGameSocketHelpers(mockSocket as any);
      onPlayerConnected(handler);

      expect(mockSocket.on).toHaveBeenCalledWith("game:player-connected", handler);
    });

    it("registers listener for game:player-disconnected", () => {
      const handler = vi.fn();
      const { onPlayerDisconnected } = createGameSocketHelpers(mockSocket as any);
      onPlayerDisconnected(handler);

      expect(mockSocket.on).toHaveBeenCalledWith("game:player-disconnected", handler);
    });

    it("registers listener for game:match-ended", () => {
      const handler = vi.fn();
      const { onMatchEnded } = createGameSocketHelpers(mockSocket as any);
      onMatchEnded(handler);

      expect(mockSocket.on).toHaveBeenCalledWith("game:match-ended", handler);
    });
  });

  describe("cleanup", () => {
    it("removes all game event listeners on cleanup", () => {
      const { cleanup } = createGameSocketHelpers(mockSocket as any);
      cleanup();

      expect(mockSocket.off).toHaveBeenCalledWith("game:state-updated");
      expect(mockSocket.off).toHaveBeenCalledWith("game:player-connected");
      expect(mockSocket.off).toHaveBeenCalledWith("game:player-disconnected");
      expect(mockSocket.off).toHaveBeenCalledWith("game:match-ended");
    });
  });
});

// Import the helpers function (will be defined in the hook module)
import { createGameSocketHelpers } from "./useGameSocket";

describe("useGameSocket — submitMove via WebSocket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.on.mockReset();
    mockSocket.off.mockReset();
    mockSocket.emit.mockReset();
  });

  it("emits game:submit-move with matchId and move, resolves with ack", async () => {
    const ackPayload = {
      success: true,
      gameState: { currentPlayer: "B" },
      isMyTurn: false,
      moveCount: 1,
    };

    mockSocket.emit.mockImplementation(
      (event: string, payload: unknown, ack: (res: unknown) => void) => {
        ack(ackPayload);
      },
    );

    const { submitMove } = createGameSocketHelpers(mockSocket as any);
    const result = await submitMove("match-ws-1", { type: "END_TURN" } as any);

    expect(mockSocket.emit).toHaveBeenCalledWith(
      "game:submit-move",
      { matchId: "match-ws-1", move: { type: "END_TURN" } },
      expect.any(Function),
    );
    expect(result).toEqual(ackPayload);
  });

  it("resolves with error payload when move is rejected", async () => {
    const errorPayload = {
      success: false,
      error: "Not your turn",
      code: "NOT_YOUR_TURN",
    };

    mockSocket.emit.mockImplementation(
      (event: string, payload: unknown, ack: (res: unknown) => void) => {
        ack(errorPayload);
      },
    );

    const { submitMove } = createGameSocketHelpers(mockSocket as any);
    const result = await submitMove("match-ws-2", { type: "MOVE", playerId: "p1", to: { x: 3, y: 4 } } as any);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Not your turn");
  });
});

describe("useGameSocket — reconnection configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.on.mockReset();
    mockSocket.off.mockReset();
    mockSocket.emit.mockReset();
    mockSocket.io.on.mockReset();
    mockSocket.io.off.mockReset();
  });

  it("configures socket.io with exponential backoff reconnection", () => {
    createGameSocket("http://localhost:8201", "token-123");

    expect(io).toHaveBeenCalledWith(
      "http://localhost:8201/game",
      expect.objectContaining({
        reconnection: true,
        reconnectionDelay: 500,
        reconnectionDelayMax: 10000,
        reconnectionAttempts: 15,
        randomizationFactor: 0.3,
      }),
    );
  });

  it("still includes auth and transport config alongside reconnection", () => {
    createGameSocket("http://localhost:8201", "my-jwt");

    expect(io).toHaveBeenCalledWith(
      "http://localhost:8201/game",
      expect.objectContaining({
        auth: { token: "Bearer my-jwt" },
        transports: ["websocket", "polling"],
        autoConnect: false,
        reconnection: true,
      }),
    );
  });
});

describe("useGameSocket — reconnection helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.on.mockReset();
    mockSocket.off.mockReset();
    mockSocket.emit.mockReset();
    mockSocket.io.on.mockReset();
    mockSocket.io.off.mockReset();
  });

  it("requestResync emits game:request-resync with matchId", () => {
    const resyncPayload = {
      success: true,
      gameState: { currentPlayer: "A" },
    };

    mockSocket.emit.mockImplementation(
      (event: string, payload: unknown, ack: (res: unknown) => void) => {
        ack(resyncPayload);
      },
    );

    const { requestResync } = createGameSocketHelpers(mockSocket as any);
    requestResync("match-resync-1");

    expect(mockSocket.emit).toHaveBeenCalledWith(
      "game:request-resync",
      { matchId: "match-resync-1" },
      expect.any(Function),
    );
  });

  it("requestResync resolves with gameState payload", async () => {
    const resyncPayload = {
      success: true,
      gameState: { currentPlayer: "B", turn: 3 },
    };

    mockSocket.emit.mockImplementation(
      (event: string, payload: unknown, ack: (res: unknown) => void) => {
        ack(resyncPayload);
      },
    );

    const { requestResync } = createGameSocketHelpers(mockSocket as any);
    const result = await requestResync("match-resync-2");

    expect(result.success).toBe(true);
    expect(result.gameState).toEqual({ currentPlayer: "B", turn: 3 });
  });

  it("requestResync resolves with error when resync fails", async () => {
    const errorPayload = {
      success: false,
      error: "Match not found",
    };

    mockSocket.emit.mockImplementation(
      (event: string, payload: unknown, ack: (res: unknown) => void) => {
        ack(errorPayload);
      },
    );

    const { requestResync } = createGameSocketHelpers(mockSocket as any);
    const result = await requestResync("match-bad");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Match not found");
  });
});
