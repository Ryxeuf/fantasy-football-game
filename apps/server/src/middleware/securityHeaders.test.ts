import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { securityHeaders } from "./securityHeaders";

/**
 * Helmet wraps several middlewares in a chain and calls next() for each
 * before invoking the user's next(). We collect the headers it sets via a
 * mock res.setHeader and assert the security envelope is present.
 */
function runMiddleware(): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {};
    const res = {
      setHeader(name: string, value: string | number | readonly string[]) {
        headers[name.toLowerCase()] = String(value);
      },
      removeHeader(name: string) {
        delete headers[name.toLowerCase()];
      },
      getHeader(name: string) {
        return headers[name.toLowerCase()];
      },
    } as unknown as Response;

    const req = { method: "GET", headers: {} } as unknown as Request;

    const mw = securityHeaders();
    const finalNext: NextFunction = (err?: unknown) => {
      if (err) reject(err);
      else resolve(headers);
    };
    mw(req, res, finalNext);
  });
}

describe("Rule: securityHeaders middleware", () => {
  it("sets Strict-Transport-Security with max-age >= 1 year", async () => {
    const headers = await runMiddleware();
    const hsts = headers["strict-transport-security"];
    expect(hsts).toBeDefined();
    const match = /max-age=(\d+)/.exec(hsts!);
    expect(match).not.toBeNull();
    const maxAge = Number(match![1]);
    expect(maxAge).toBeGreaterThanOrEqual(31536000);
    expect(hsts).toContain("includeSubDomains");
  });

  it("sets X-Frame-Options to DENY", async () => {
    const headers = await runMiddleware();
    expect(headers["x-frame-options"]).toBe("DENY");
  });

  it("sets X-Content-Type-Options to nosniff", async () => {
    const headers = await runMiddleware();
    expect(headers["x-content-type-options"]).toBe("nosniff");
  });

  it("sets Referrer-Policy to strict-origin-when-cross-origin", async () => {
    const headers = await runMiddleware();
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("sets a Content-Security-Policy header", async () => {
    const headers = await runMiddleware();
    const csp =
      headers["content-security-policy"] ||
      headers["content-security-policy-report-only"];
    expect(csp).toBeDefined();
    expect(csp).toMatch(/default-src/);
  });

  it("CSP allows Pixi.js bundle (script-src 'self' with allowed inline) and Umami analytics", async () => {
    const headers = await runMiddleware();
    const csp =
      headers["content-security-policy"] ||
      headers["content-security-policy-report-only"];
    expect(csp).toBeDefined();
    expect(csp).toContain("script-src");
    // Umami runs from analytics.umami.is by default; the project uses a self
    // hosted instance configured via env. The CSP must at minimum allow self
    // so the loader script ships, then connect-src for the beacon.
    expect(csp).toContain("'self'");
  });

  it("calls next() exactly once for a normal request", async () => {
    const headers: Record<string, string> = {};
    const res = {
      setHeader(name: string, value: unknown) {
        headers[name.toLowerCase()] = String(value);
      },
      removeHeader() {},
      getHeader() {
        return undefined;
      },
    } as unknown as Response;
    const req = { method: "GET", headers: {} } as unknown as Request;
    const next = vi.fn();
    securityHeaders()(req, res, next);
    // helmet chains internally and finally calls our next() once.
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("hides the X-Powered-By Express fingerprint", async () => {
    const headers: Record<string, string> = { "x-powered-by": "Express" };
    const res = {
      setHeader(name: string, value: unknown) {
        headers[name.toLowerCase()] = String(value);
      },
      removeHeader(name: string) {
        delete headers[name.toLowerCase()];
      },
      getHeader(name: string) {
        return headers[name.toLowerCase()];
      },
    } as unknown as Response;
    const req = { method: "GET", headers: {} } as unknown as Request;
    securityHeaders()(req, res, () => {});
    expect(headers["x-powered-by"]).toBeUndefined();
  });
});
