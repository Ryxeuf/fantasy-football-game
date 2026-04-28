/**
 * S24.3 — Tests de la route /auth/logout.
 *
 * Pattern unitaire : prisma mocke + store injecte (InMemoryRefreshTokenStore),
 * req/res faits a la main (idem league.test.ts, authUser.test.ts).
 *
 * NOTE: Les tests de /auth/refresh vivent dans auth-refresh.test.ts (S24.3d).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../config", () => ({ JWT_SECRET: "test-secret" }));

vi.mock("../prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
}));

import type { Request, Response } from "express";
import { handleLogout, setRefreshTokenStore } from "./auth";
import {
  signRefreshToken,
  REFRESH_TOKEN_TTL_SECONDS,
} from "../services/auth-tokens";
import { InMemoryRefreshTokenStore } from "../services/refresh-token-store";

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
