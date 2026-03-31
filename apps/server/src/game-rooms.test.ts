import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { createServer, Server as HttpServer } from "node:http";
import { AddressInfo } from "node:net";
import { io as clientIO, Socket as ClientSocket } from "socket.io-client";
import jwt from "jsonwebtoken";
import { setupSocket, getIO, getGameNamespace } from "./socket";
import {
  registerGameRoomHandlers,
  getRoomSize,
  getActiveRooms,
  resetRooms,
} from "./game-rooms";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

function createToken(sub = "test-user"): string {
  return jwt.sign({ sub, roles: ["user"] }, JWT_SECRET, { expiresIn: "1h" });
}

let httpServer: HttpServer;
let clientA: ClientSocket;
let clientB: ClientSocket;

function getServerUrl(server: HttpServer): string {
  const addr = server.address() as AddressInfo;
  return `http://localhost:${addr.port}`;
}

function connectClient(url: string, sub?: string): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Connection timeout")),
      5000,
    );
    const client = clientIO(`${url}/game`, {
      transports: ["websocket"],
      auth: { token: createToken(sub) },
    });
    client.on("connect", () => {
      clearTimeout(timeout);
      resolve(client);
    });
    client.on("connect_error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

function emitWithAck(
  client: ClientSocket,
  event: string,
  payload: unknown,
): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Ack timeout for ${event}`)),
      5000,
    );
    client.emit(event, payload, (response: { ok: boolean; error?: string }) => {
      clearTimeout(timeout);
      resolve(response);
    });
  });
}

beforeEach(() => {
  resetRooms();
});

afterEach(async () => {
  if (clientA?.connected) clientA.disconnect();
  if (clientB?.connected) clientB.disconnect();
  const ioInstance = getIO();
  await ioInstance.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  resetRooms();
});

describe("game-rooms", () => {
  function setupServer(): string {
    httpServer = createServer();
    setupSocket(httpServer);
    registerGameRoomHandlers(getGameNamespace());
    httpServer.listen(0);
    return getServerUrl(httpServer);
  }

  it("joins a match room and acknowledges success", async () => {
    const url = setupServer();
    clientA = await connectClient(url);

    const ack = await emitWithAck(clientA, "game:join-match", {
      matchId: "match-123",
    });

    expect(ack.ok).toBe(true);
    expect(getRoomSize("match-123")).toBe(1);
  });

  it("rejects join without matchId", async () => {
    const url = setupServer();
    clientA = await connectClient(url);

    const ack = await emitWithAck(clientA, "game:join-match", {});

    expect(ack.ok).toBe(false);
    expect(ack.error).toBe("matchId is required");
  });

  it("rejects join with non-string matchId", async () => {
    const url = setupServer();
    clientA = await connectClient(url);

    const ack = await emitWithAck(clientA, "game:join-match", {
      matchId: 42,
    });

    expect(ack.ok).toBe(false);
    expect(ack.error).toBe("matchId is required");
  });

  it("two clients can join the same room", async () => {
    const url = setupServer();
    clientA = await connectClient(url);
    clientB = await connectClient(url);

    await emitWithAck(clientA, "game:join-match", { matchId: "match-456" });
    await emitWithAck(clientB, "game:join-match", { matchId: "match-456" });

    expect(getRoomSize("match-456")).toBe(2);
  });

  it("notifies existing room members when a new player connects", async () => {
    const url = setupServer();
    clientA = await connectClient(url);
    await emitWithAck(clientA, "game:join-match", { matchId: "match-789" });

    const notificationPromise = new Promise<{
      matchId: string;
      connectedSockets: number;
    }>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Notification timeout")),
        5000,
      );
      clientA.on("game:player-connected", (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });

    clientB = await connectClient(url);
    await emitWithAck(clientB, "game:join-match", { matchId: "match-789" });

    const notification = await notificationPromise;
    expect(notification.matchId).toBe("match-789");
    expect(notification.connectedSockets).toBe(2);
  });

  it("leaves a match room on game:leave-match", async () => {
    const url = setupServer();
    clientA = await connectClient(url);
    await emitWithAck(clientA, "game:join-match", { matchId: "match-abc" });
    expect(getRoomSize("match-abc")).toBe(1);

    const ack = await emitWithAck(clientA, "game:leave-match", {
      matchId: "match-abc",
    });

    expect(ack.ok).toBe(true);
    expect(getRoomSize("match-abc")).toBe(0);
  });

  it("cleans up room on disconnect", async () => {
    const url = setupServer();
    clientA = await connectClient(url);
    await emitWithAck(clientA, "game:join-match", { matchId: "match-dc" });
    expect(getRoomSize("match-dc")).toBe(1);

    clientA.disconnect();

    // Wait for server-side disconnect handler
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(getRoomSize("match-dc")).toBe(0);
    expect(getActiveRooms()).not.toContain("match-dc");
  });

  it("switching rooms leaves the previous room", async () => {
    const url = setupServer();
    clientA = await connectClient(url);

    await emitWithAck(clientA, "game:join-match", { matchId: "room-1" });
    expect(getRoomSize("room-1")).toBe(1);

    await emitWithAck(clientA, "game:join-match", { matchId: "room-2" });
    expect(getRoomSize("room-1")).toBe(0);
    expect(getRoomSize("room-2")).toBe(1);
  });

  it("notifies remaining members when a player disconnects", async () => {
    const url = setupServer();
    clientA = await connectClient(url);
    clientB = await connectClient(url);

    await emitWithAck(clientA, "game:join-match", { matchId: "match-notify" });
    await emitWithAck(clientB, "game:join-match", { matchId: "match-notify" });

    const notificationPromise = new Promise<{
      matchId: string;
      connectedSockets: number;
    }>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Notification timeout")),
        5000,
      );
      clientA.on("game:player-disconnected", (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });

    clientB.disconnect();

    const notification = await notificationPromise;
    expect(notification.matchId).toBe("match-notify");
    expect(notification.connectedSockets).toBe(1);
  });

  it("getActiveRooms returns all rooms with connected sockets", async () => {
    const url = setupServer();
    clientA = await connectClient(url);
    clientB = await connectClient(url);

    await emitWithAck(clientA, "game:join-match", { matchId: "room-x" });
    await emitWithAck(clientB, "game:join-match", { matchId: "room-y" });

    const rooms = getActiveRooms();
    expect(rooms).toContain("room-x");
    expect(rooms).toContain("room-y");
    expect(rooms).toHaveLength(2);
  });
});
