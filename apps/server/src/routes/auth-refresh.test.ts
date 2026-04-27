/**
 * S24.3d — Endpoint POST /auth/refresh.
 *
 * Le handler est unitaire : on mocke rotateRefreshToken (du store-rotation
 * helper), prisma.user.findUnique et signAccessToken. req/res faits a la main
 * comme league.test.ts / authUser.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/refresh-token-store", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../services/refresh-token-store")>();
  return {
    ...actual,
    rotateRefreshToken: vi.fn(),
  };
});

vi.mock("../services/prisma-refresh-token-store", () => ({
  PrismaRefreshTokenStore: class {},
}));

vi.mock("../services/auth-tokens", async () => {
  const actual =
    await vi.importActual<typeof import("../services/auth-tokens")>(
      "../services/auth-tokens",
    );
  return {
    ...actual,
    signAccessToken: vi.fn(() => "signed-access-token"),
  };
});

vi.mock("../prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import type { Request, Response } from "express";
import {
  rotateRefreshToken,
  RefreshTokenReuseError,
  type RefreshTokenStore,
} from "../services/refresh-token-store";
import { signAccessToken } from "../services/auth-tokens";
import { prisma } from "../prisma";
import { handleRefreshToken } from "./auth-refresh";

const mockRotate = rotateRefreshToken as unknown as ReturnType<typeof vi.fn>;
const mockSignAccess = signAccessToken as unknown as ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as {
  user: { findUnique: ReturnType<typeof vi.fn> };
};

function makeRes() {
  const res: Partial<Response> & {
    statusCode: number;
    body: unknown;
  } = {
    statusCode: 200,
    body: undefined,
  };
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res as Response;
  }) as unknown as Response["status"];
  res.json = vi.fn((b: unknown) => {
    res.body = b;
    return res as Response;
  }) as unknown as Response["json"];
  return res as Response & { statusCode: number; body: unknown };
}

const stubStore: RefreshTokenStore = {} as RefreshTokenStore;

describe("Rule: POST /auth/refresh handler (S24.3d)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignAccess.mockReturnValue("signed-access-token");
  });

  it("400 when refreshToken is missing", async () => {
    const req = { body: {} } as Request;
    const res = makeRes();

    await handleRefreshToken(stubStore)(req, res);

    expect(res.statusCode).toBe(400);
    expect(mockRotate).not.toHaveBeenCalled();
  });

  it("rotates the token, loads the user, and returns access + refresh + expiresIn", async () => {
    mockRotate.mockResolvedValue({
      token: "new-refresh-token",
      payload: { jti: "new-jti", sub: "user-1", typ: "refresh", iat: 0, exp: 0 },
      sub: "user-1",
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      role: "user",
      roles: ["user"],
      valid: true,
    });

    const req = { body: { refreshToken: "old-rt" } } as Request;
    const res = makeRes();

    await handleRefreshToken(stubStore)(req, res);

    expect(mockRotate).toHaveBeenCalledWith("old-rt", stubStore);
    expect(mockSignAccess).toHaveBeenCalledTimes(1);
    const signedClaims = mockSignAccess.mock.calls[0][0];
    expect(signedClaims).toEqual(
      expect.objectContaining({ sub: "user-1", role: "user", roles: ["user"] }),
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      token: "signed-access-token",
      refreshToken: "new-refresh-token",
      expiresIn: 15 * 60,
    });
  });

  it("401 when rotateRefreshToken signals reuse", async () => {
    mockRotate.mockRejectedValue(new RefreshTokenReuseError("reuse"));

    const req = { body: { refreshToken: "stolen" } } as Request;
    const res = makeRes();

    await handleRefreshToken(stubStore)(req, res);

    expect(res.statusCode).toBe(401);
    const body = res.body as { error: string; reuseDetected?: boolean };
    expect(body.reuseDetected).toBe(true);
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("401 on any other rotation failure (invalid token, expired, etc.)", async () => {
    mockRotate.mockRejectedValue(new Error("jwt expired"));

    const req = { body: { refreshToken: "bad" } } as Request;
    const res = makeRes();

    await handleRefreshToken(stubStore)(req, res);

    expect(res.statusCode).toBe(401);
  });

  it("404 when the user no longer exists", async () => {
    mockRotate.mockResolvedValue({
      token: "new-rt",
      payload: { jti: "j", sub: "ghost", typ: "refresh", iat: 0, exp: 0 },
      sub: "ghost",
    });
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const req = { body: { refreshToken: "rt" } } as Request;
    const res = makeRes();

    await handleRefreshToken(stubStore)(req, res);

    expect(res.statusCode).toBe(404);
  });

  it("403 when the user account is invalidated", async () => {
    mockRotate.mockResolvedValue({
      token: "new-rt",
      payload: { jti: "j", sub: "u", typ: "refresh", iat: 0, exp: 0 },
      sub: "u",
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u",
      role: "user",
      roles: ["user"],
      valid: false,
    });

    const req = { body: { refreshToken: "rt" } } as Request;
    const res = makeRes();

    await handleRefreshToken(stubStore)(req, res);

    expect(res.statusCode).toBe(403);
  });

  it("falls back to legacy `role` field when `roles` is undefined", async () => {
    mockRotate.mockResolvedValue({
      token: "new-rt",
      payload: { jti: "j", sub: "u", typ: "refresh", iat: 0, exp: 0 },
      sub: "u",
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u",
      role: "admin",
      // roles intentionally undefined — legacy SQLite users have only `role`
      valid: true,
    });

    const req = { body: { refreshToken: "rt" } } as Request;
    const res = makeRes();

    await handleRefreshToken(stubStore)(req, res);

    expect(res.statusCode).toBe(200);
    const claims = mockSignAccess.mock.calls[0][0];
    expect(claims.roles).toEqual(["admin"]);
    expect(claims.role).toBe("admin");
  });
});
