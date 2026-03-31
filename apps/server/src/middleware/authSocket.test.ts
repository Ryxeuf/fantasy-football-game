import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { createServer, Server as HttpServer } from "node:http";
import { AddressInfo } from "node:net";
import { io as clientIO, Socket as ClientSocket } from "socket.io-client";
import jwt from "jsonwebtoken";
import { setupSocket, getIO, getGameNamespace } from "../socket";
import { resetRooms } from "../game-rooms";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

let httpServer: HttpServer;
let clientSocket: ClientSocket;

function getServerUrl(server: HttpServer): string {
  const addr = server.address() as AddressInfo;
  return `http://localhost:${addr.port}`;
}

function createToken(payload: {
  sub: string;
  role?: string;
  roles?: string[];
}): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
}

function connectClient(
  url: string,
  auth?: { token: string },
): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Connection timeout")),
      5000,
    );
    const client = clientIO(`${url}/game`, {
      transports: ["websocket"],
      auth,
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

function setupServer(): string {
  httpServer = createServer();
  setupSocket(httpServer);
  httpServer.listen(0);
  return getServerUrl(httpServer);
}

beforeEach(() => {
  resetRooms();
});

afterEach(async () => {
  if (clientSocket?.connected) clientSocket.disconnect();
  const ioInstance = getIO();
  await ioInstance.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  resetRooms();
});

describe("Règle: Authentification WebSocket", () => {
  it("rejects connection without token", async () => {
    const url = setupServer();

    await expect(connectClient(url)).rejects.toThrow();
  });

  it("rejects connection with invalid token", async () => {
    const url = setupServer();

    await expect(
      connectClient(url, { token: "invalid-jwt-token" }),
    ).rejects.toThrow();
  });

  it("rejects connection with expired token", async () => {
    const url = setupServer();
    const expiredToken = jwt.sign({ sub: "user-1" }, JWT_SECRET, {
      expiresIn: "-1s",
    });

    await expect(
      connectClient(url, { token: expiredToken }),
    ).rejects.toThrow();
  });

  it("rejects connection with token signed by wrong secret", async () => {
    const url = setupServer();
    const badToken = jwt.sign({ sub: "user-1" }, "wrong-secret", {
      expiresIn: "1h",
    });

    await expect(
      connectClient(url, { token: badToken }),
    ).rejects.toThrow();
  });

  it("accepts connection with valid token", async () => {
    const url = setupServer();
    const token = createToken({ sub: "user-42", roles: ["user"] });

    clientSocket = await connectClient(url, { token });

    expect(clientSocket.connected).toBe(true);
  });

  it("sets userId on socket.data after authentication", async () => {
    const url = setupServer();
    const token = createToken({ sub: "user-42", roles: ["user"] });

    const userIdPromise = new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Timeout waiting for userId")),
        5000,
      );
      getGameNamespace().on("connection", (socket) => {
        clearTimeout(timeout);
        resolve(socket.data.userId);
      });
    });

    clientSocket = await connectClient(url, { token });

    const userId = await userIdPromise;
    expect(userId).toBe("user-42");
  });

  it("sets roles on socket.data after authentication", async () => {
    const url = setupServer();
    const token = createToken({
      sub: "admin-1",
      role: "admin",
      roles: ["admin", "user"],
    });

    const rolesPromise = new Promise<string[]>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Timeout waiting for roles")),
        5000,
      );
      getGameNamespace().on("connection", (socket) => {
        clearTimeout(timeout);
        resolve(socket.data.roles);
      });
    });

    clientSocket = await connectClient(url, { token });

    const roles = await rolesPromise;
    expect(roles).toEqual(["admin", "user"]);
  });

  it("handles token with single role string", async () => {
    const url = setupServer();
    const token = createToken({ sub: "user-5", role: "user" });

    const rolesPromise = new Promise<string[]>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Timeout")),
        5000,
      );
      getGameNamespace().on("connection", (socket) => {
        clearTimeout(timeout);
        resolve(socket.data.roles);
      });
    });

    clientSocket = await connectClient(url, { token });

    const roles = await rolesPromise;
    expect(roles).toEqual(["user"]);
  });
});
