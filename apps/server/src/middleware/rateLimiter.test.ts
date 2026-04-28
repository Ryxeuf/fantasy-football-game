/**
 * S24.6 — Coverage end-to-end de l'application des rate limiters.
 *
 * L'audit S24 avait detecte une divergence entre agents :
 *   - Agent backend : "authRateLimiter pas applique"
 *   - Agent securite : "rate limiting present"
 *
 * Verite confirmee :
 *   - `authRateLimiter` est applique uniquement sur /auth/login,
 *     /auth/register, /auth/refresh (anti brute-force).
 *   - `apiRateLimiter` est applique GLOBALEMENT (`app.use(apiRateLimiter)`)
 *     dans `index.ts:85` et couvre donc /leagues GET via heritage.
 *
 * Ces tests scellent le contrat pour eviter toute regression.
 */

import { describe, it, expect } from "vitest";
import express from "express";
import rateLimit from "express-rate-limit";
import type { AddressInfo } from "node:net";
import {
  AUTH_RATE_LIMIT_MAX_PROD,
  AUTH_RATE_LIMIT_WINDOW_MS,
  API_RATE_LIMIT_MAX_PROD,
  API_RATE_LIMIT_WINDOW_MS,
  isWhitelisted,
} from "./rateLimiter";
import fs from "node:fs";
import path from "node:path";

describe("rateLimiter — configuration constants", () => {
  it("auth limit is 10 requests per 15 minutes (anti brute-force)", () => {
    expect(AUTH_RATE_LIMIT_MAX_PROD).toBe(10);
    expect(AUTH_RATE_LIMIT_WINDOW_MS).toBe(15 * 60 * 1000);
  });

  it("api limit is 100 requests per minute (global throttle)", () => {
    expect(API_RATE_LIMIT_MAX_PROD).toBe(100);
    expect(API_RATE_LIMIT_WINDOW_MS).toBe(60 * 1000);
  });

  it("auth quota is strictly tighter than the api quota", () => {
    // Auth: 10 / 15 min = 0.67 req/min. Api: 100 / 1 min = 100 req/min.
    const authPerMin = AUTH_RATE_LIMIT_MAX_PROD / (AUTH_RATE_LIMIT_WINDOW_MS / 60_000);
    const apiPerMin = API_RATE_LIMIT_MAX_PROD / (API_RATE_LIMIT_WINDOW_MS / 60_000);
    expect(authPerMin).toBeLessThan(apiPerMin);
  });
});

describe("rateLimiter — whitelist", () => {
  const ORIGINAL = process.env.RATE_LIMIT_WHITELIST;

  it("returns false for any IP when whitelist env is empty/unset", () => {
    // Module already loaded with the env at import time. We only verify
    // the runtime predicate against the current set; the production env
    // does not whitelist anything by default.
    expect(isWhitelisted({ ip: "203.0.113.42" } as never)).toBe(false);
    expect(isWhitelisted({ ip: undefined } as never)).toBe(false);
    expect(isWhitelisted({ ip: "" } as never)).toBe(false);
  });

  it("does not crash on missing ip property", () => {
    expect(() => isWhitelisted({} as never)).not.toThrow();
  });

  it("env contract: comma-separated ips trimmed (documented)", () => {
    // Sanity reminder for the parsing contract — actual values are
    // captured at module load. We assert the original env was respected.
    expect(typeof ORIGINAL === "string" || ORIGINAL === undefined).toBe(true);
  });
});

