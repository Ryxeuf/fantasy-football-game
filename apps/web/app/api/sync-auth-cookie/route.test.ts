/**
 * Tests pour POST /api/sync-auth-cookie (S24.1).
 *
 * La route est le seul writer du cookie auth_token. Elle doit le
 * positionner avec httpOnly=true, sameSite=strict, et secure=true
 * en production. Sans ces flags, le cookie peut etre vole via XSS
 * ou expose en CSRF.
 *
 * Audit round 11 (CRITICAL) : la route valide maintenant le token
 * contre /auth/me du backend avant de set le cookie. Sans ca, un
 * attaquant pouvait fabriquer un JWT non-signe `{role: "admin"}` et
 * bypass le middleware admin (Edge Runtime ne verifie pas la
 * signature). Les tests mocks `global.fetch` pour /auth/me.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { POST } from "./route";

function buildRequest(body: unknown): Request {
  return new Request("http://localhost/api/sync-auth-cookie", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function mockFetchOk(): void {
  globalThis.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ user: { id: "u1" } }), { status: 200 }),
  ) as typeof fetch;
}

function mockFetch401(): void {
  globalThis.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ error: "Invalid token" }), { status: 401 }),
  ) as typeof fetch;
}

describe("POST /api/sync-auth-cookie", () => {
  beforeEach(() => {
    mockFetchOk();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns 400 when token is missing", async () => {
    const res = await POST(buildRequest({}) as never);
    expect(res.status).toBe(400);
  });

  it("returns 400 when token is not a string", async () => {
    const res = await POST(buildRequest({ token: 42 }) as never);
    expect(res.status).toBe(400);
  });

  it("sets cookie with HttpOnly + SameSite=Strict on success", async () => {
    const res = await POST(buildRequest({ token: "abc" }) as never);
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("auth_token=abc");
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Strict/i);
    expect(setCookie).toMatch(/Path=\//i);
  });

  it("does not include Secure flag in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const res = await POST(buildRequest({ token: "abc" }) as never);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).not.toMatch(/;\s*Secure/i);
  });

  it("includes Secure flag in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await POST(buildRequest({ token: "abc" }) as never);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/;\s*Secure/i);
  });

  // Audit round 11 : tests anti-bypass admin middleware.
  it("returns 401 si le backend rejette le token (signature invalide)", async () => {
    mockFetch401();
    const res = await POST(buildRequest({ token: "forged.jwt.value" }) as never);
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("returns 503 si le backend est injoignable (timeout ou network error)", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) as typeof fetch;
    const res = await POST(buildRequest({ token: "abc" }) as never);
    expect(res.status).toBe(503);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("appelle /auth/me avec Bearer <token>", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user: { id: "u1" } }), { status: 200 }),
    );
    globalThis.fetch = fetchSpy as typeof fetch;
    await POST(buildRequest({ token: "validtoken" }) as never);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(String(url)).toMatch(/\/auth\/me$/);
    expect((options as { headers: Record<string, string> }).headers.authorization)
      .toBe("Bearer validtoken");
  });
});
