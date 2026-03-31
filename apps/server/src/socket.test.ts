import { describe, it, expect, afterEach } from "vitest";
import { createServer, Server as HttpServer } from "node:http";
import { AddressInfo } from "node:net";
import { io as clientIO, Socket as ClientSocket } from "socket.io-client";
import jwt from "jsonwebtoken";
import { setupSocket, getIO, getGameNamespace } from "./socket";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

function createToken(sub = "test-user"): string {
  return jwt.sign({ sub, roles: ["user"] }, JWT_SECRET, { expiresIn: "1h" });
}

let httpServer: HttpServer;
let clientSocket: ClientSocket;

function getServerUrl(server: HttpServer): string {
  const addr = server.address() as AddressInfo;
  return `http://localhost:${addr.port}`;
}

afterEach(async () => {
  if (clientSocket?.connected) {
    clientSocket.disconnect();
  }
  const ioInstance = getIO();
  await ioInstance.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

describe("setupSocket", () => {
  it("attaches socket.io to the HTTP server", () => {
    httpServer = createServer();
    const io = setupSocket(httpServer);
    expect(io).toBeDefined();
    httpServer.listen(0);
  });

  it("creates the /game namespace", () => {
    httpServer = createServer();
    setupSocket(httpServer);
    httpServer.listen(0);

    const ns = getGameNamespace();
    expect(ns.name).toBe("/game");
  });

  it("getIO returns the server instance after setup", () => {
    httpServer = createServer();
    setupSocket(httpServer);
    httpServer.listen(0);

    const io = getIO();
    expect(io).toBeDefined();
  });

  it("accepts a client connection on /game namespace", async () => {
    httpServer = createServer();
    setupSocket(httpServer);
    httpServer.listen(0);

    const url = getServerUrl(httpServer);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Connection timeout")),
        5000,
      );

      clientSocket = clientIO(`${url}/game`, {
        transports: ["websocket"],
        auth: { token: createToken() },
      });

      clientSocket.on("connect", () => {
        clearTimeout(timeout);
        expect(clientSocket.connected).toBe(true);
        resolve();
      });

      clientSocket.on("connect_error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  });

  it("detects client disconnection", async () => {
    httpServer = createServer();
    setupSocket(httpServer);
    httpServer.listen(0);

    const url = getServerUrl(httpServer);
    const gameNs = getGameNamespace();

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Disconnect timeout")),
        5000,
      );

      // Register server-side listener BEFORE client connects
      gameNs.on("connection", (serverSocket) => {
        serverSocket.on("disconnect", () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      clientSocket = clientIO(`${url}/game`, {
        transports: ["websocket"],
        auth: { token: createToken() },
      });

      clientSocket.on("connect", () => {
        clientSocket.disconnect();
      });

      clientSocket.on("connect_error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  });
});
