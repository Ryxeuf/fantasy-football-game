/**
 * S24.3 — Tests des routes /auth/refresh et /auth/logout.
 *
 * Pattern unitaire : prisma mocke + store injecte (InMemoryRefreshTokenStore),
 * req/res faits a la main (idem league.test.ts, authUser.test.ts).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../config", () => ({ JWT_SECRET: "test-secret" }));

vi.mock("../prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
}));

import type { Request, Response } from "express";
import { prisma } from "../prisma";
import {
  handleLogout,
  handleRefresh,
  setRefreshTokenStore,
} from "./auth";
import {
  signRefreshToken,
  signAccessToken,
  REFRESH_TOKEN_TTL_SECONDS,
  verifyRefreshToken,
} from "../services/auth-tokens";
import { InMemoryRefreshTokenStore } from "../services/refresh-token-store";

const mockPrisma = prisma as unknown as {
  user: { findUnique: ReturnType<typeof vi.fn> };
};

function createRes() {
  const res: Partial<Response> & {
    statusCode?: number;
    payload?: unknown;
    sentEmpty?: boolean;
  } = {};
  res.status = vi.fn().mockImplementation((code: number) => {
    res.statusCode = code;
    return res as Response;
  });
  res.json = vi.fn().mockImplementation((body: unknown) => {
    res.payload = body;
    return res as Response;
  });
  res.send = vi.fn().mockImplementation(() => {
    res.sentEmpty = true;
    return res as Response;
  });
  return res as Response & {
    statusCode?: number;
    payload?: unknown;
    sentEmpty?: boolean;
  };
}

function createReq(body: unknown): Request {
  return { body } as Request;
}

describe("Rule: /auth/refresh (S24.3)", () => {
  let store: InMemoryRefreshTokenStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new InMemoryRefreshTokenStore();
    setRefreshTokenStore(store);
  });

  it("returns 400 when refreshToken is missing", async () => {
    const res = createRes();
    await handleRefresh(createReq({}), res);
    expect(res.statusCode).toBe(400);
    expect(res.payload).toEqual({ error: "refreshToken requis" });
  });

  it("returns 401 when the refresh token is malformed", async () => {
    const res = createRes();
    await handleRefresh(createReq({ refreshToken: "not-a-jwt" }), res);
    expect(res.statusCode).toBe(401);
    expect(res.payload).toEqual({ error: "Refresh token invalide" });
  });

  it("returns 401 when the refresh token is signed but jti is unknown", async () => {
    const orphan = signRefreshToken({ sub: "user-1", jti: "never-issued" });
    const res = createRes();
    await handleRefresh(createReq({ refreshToken: orphan }), res);
    expect(res.statusCode).toBe(401);
  });

  it("rejects an access token presented as refresh", async () => {
    const access = signAccessToken({
      sub: "user-1",
      role: "user",
      roles: ["user"],
    });
    const res = createRes();
    await handleRefresh(createReq({ refreshToken: access }), res);
    expect(res.statusCode).toBe(401);
  });

  it("rotates a valid refresh token and issues a new pair (happy path)", async () => {
    const oldRefresh = signRefreshToken({ sub: "user-1", jti: "old-jti" });
    await store.register({
      jti: "old-jti",
      sub: "user-1",
      expiresAt: Math.floor(Date.now() / 1000) + REFRESH_TOKEN_TTL_SECONDS,
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      role: "user",
      roles: ["user"],
      valid: true,
    });

    const res = createRes();
    await handleRefresh(createReq({ refreshToken: oldRefresh }), res);

    expect(res.statusCode).toBeUndefined(); // 200 default
    const payload = res.payload as { token: string; refreshToken: string };
    expect(typeof payload.token).toBe("string");
    expect(typeof payload.refreshToken).toBe("string");
    expect(payload.refreshToken).not.toEqual(oldRefresh);

    expect(await store.isRevoked("old-jti")).toBe(true);
    const newPayload = verifyRefreshToken(payload.refreshToken);
    expect(await store.isActive(newPayload.jti)).toBe(true);
  });

  it("on reuse of a revoked refresh token, returns 401 and revokes ALL user sessions", async () => {
    const stolen = signRefreshToken({ sub: "user-1", jti: "stolen-jti" });
    const expiresAt = Math.floor(Date.now() / 1000) + REFRESH_TOKEN_TTL_SECONDS;
    await store.register({ jti: "stolen-jti", sub: "user-1", expiresAt });
    await store.register({ jti: "other-jti", sub: "user-1", expiresAt });
    await store.revoke("stolen-jti");

    const res = createRes();
    await handleRefresh(createReq({ refreshToken: stolen }), res);

    expect(res.statusCode).toBe(401);
    expect(res.payload).toEqual({ error: "Refresh token reuse detected" });
    expect(await store.isRevoked("other-jti")).toBe(true);
  });

  it("returns 401 and revokes all sessions when user no longer exists", async () => {
    const refresh = signRefreshToken({ sub: "ghost-user", jti: "j1" });
    await store.register({
      jti: "j1",
      sub: "ghost-user",
      expiresAt: Math.floor(Date.now() / 1000) + REFRESH_TOKEN_TTL_SECONDS,
    });
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const res = createRes();
    await handleRefresh(createReq({ refreshToken: refresh }), res);

    expect(res.statusCode).toBe(401);
  });

  it("returns 403 and revokes all sessions when user is disabled (valid=false)", async () => {
    const refresh = signRefreshToken({ sub: "user-1", jti: "j1" });
    await store.register({
      jti: "j1",
      sub: "user-1",
      expiresAt: Math.floor(Date.now() / 1000) + REFRESH_TOKEN_TTL_SECONDS,
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      role: "user",
      roles: ["user"],
      valid: false,
    });

    const res = createRes();
    await handleRefresh(createReq({ refreshToken: refresh }), res);

    expect(res.statusCode).toBe(403);
    expect(await store.isRevoked("j1")).toBe(true);
  });

  it("re-reads roles from prisma so role changes apply on next refresh", async () => {
    const refresh = signRefreshToken({ sub: "user-1", jti: "j1" });
    await store.register({
      jti: "j1",
      sub: "user-1",
      expiresAt: Math.floor(Date.now() / 1000) + REFRESH_TOKEN_TTL_SECONDS,
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      role: "admin",
      roles: ["user", "admin"],
      valid: true,
    });

    const res = createRes();
    await handleRefresh(createReq({ refreshToken: refresh }), res);

    const payload = res.payload as { token: string };
    const decoded = JSON.parse(
      Buffer.from(payload.token.split(".")[1], "base64url").toString("utf8"),
    );
    expect(decoded.roles).toEqual(["user", "admin"]);
    expect(decoded.role).toBe("user");
  });
});

describe("Rule: /auth/logout (S24.3)", () => {
  let store: InMemoryRefreshTokenStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new InMemoryRefreshTokenStore();
    setRefreshTokenStore(store);
  });

  it("returns 204 when no refreshToken is provided (idempotent)", async () => {
    const res = createRes();
    await handleLogout(createReq({}), res);
    expect(res.statusCode).toBe(204);
  });

  it("returns 204 and revokes the jti for a valid refresh token", async () => {
    const refresh = signRefreshToken({ sub: "user-1", jti: "j1" });
    await store.register({
      jti: "j1",
      sub: "user-1",
      expiresAt: Math.floor(Date.now() / 1000) + REFRESH_TOKEN_TTL_SECONDS,
    });
    const res = createRes();
    await handleLogout(createReq({ refreshToken: refresh }), res);
    expect(res.statusCode).toBe(204);
    expect(await store.isRevoked("j1")).toBe(true);
  });

  it("returns 204 silently on a malformed refresh token", async () => {
    const res = createRes();
    await handleLogout(createReq({ refreshToken: "garbage" }), res);
    expect(res.statusCode).toBe(204);
  });

  it("returns 204 on a token whose jti is not registered (no-op revoke)", async () => {
    const refresh = signRefreshToken({ sub: "user-1", jti: "ghost" });
    const res = createRes();
    await handleLogout(createReq({ refreshToken: refresh }), res);
    expect(res.statusCode).toBe(204);
  });
});
