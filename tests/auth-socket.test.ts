import { describe, it, expect, vi, beforeEach } from "vitest";

// We test authSocket as a pure function by mocking its dependencies
// and calling it with a fake socket + next callback.

// Mock jsonwebtoken
vi.mock("jsonwebtoken", () => {
  return {
    default: {
      verify: vi.fn(),
    },
  };
});

import jwt from "jsonwebtoken";
import { authSocket } from "../apps/server/src/middleware/authSocket";

const JWT_SECRET = "dev-secret-change-me";

function createFakeSocket(auth: Record<string, unknown> = {}): any {
  return {
    handshake: { auth },
    data: {},
  };
}

describe("authSocket middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls next() with no error when token is valid", () => {
    const payload = { sub: "user-123", role: "user", roles: ["user"] };
    (jwt.verify as ReturnType<typeof vi.fn>).mockReturnValue(payload);

    const socket = createFakeSocket({ token: "valid-token" });
    const next = vi.fn();

    authSocket(socket, next);

    expect(jwt.verify).toHaveBeenCalledWith("valid-token", JWT_SECRET);
    expect(next).toHaveBeenCalledWith();
    expect(socket.data.user).toEqual({ id: "user-123", roles: ["user"] });
  });

  it("populates socket.data.user with correct id and roles", () => {
    const payload = { sub: "admin-1", role: "admin", roles: ["admin", "user"] };
    (jwt.verify as ReturnType<typeof vi.fn>).mockReturnValue(payload);

    const socket = createFakeSocket({ token: "admin-token" });
    const next = vi.fn();

    authSocket(socket, next);

    expect(socket.data.user.id).toBe("admin-1");
    expect(socket.data.user.roles).toEqual(["admin", "user"]);
  });

  it("normalizes single role string to roles array", () => {
    const payload = { sub: "user-2", role: "player" };
    (jwt.verify as ReturnType<typeof vi.fn>).mockReturnValue(payload);

    const socket = createFakeSocket({ token: "token" });
    const next = vi.fn();

    authSocket(socket, next);

    expect(socket.data.user.roles).toEqual(["player"]);
  });

  it("rejects when no token is provided", () => {
    const socket = createFakeSocket({});
    const next = vi.fn();

    authSocket(socket, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect((next.mock.calls[0][0] as Error).message).toBe("Authentication required");
    expect(socket.data.user).toBeUndefined();
  });

  it("rejects when token is not a string", () => {
    const socket = createFakeSocket({ token: 12345 });
    const next = vi.fn();

    authSocket(socket, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect((next.mock.calls[0][0] as Error).message).toBe("Authentication required");
  });

  it("rejects when auth object is missing entirely", () => {
    const socket = { handshake: {}, data: {} } as any;
    const next = vi.fn();

    authSocket(socket, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect((next.mock.calls[0][0] as Error).message).toBe("Authentication required");
  });

  it("rejects when jwt.verify throws (invalid token)", () => {
    (jwt.verify as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("jwt malformed");
    });

    const socket = createFakeSocket({ token: "bad-token" });
    const next = vi.fn();

    authSocket(socket, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect((next.mock.calls[0][0] as Error).message).toBe("Invalid or expired token");
  });

  it("rejects when jwt.verify throws for expired token", () => {
    (jwt.verify as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("jwt expired");
    });

    const socket = createFakeSocket({ token: "expired-token" });
    const next = vi.fn();

    authSocket(socket, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect((next.mock.calls[0][0] as Error).message).toBe("Invalid or expired token");
  });

  it("strips Bearer prefix from token", () => {
    const payload = { sub: "user-bearer", role: "user", roles: ["user"] };
    (jwt.verify as ReturnType<typeof vi.fn>).mockReturnValue(payload);

    const socket = createFakeSocket({ token: "Bearer actual-token" });
    const next = vi.fn();

    authSocket(socket, next);

    expect(jwt.verify).toHaveBeenCalledWith("actual-token", JWT_SECRET);
    expect(next).toHaveBeenCalledWith();
    expect(socket.data.user.id).toBe("user-bearer");
  });

  it("rejects token without sub claim", () => {
    const payload = { role: "user", roles: ["user"] }; // no sub
    (jwt.verify as ReturnType<typeof vi.fn>).mockReturnValue(payload);

    const socket = createFakeSocket({ token: "no-sub-token" });
    const next = vi.fn();

    authSocket(socket, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect((next.mock.calls[0][0] as Error).message).toBe("Invalid token: missing subject");
  });

  it("handles empty string token", () => {
    const socket = createFakeSocket({ token: "" });
    const next = vi.fn();

    authSocket(socket, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect((next.mock.calls[0][0] as Error).message).toBe("Authentication required");
  });

  it("handles Bearer with empty token after prefix", () => {
    const socket = createFakeSocket({ token: "Bearer " });
    const next = vi.fn();

    authSocket(socket, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect((next.mock.calls[0][0] as Error).message).toBe("Authentication required");
  });
});