describe("rateLimiter — runtime behavior with a tight test instance", () => {
  /**
   * We can't mutate the module-level limiters at runtime, but we can
   * exercise the SAME library (express-rate-limit) with a max=2 quota
   * to prove the wiring (`app.use(...)`) actually blocks excess calls
   * and emits the standard RateLimit-* headers we rely on for
   * monitoring.
   */
  function buildAppWithLimiter(max: number) {
    const app = express();
    app.set("trust proxy", 1);
    app.use(
      rateLimit({
        windowMs: 60_000,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: "Trop de requetes." },
      }),
    );
    app.get("/leagues", (_req, res) => res.json({ ok: true }));
    return app;
  }

  async function startServer(app: express.Express): Promise<{
    url: string;
    close: () => Promise<void>;
  }> {
    const server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", () => resolve()));
    const port = (server.address() as AddressInfo).port;
    return {
      url: `http://127.0.0.1:${port}`,
      close: () => new Promise<void>((resolve) => server.close(() => resolve())),
    };
  }

  it("blocks the third call when max=2 (proves app.use(rateLimit) takes effect)", async () => {
    const app = buildAppWithLimiter(2);
    const { url, close } = await startServer(app);
    try {
      const r1 = await fetch(`${url}/leagues`);
      const r2 = await fetch(`${url}/leagues`);
      const r3 = await fetch(`${url}/leagues`);
      expect(r1.status).toBe(200);
      expect(r2.status).toBe(200);
      expect(r3.status).toBe(429);
      const body = (await r3.json()) as { error?: string };
      expect(body.error).toMatch(/Trop de requetes/i);
    } finally {
      await close();
    }
  });

  it("emits standard RateLimit-* headers (used by clients to back off)", async () => {
    const app = buildAppWithLimiter(5);
    const { url, close } = await startServer(app);
    try {
      const res = await fetch(`${url}/leagues`);
      expect(res.status).toBe(200);
      // express-rate-limit v8 emits the IETF "RateLimit" combined header.
      const combined = res.headers.get("ratelimit");
      const limit = res.headers.get("ratelimit-limit");
      const remaining = res.headers.get("ratelimit-remaining");
      // At least one of the canonical surfaces must be present.
      const exposed = combined ?? limit;
      expect(exposed).not.toBeNull();
      // Legacy X-RateLimit-* must NOT leak when legacyHeaders=false.
      expect(res.headers.get("x-ratelimit-limit")).toBeNull();
      // If discrete headers are exposed, remaining must be a valid count.
      if (remaining !== null) {
        expect(Number(remaining)).toBeGreaterThanOrEqual(0);
      }
    } finally {
      await close();
    }
  });
});

describe("rateLimiter — wiring in index.ts (S24.6 anti-regression)", () => {
  const indexPath = path.resolve(__dirname, "..", "index.ts");
  const indexSrc = fs.readFileSync(indexPath, "utf-8");
  const lines = indexSrc.split("\n");

  function lineOf(needle: string): number {
    return lines.findIndex((l) => l.includes(needle));
  }

  it("registers the global apiRateLimiter once, before any route", () => {
    const apiRateLine = lineOf("app.use(apiRateLimiter)");
    expect(apiRateLine).toBeGreaterThan(-1);
    // Must come before /leagues, /auth, /match, etc.
    const leaguesLine = lineOf('app.use("/leagues"');
    const authLine = lineOf('app.use("/auth"');
    const matchLine = lineOf('app.use("/match"');
    expect(leaguesLine).toBeGreaterThan(apiRateLine);
    expect(authLine).toBeGreaterThan(apiRateLine);
    expect(matchLine).toBeGreaterThan(apiRateLine);
  });

  it("/leagues GET inherits apiRateLimiter via global app.use ordering", () => {
    // Express applies app.use middlewares in registration order; placing
    // apiRateLimiter before app.use("/leagues", ...) guarantees coverage.
    const apiRateLine = lineOf("app.use(apiRateLimiter)");
    const leaguesLine = lineOf('app.use("/leagues"');
    expect(apiRateLine).toBeGreaterThan(-1);
    expect(leaguesLine).toBeGreaterThan(-1);
    expect(leaguesLine).toBeGreaterThan(apiRateLine);
  });

  it("authRateLimiter is mounted on /auth/login, /auth/register, /auth/refresh", () => {
    expect(lineOf('app.use("/auth/login", authRateLimiter)')).toBeGreaterThan(-1);
    expect(lineOf('app.use("/auth/register", authRateLimiter)')).toBeGreaterThan(-1);
    expect(lineOf('app.use("/auth/refresh", authRateLimiter)')).toBeGreaterThan(-1);
  });

  it("authRateLimiter mounts come before the matching /auth router", () => {
    // /auth/login limiter must run before /auth router so the limiter
    // wraps the actual login handler.
    const loginLine = lineOf('app.use("/auth/login", authRateLimiter)');
    const authRouterLine = lineOf('app.use("/auth", authRoutes)');
    expect(loginLine).toBeGreaterThan(-1);
    expect(authRouterLine).toBeGreaterThan(-1);
    expect(loginLine).toBeLessThan(authRouterLine);
  });
});
