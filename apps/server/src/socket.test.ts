import { describe, it, expect, afterAll, afterEach, beforeAll } from "vitest";
import { createServer, Server as HttpServer } from "node:http";
import jwt from "jsonwebtoken";
import { io as ioClient, Socket as ClientSocket } from "socket.io-client";
import { initSocketIO, getIO, emitGameStateUpdate, emitTurnChange, emitMatchStatusChange } from "./socket";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const TEST_PORT = 19876;
const WS_URL = `http://localhost:${TEST_PORT}`;

function makeToken(userId: string, roles: string[] = []): string {
  return jwt.sign({ sub: userId, roles }, JWT_SECRET, { expiresIn: "1h" });
}

function connectSocket(token: string): ClientSocket {
  return ioClient(WS_URL, {
    auth: { token },
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
  });
}

function waitForEvent(
  socket: ClientSocket,
  event: string,
  timeoutMs = 3000,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout waiting for event: ${event}`)),
      timeoutMs,
    );
    socket.once(event, (data: any) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

describe("Socket.IO Module", () => {
  let httpServer: HttpServer;
  const sockets: ClientSocket[] = [];

  beforeAll(
    () =>
      new Promise<void>((resolve) => {
        httpServer = createServer();
        initSocketIO(httpServer);
        httpServer.listen(TEST_PORT, resolve);
      }),
  );

  afterEach(() => {
    for (const s of sockets) {
      if (s.connected) s.disconnect();
    }
    sockets.length = 0;
  });

  afterAll(
    () =>
      new Promise<void>((resolve) => {
        const io = getIO();
        if (io) io.close();
        httpServer.close(() => resolve());
      }),
  );

  it("getIO() returns the server instance after init", () => {
    const io = getIO();
    expect(io).not.toBeNull();
  });

  it("authenticates connections with valid JWT", async () => {
    const token = makeToken("user-1");
    const socket = connectSocket(token);
    sockets.push(socket);

    await new Promise<void>((resolve, reject) => {
      socket.on("connect", () => resolve());
      socket.on("connect_error", reject);
    });

    expect(socket.connected).toBe(true);
  });

  it("rejects connections without token", async () => {
    const socket = ioClient(WS_URL, {
      auth: {},
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
    });
    sockets.push(socket);

    const err = await new Promise<Error>((resolve) => {
      socket.on("connect_error", (e) => resolve(e));
    });

    expect(err.message).toContain("Authentication required");
    expect(socket.connected).toBe(false);
  });

  it("rejects connections with invalid JWT", async () => {
    const socket = connectSocket("bad-token");
    sockets.push(socket);

    const err = await new Promise<Error>((resolve) => {
      socket.on("connect_error", (e) => resolve(e));
    });

    expect(err.message).toContain("Invalid token");
  });

  it("emitGameStateUpdate broadcasts to match room", async () => {
    const token = makeToken("user-2");
    const socket = connectSocket(token);
    sockets.push(socket);

    await new Promise<void>((resolve, reject) => {
      socket.on("connect", () => resolve());
      socket.on("connect_error", reject);
    });

    // Join match room
    socket.emit("match:join", "match-42");
    await new Promise((r) => setTimeout(r, 100));

    // Emit state update
    const statePromise = waitForEvent(socket, "game:state-update");
    emitGameStateUpdate("match-42", { turn: 1, half: 1 }, 5);
    const data = await statePromise;

    expect(data.matchId).toBe("match-42");
    expect(data.gameState).toEqual({ turn: 1, half: 1 });
    expect(data.moveCount).toBe(5);
  });

  it("emitTurnChange broadcasts to match room", async () => {
    const token = makeToken("user-3");
    const socket = connectSocket(token);
    sockets.push(socket);

    await new Promise<void>((resolve, reject) => {
      socket.on("connect", () => resolve());
      socket.on("connect_error", reject);
    });

    socket.emit("match:join", "match-43");
    await new Promise((r) => setTimeout(r, 100));

    const eventPromise = waitForEvent(socket, "game:turn-change");
    emitTurnChange("match-43", "B", "user-99");
    const data = await eventPromise;

    expect(data.matchId).toBe("match-43");
    expect(data.currentTeam).toBe("B");
    expect(data.currentUserId).toBe("user-99");
  });

  it("emitMatchStatusChange broadcasts to match room", async () => {
    const token = makeToken("user-4");
    const socket = connectSocket(token);
    sockets.push(socket);

    await new Promise<void>((resolve, reject) => {
      socket.on("connect", () => resolve());
      socket.on("connect_error", reject);
    });

    socket.emit("match:join", "match-44");
    await new Promise((r) => setTimeout(r, 100));

    const eventPromise = waitForEvent(socket, "game:match-status");
    emitMatchStatusChange("match-44", "ended");
    const data = await eventPromise;

    expect(data.matchId).toBe("match-44");
    expect(data.status).toBe("ended");
  });

  it("does not receive events for rooms not joined", async () => {
    const token = makeToken("user-5");
    const socket = connectSocket(token);
    sockets.push(socket);

    await new Promise<void>((resolve, reject) => {
      socket.on("connect", () => resolve());
      socket.on("connect_error", reject);
    });

    // Join match-50 but NOT match-51
    socket.emit("match:join", "match-50");
    await new Promise((r) => setTimeout(r, 100));

    let received = false;
    socket.on("game:state-update", () => {
      received = true;
    });

    // Emit to match-51 (not joined)
    emitGameStateUpdate("match-51", { turn: 1 }, 1);
    await new Promise((r) => setTimeout(r, 200));

    expect(received).toBe(false);
  });

  it("stops receiving events after leaving room", async () => {
    const token = makeToken("user-6");
    const socket = connectSocket(token);
    sockets.push(socket);

    await new Promise<void>((resolve, reject) => {
      socket.on("connect", () => resolve());
      socket.on("connect_error", reject);
    });

    socket.emit("match:join", "match-60");
    await new Promise((r) => setTimeout(r, 100));

    // Verify receiving first
    const firstPromise = waitForEvent(socket, "game:state-update");
    emitGameStateUpdate("match-60", { turn: 1 }, 1);
    await firstPromise;

    // Leave room
    socket.emit("match:leave", "match-60");
    await new Promise((r) => setTimeout(r, 100));

    // Should not receive anymore
    let received = false;
    socket.on("game:state-update", () => {
      received = true;
    });
    emitGameStateUpdate("match-60", { turn: 2 }, 2);
    await new Promise((r) => setTimeout(r, 200));

    expect(received).toBe(false);
  });
});
