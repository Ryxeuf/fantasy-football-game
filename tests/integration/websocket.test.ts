import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import fetch from "node-fetch";
import { io as ioClient, Socket as ClientSocket } from "socket.io-client";

const API_PORT = process.env.API_PORT || "18001";
const API_BASE = `http://localhost:${API_PORT}`;
const WS_URL = `http://localhost:${API_PORT}`;

async function registerAndGetToken(suffix: string): Promise<string> {
  const email = `ws_test_${suffix}_${Date.now()}@example.com`;
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "test1234", name: `WS_${suffix}` }),
  });
  const body: any = await res.json();
  return body.token;
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
  timeoutMs = 5000,
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

describe("WebSocket Integration", () => {
  const sockets: ClientSocket[] = [];

  afterEach(() => {
    for (const s of sockets) {
      if (s.connected) s.disconnect();
    }
    sockets.length = 0;
  });

  it("should connect with valid JWT token", async () => {
    const token = await registerAndGetToken("connect");
    const socket = connectSocket(token);
    sockets.push(socket);

    await new Promise<void>((resolve, reject) => {
      socket.on("connect", () => resolve());
      socket.on("connect_error", (err) => reject(err));
    });

    expect(socket.connected).toBe(true);
  }, 15000);

  it("should reject connection without token", async () => {
    const socket = ioClient(WS_URL, {
      auth: {},
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
    });
    sockets.push(socket);

    await new Promise<void>((resolve) => {
      socket.on("connect", () => {
        resolve(); // Should not happen
      });
      socket.on("connect_error", (err) => {
        expect(err.message).toContain("Authentication required");
        resolve();
      });
    });

    expect(socket.connected).toBe(false);
  }, 15000);

  it("should reject connection with invalid token", async () => {
    const socket = connectSocket("invalid-token-xyz");
    sockets.push(socket);

    await new Promise<void>((resolve) => {
      socket.on("connect", () => {
        resolve();
      });
      socket.on("connect_error", (err) => {
        expect(err.message).toContain("Invalid token");
        resolve();
      });
    });

    expect(socket.connected).toBe(false);
  }, 15000);

  it("should allow joining and leaving match rooms", async () => {
    const token = await registerAndGetToken("rooms");
    const socket = connectSocket(token);
    sockets.push(socket);

    await new Promise<void>((resolve, reject) => {
      socket.on("connect", () => resolve());
      socket.on("connect_error", (err) => reject(err));
    });

    // Join a match room - should not throw
    socket.emit("match:join", "test-match-id");
    // Leave a match room - should not throw
    socket.emit("match:leave", "test-match-id");

    // Give time for events to process
    await new Promise((r) => setTimeout(r, 200));
    expect(socket.connected).toBe(true);
  }, 15000);

  it("should ignore invalid match:join payloads", async () => {
    const token = await registerAndGetToken("invalid");
    const socket = connectSocket(token);
    sockets.push(socket);

    await new Promise<void>((resolve, reject) => {
      socket.on("connect", () => resolve());
      socket.on("connect_error", (err) => reject(err));
    });

    // Should not crash with invalid payloads
    socket.emit("match:join", null);
    socket.emit("match:join", 123);
    socket.emit("match:join", "");

    await new Promise((r) => setTimeout(r, 200));
    expect(socket.connected).toBe(true);
  }, 15000);
});
