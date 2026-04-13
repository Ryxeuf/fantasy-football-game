import { describe, it, expect, vi } from "vitest";
import jwt from "jsonwebtoken";
import { authSocket } from "./authSocket";
import { JWT_SECRET } from "../config";

function createMockSocket(auth: Record<string, unknown> = {}) {
  return {
    handshake: { auth },
    data: {} as Record<string, unknown>,
  } as any;
}

describe("authSocket", () => {
  it("calls next() without error when a valid Bearer token is provided", () => {
    const token = jwt.sign({ sub: "user-1", roles: ["user"] }, JWT_SECRET);
    const socket = createMockSocket({ token: `Bearer ${token}` });
    const next = vi.fn();

    authSocket(socket, next);

    expect(next).toHaveBeenCalledWith();
    expect(socket.data.user).toEqual({
      id: "user-1",
      roles: ["user"],
    });
  });

  it("accepts a bare token (without Bearer prefix)", () => {
    const token = jwt.sign({ sub: "user-1", roles: ["admin"] }, JWT_SECRET);
    const socket = createMockSocket({ token });
    const next = vi.fn();

    authSocket(socket, next);

    expect(next).toHaveBeenCalledWith();
    expect(socket.data.user.id).toBe("user-1");
  });

  it("rejects connection when no token is provided", () => {
    const socket = createMockSocket({});
    const next = vi.fn();

    authSocket(socket, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toBe("Authentication required");
  });

  it("rejects connection when token is empty string", () => {
    const socket = createMockSocket({ token: "" });
    const next = vi.fn();

    authSocket(socket, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toBe("Authentication required");
  });

  it("rejects connection when token is not a string", () => {
    const socket = createMockSocket({ token: 12345 });
    const next = vi.fn();

    authSocket(socket, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toBe("Authentication required");
  });

  it("rejects when token is signed with wrong secret", () => {
    const token = jwt.sign({ sub: "user-1" }, "wrong-secret");
    const socket = createMockSocket({ token: `Bearer ${token}` });
    const next = vi.fn();

    authSocket(socket, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toBe("Invalid or expired token");
  });

  it("rejects when token has no sub claim", () => {
    const token = jwt.sign({ roles: ["user"] }, JWT_SECRET);
    const socket = createMockSocket({ token: `Bearer ${token}` });
    const next = vi.fn();

    authSocket(socket, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toBe("Invalid token: missing subject");
  });

  it("normalizes a single role string into an array", () => {
    const token = jwt.sign({ sub: "user-1", role: "admin" }, JWT_SECRET);
    const socket = createMockSocket({ token: `Bearer ${token}` });
    const next = vi.fn();

    authSocket(socket, next);

    expect(next).toHaveBeenCalledWith();
    expect(socket.data.user.roles).toEqual(expect.arrayContaining(["admin"]));
  });

  it("handles token with roles array", () => {
    const token = jwt.sign(
      { sub: "user-1", roles: ["user", "admin"] },
      JWT_SECRET,
    );
    const socket = createMockSocket({ token: `Bearer ${token}` });
    const next = vi.fn();

    authSocket(socket, next);

    expect(next).toHaveBeenCalledWith();
    expect(socket.data.user.roles).toEqual(["user", "admin"]);
  });

  it("rejects an expired token", () => {
    const token = jwt.sign({ sub: "user-1" }, JWT_SECRET, { expiresIn: -1 });
    const socket = createMockSocket({ token: `Bearer ${token}` });
    const next = vi.fn();

    authSocket(socket, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toBe("Invalid or expired token");
  });

  it("rejects Bearer prefix with no actual token", () => {
    const socket = createMockSocket({ token: "Bearer " });
    const next = vi.fn();

    authSocket(socket, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toBe("Authentication required");
  });
});
