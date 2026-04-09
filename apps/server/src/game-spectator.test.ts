import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { createServer, Server as HttpServer } from "node:http";
import { AddressInfo } from "node:net";
import { io as clientIO, Socket as ClientSocket } from "socket.io-client";
import { setupSocket, getIO, getGameNamespace } from "./socket";
import {
  registerGameRoomHandlers,
  getRoomSize,
  resetRooms,
} from "./game-rooms";
import {
  registerSpectatorHandlers,
  getSpectatorCount,
  resetSpectators,
} from "./game-spectator";

let httpServer: HttpServer;
let clientA: ClientSocket;
let clientB: ClientSocket;
let clientSpec: ClientSocket;

function getServerUrl(server: HttpServer): string {
  const addr = server.address() as AddressInfo;
  return `http://localhost:${addr.port}`;
}

function connectClient(url: string): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Connection timeout")),
      5000,
    );
    const client = clientIO(`${url}/game`, { transports: ["websocket"] });
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
  resetSpectators();
});

afterEach(async () => {
  if (clientA?.connected) clientA.disconnect();
  if (clientB?.connected) clientB.disconnect();
  if (clientSpec?.connected) clientSpec.disconnect();
  const ioInstance = getIO();
  await ioInstance.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  resetRooms();
  resetSpectators();
});

describe("game-spectator", () => {
  function setupServer(): string {
    httpServer = createServer();
    setupSocket(httpServer);
    const ns = getGameNamespace();
    registerGameRoomHandlers(ns);
    registerSpectatorHandlers(ns);
    httpServer.listen(0);
    return getServerUrl(httpServer);
  }

  it("spectator joins a match room and receives ack", async () => {
    const url = setupServer();
    clientSpec = await connectClient(url);

    const ack = await emitWithAck(clientSpec, "game:spectate-match", {
      matchId: "match-123",
    });

    expect(ack.ok).toBe(true);
    expect(getSpectatorCount("match-123")).toBe(1);
  });

  it("rejects spectate without matchId", async () => {
    const url = setupServer();
    clientSpec = await connectClient(url);

    const ack = await emitWithAck(clientSpec, "game:spectate-match", {});

    expect(ack.ok).toBe(false);
    expect(ack.error).toBe("matchId is required");
  });

  it("spectator receives game state updates broadcast to the room", async () => {
    const url = setupServer();
    clientA = await connectClient(url);
    clientSpec = await connectClient(url);

    // Player joins the room
    await emitWithAck(clientA, "game:join-match", { matchId: "match-456" });
    // Spectator joins as spectator
    await emitWithAck(clientSpec, "game:spectate-match", {
      matchId: "match-456",
    });

    // Listen for state updates on spectator
    const updatePromise = new Promise<{ matchId: string; gameState: unknown }>(
      (resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("Update timeout")),
          5000,
        );
        clientSpec.on("game:state-updated", (data) => {
          clearTimeout(timeout);
          resolve(data);
        });
      },
    );

    // Simulate a broadcast from server (emit to room)
    const ns = getGameNamespace();
    ns.to("match-456").emit("game:state-updated", {
      matchId: "match-456",
      gameState: { test: true },
      move: null,
      userId: "player-1",
      timestamp: new Date().toISOString(),
    });

    const update = await updatePromise;
    expect(update.matchId).toBe("match-456");
    expect(update.gameState).toEqual({ test: true });
  });

  it("spectator cannot submit moves", async () => {
    const url = setupServer();
    clientSpec = await connectClient(url);

    await emitWithAck(clientSpec, "game:spectate-match", {
      matchId: "match-789",
    });

    // Try to submit a move — should be rejected or simply not processed
    const ack = await emitWithAck(clientSpec, "game:submit-move", {
      matchId: "match-789",
      move: { type: "END_TURN" },
    });

    // Move submission requires auth, spectator socket may not have user data
    // so it should be rejected
    expect(ack.ok).toBe(false);
  });

  it("multiple spectators can join the same match", async () => {
    const url = setupServer();
    clientA = await connectClient(url);
    clientB = await connectClient(url);

    await emitWithAck(clientA, "game:spectate-match", {
      matchId: "match-multi",
    });
    await emitWithAck(clientB, "game:spectate-match", {
      matchId: "match-multi",
    });

    expect(getSpectatorCount("match-multi")).toBe(2);
  });

  it("spectator leaving decrements count", async () => {
    const url = setupServer();
    clientSpec = await connectClient(url);

    await emitWithAck(clientSpec, "game:spectate-match", {
      matchId: "match-leave",
    });
    expect(getSpectatorCount("match-leave")).toBe(1);

    await emitWithAck(clientSpec, "game:leave-spectate", {
      matchId: "match-leave",
    });
    expect(getSpectatorCount("match-leave")).toBe(0);
  });

  it("spectator disconnect cleans up tracking", async () => {
    const url = setupServer();
    clientSpec = await connectClient(url);

    await emitWithAck(clientSpec, "game:spectate-match", {
      matchId: "match-dc",
    });
    expect(getSpectatorCount("match-dc")).toBe(1);

    clientSpec.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(getSpectatorCount("match-dc")).toBe(0);
  });

  it("spectator does not trigger forfeit timer on disconnect", async () => {
    const url = setupServer();
    clientA = await connectClient(url);
    clientSpec = await connectClient(url);

    // Player joins
    await emitWithAck(clientA, "game:join-match", {
      matchId: "match-forfeit",
    });
    // Spectator joins
    await emitWithAck(clientSpec, "game:spectate-match", {
      matchId: "match-forfeit",
    });

    // Listen for player-disconnected on player's socket
    const disconnectPromise = new Promise<void>((resolve) => {
      const timeout = setTimeout(() => resolve(), 500);
      clientA.on("game:player-disconnected", () => {
        // This should NOT fire for spectator disconnects
        clearTimeout(timeout);
        throw new Error("Player-disconnected should not fire for spectators");
      });
    });

    clientSpec.disconnect();
    await disconnectPromise;

    // Room should still have 1 player
    expect(getRoomSize("match-forfeit")).toBe(1);
  });

  it("notifies spectators with spectator count updates", async () => {
    const url = setupServer();
    clientA = await connectClient(url);
    clientSpec = await connectClient(url);

    // Player joins the room
    await emitWithAck(clientA, "game:join-match", {
      matchId: "match-count",
    });

    // Spectator joins
    await emitWithAck(clientSpec, "game:spectate-match", {
      matchId: "match-count",
    });

    // Both player and spectator should have received count
    // (The spectator join notifies the room)
    const countPromise = new Promise<{ matchId: string; spectatorCount: number }>(
      (resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("Count timeout")),
          5000,
        );
        clientA.on("game:spectator-count", (data) => {
          clearTimeout(timeout);
          resolve(data);
        });
      },
    );

    // Second spectator joins
    clientB = await connectClient(url);
    await emitWithAck(clientB, "game:spectate-match", {
      matchId: "match-count",
    });

    const countData = await countPromise;
    expect(countData.matchId).toBe("match-count");
    expect(countData.spectatorCount).toBe(2);
  });
});
