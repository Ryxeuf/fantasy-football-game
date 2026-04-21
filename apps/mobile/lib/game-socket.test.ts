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
  createGameSocketHelpers,
} from "./game-socket";

describe("game-socket — createGameSocket", () => {
  const authToken = "test-jwt-token";

  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.connected = false;
    mockSocket.on.mockReset();
    mockSocket.off.mockReset();
    mockSocket.emit.mockReset();
    mockSocket.io.on.mockReset();
    mockSocket.io.off.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a socket.io connection to the /game namespace", () => {
    const socket = createGameSocket("http://localhost:8201", authToken);
    expect(io).toHaveBeenCalledWith(
      "http://localhost:8201/game",
      expect.objectContaining({
        auth: { token: `Bearer ${authToken}` },
        transports: ["websocket", "polling"],
        autoConnect: false,
      }),
    );
    expect(socket).toBe(mockSocket);
  });

  it("does not auto-connect (explicit connect required)", () => {
    createGameSocket("http://localhost:8201", authToken);
    expect(mockSocket.connect).not.toHaveBeenCalled();
  });

  it("configures exponential backoff reconnection", () => {
    createGameSocket("http://localhost:8201", authToken);
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

  it("trims trailing slash from server url to avoid double slashes", () => {
    createGameSocket("http://localhost:8201/", authToken);
    expect(io).toHaveBeenCalledWith(
      "http://localhost:8201/game",
      expect.any(Object),
    );
  });
});

describe("game-socket — helpers: joinMatch / leaveMatch", () => {
  const matchId = "match-abc";

  beforeEach(() => {
    mockSocket.on.mockReset();
    mockSocket.off.mockReset();
    mockSocket.emit.mockReset();
  });

  it("joinMatch emits game:join-match with the matchId", () => {
    mockSocket.emit.mockImplementation(
      (_event: string, _payload: unknown, ack: (res: { ok: boolean }) => void) => {
        ack({ ok: true });
      },
    );

    const { joinMatch } = createGameSocketHelpers(mockSocket as any);
    joinMatch(matchId);

    expect(mockSocket.emit).toHaveBeenCalledWith(
      "game:join-match",
      { matchId },
      expect.any(Function),
    );
  });

  it("joinMatch resolves with the server ack payload", async () => {
    mockSocket.emit.mockImplementation(
      (_event: string, _payload: unknown, ack: (res: { ok: boolean; error?: string }) => void) => {
        ack({ ok: false, error: "forbidden" });
      },
    );

    const { joinMatch } = createGameSocketHelpers(mockSocket as any);
    const res = await joinMatch(matchId);

    expect(res.ok).toBe(false);
    expect(res.error).toBe("forbidden");
  });

  it("leaveMatch emits game:leave-match with the matchId", () => {
    const { leaveMatch } = createGameSocketHelpers(mockSocket as any);
    leaveMatch(matchId);

    expect(mockSocket.emit).toHaveBeenCalledWith(
      "game:leave-match",
      { matchId },
      expect.any(Function),
    );
  });
});

