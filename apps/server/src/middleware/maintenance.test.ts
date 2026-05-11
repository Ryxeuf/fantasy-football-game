/**
 * Tests pour `maintenanceMode` middleware (Sprint P — Lot P.A.1).
 *
 * Couvre :
 *   - Flag OFF (defaut) : passe au next() sans rien faire.
 *   - Flag ON : 503 + Retry-After + payload JSON.
 *   - Allowlist : /health, /admin, /auth/login etc. passent meme si flag ON.
 *   - Erreur featureFlags lookup : laisse passer (fail-open).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

vi.mock("../services/featureFlags", async () => {
  const actual =
    await vi.importActual<typeof import("../services/featureFlags")>(
      "../services/featureFlags",
    );
  return {
    ...actual,
    isEnabled: vi.fn(),
  };
});

import { isEnabled } from "../services/featureFlags";
import { maintenanceMode } from "./maintenance";

const mockedIsEnabled = vi.mocked(isEnabled);

interface MockRes {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  status: (code: number) => MockRes;
  setHeader: (name: string, value: string) => void;
  json: (payload: unknown) => MockRes;
}

function buildRes(): MockRes {
  const res: MockRes = {
    statusCode: 200,
    headers: {},
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

function buildReq(path: string): Request {
  return { path } as unknown as Request;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("maintenanceMode — Lot P.A.1", () => {
  it("flag OFF : passe au next() sans rien faire", async () => {
    mockedIsEnabled.mockResolvedValueOnce(false);
    const middleware = maintenanceMode();
    const next = vi.fn() as unknown as NextFunction;
    const res = buildRes();
    await middleware(buildReq("/pro-league"), res as unknown as Response, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200);
    expect(res.body).toBeUndefined();
  });

  it("flag ON : 503 + Retry-After + JSON payload", async () => {
    mockedIsEnabled.mockResolvedValueOnce(true);
    const middleware = maintenanceMode();
    const next = vi.fn() as unknown as NextFunction;
    const res = buildRes();
    await middleware(buildReq("/pro-league"), res as unknown as Response, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(503);
    expect(res.headers["Retry-After"]).toBe("3600");
    expect(res.headers["Cache-Control"]).toBe("no-store");
    const body = res.body as { error: string; retryAfterSeconds: number };
    expect(body.error).toBe("maintenance");
    expect(body.retryAfterSeconds).toBe(3600);
  });

  it("allowlist /health : passe meme si flag ON", async () => {
    mockedIsEnabled.mockResolvedValue(true);
    const middleware = maintenanceMode();
    const paths = [
      "/health",
      "/health/live",
      "/health/ready",
      "/admin",
      "/admin/feature-flags",
      "/admin/users/123",
      "/auth/login",
      "/auth/refresh",
      "/auth/me",
      "/auth/logout",
    ];
    for (const path of paths) {
      const next = vi.fn() as unknown as NextFunction;
      const res = buildRes();
      await middleware(buildReq(path), res as unknown as Response, next);
      expect(next, `path=${path}`).toHaveBeenCalledOnce();
      expect(res.statusCode, `path=${path}`).toBe(200);
    }
    // isEnabled n'est meme pas appele puisque la path est allowlist.
    expect(mockedIsEnabled).not.toHaveBeenCalled();
  });

  it("erreur lookup featureFlags : fail-open (laisse passer)", async () => {
    mockedIsEnabled.mockRejectedValueOnce(new Error("DB down"));
    const middleware = maintenanceMode();
    const next = vi.fn() as unknown as NextFunction;
    const res = buildRes();
    await middleware(buildReq("/pro-league"), res as unknown as Response, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200);
  });

  it("path prefix matching : /pro-league/anything bloque, /admin-fake passe pas par allowlist", async () => {
    mockedIsEnabled.mockResolvedValue(true);
    const middleware = maintenanceMode();

    // /pro-league/matches/abc → bloque
    {
      const next = vi.fn() as unknown as NextFunction;
      const res = buildRes();
      await middleware(
        buildReq("/pro-league/matches/abc"),
        res as unknown as Response,
        next,
      );
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(503);
    }

    // /admin-fake (pas /admin/*) → bloque (pas allowlist)
    {
      const next = vi.fn() as unknown as NextFunction;
      const res = buildRes();
      await middleware(
        buildReq("/admin-fake"),
        res as unknown as Response,
        next,
      );
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(503);
    }
  });
});