describe("game-socket — helpers: event subscriptions", () => {
  beforeEach(() => {
    mockSocket.on.mockReset();
    mockSocket.off.mockReset();
  });

  it("onStateUpdated registers listener for game:state-updated", () => {
    const handler = vi.fn();
    const { onStateUpdated } = createGameSocketHelpers(mockSocket as any);
    onStateUpdated(handler);
    expect(mockSocket.on).toHaveBeenCalledWith("game:state-updated", handler);
  });

  it("onPlayerConnected registers listener for game:player-connected", () => {
    const handler = vi.fn();
    const { onPlayerConnected } = createGameSocketHelpers(mockSocket as any);
    onPlayerConnected(handler);
    expect(mockSocket.on).toHaveBeenCalledWith("game:player-connected", handler);
  });

  it("onPlayerDisconnected registers listener for game:player-disconnected", () => {
    const handler = vi.fn();
    const { onPlayerDisconnected } = createGameSocketHelpers(mockSocket as any);
    onPlayerDisconnected(handler);
    expect(mockSocket.on).toHaveBeenCalledWith(
      "game:player-disconnected",
      handler,
    );
  });

  it("onMatchEnded registers listener for game:match-ended", () => {
    const handler = vi.fn();
    const { onMatchEnded } = createGameSocketHelpers(mockSocket as any);
    onMatchEnded(handler);
    expect(mockSocket.on).toHaveBeenCalledWith("game:match-ended", handler);
  });

  it("onMatchForfeited registers listener for game:match-forfeited", () => {
    const handler = vi.fn();
    const { onMatchForfeited } = createGameSocketHelpers(mockSocket as any);
    onMatchForfeited(handler);
    expect(mockSocket.on).toHaveBeenCalledWith("game:match-forfeited", handler);
  });

  it("onTurnTimerStarted registers listener for game:turn-timer-started", () => {
    const handler = vi.fn();
    const { onTurnTimerStarted } = createGameSocketHelpers(mockSocket as any);
    onTurnTimerStarted(handler);
    expect(mockSocket.on).toHaveBeenCalledWith(
      "game:turn-timer-started",
      handler,
    );
  });

  it("cleanup removes all game event listeners", () => {
    const { cleanup } = createGameSocketHelpers(mockSocket as any);
    cleanup();
    expect(mockSocket.off).toHaveBeenCalledWith("game:state-updated");
    expect(mockSocket.off).toHaveBeenCalledWith("game:player-connected");
    expect(mockSocket.off).toHaveBeenCalledWith("game:player-disconnected");
    expect(mockSocket.off).toHaveBeenCalledWith("game:match-ended");
    expect(mockSocket.off).toHaveBeenCalledWith("game:match-forfeited");
    expect(mockSocket.off).toHaveBeenCalledWith("game:turn-timer-started");
  });
});

describe("game-socket — helpers: submitMove", () => {
  beforeEach(() => {
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
      (_event: string, _payload: unknown, ack: (res: unknown) => void) => {
        ack(ackPayload);
      },
    );

    const { submitMove } = createGameSocketHelpers(mockSocket as any);
    const result = await submitMove("match-1", { type: "END_TURN" } as any);

    expect(mockSocket.emit).toHaveBeenCalledWith(
      "game:submit-move",
      { matchId: "match-1", move: { type: "END_TURN" } },
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
      (_event: string, _payload: unknown, ack: (res: unknown) => void) => {
        ack(errorPayload);
      },
    );

    const { submitMove } = createGameSocketHelpers(mockSocket as any);
    const result = await submitMove("match-2", {
      type: "MOVE",
      playerId: "p1",
      to: { x: 3, y: 4 },
    } as any);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Not your turn");
  });
});

describe("game-socket — helpers: requestResync", () => {
  beforeEach(() => {
    mockSocket.emit.mockReset();
  });

  it("emits game:request-resync with matchId", () => {
    mockSocket.emit.mockImplementation(
      (_event: string, _payload: unknown, ack: (res: unknown) => void) => {
        ack({ success: true, gameState: { turn: 1 } });
      },
    );
    const { requestResync } = createGameSocketHelpers(mockSocket as any);
    requestResync("match-resync");

    expect(mockSocket.emit).toHaveBeenCalledWith(
      "game:request-resync",
      { matchId: "match-resync" },
      expect.any(Function),
    );
  });

  it("resolves with gameState payload on success", async () => {
    const payload = { success: true, gameState: { turn: 3 } };
    mockSocket.emit.mockImplementation(
      (_event: string, _payload: unknown, ack: (res: unknown) => void) => {
        ack(payload);
      },
    );

    const { requestResync } = createGameSocketHelpers(mockSocket as any);
    const result = await requestResync("m");

    expect(result.success).toBe(true);
    expect(result.gameState).toEqual({ turn: 3 });
  });

  it("resolves with error on failure", async () => {
    mockSocket.emit.mockImplementation(
      (_event: string, _payload: unknown, ack: (res: unknown) => void) => {
        ack({ success: false, error: "not found" });
      },
    );

    const { requestResync } = createGameSocketHelpers(mockSocket as any);
    const result = await requestResync("m");

    expect(result.success).toBe(false);
    expect(result.error).toBe("not found");
  });
});
