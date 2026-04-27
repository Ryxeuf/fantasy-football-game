/**
 * Tests pour POST /api/sync-auth-cookie (S24.1).
 *
 * La route est le seul writer du cookie auth_token. Elle doit le
 * positionner avec httpOnly=true, sameSite=strict, et secure=true
 * en production. Sans ces flags, le cookie peut etre vole via XSS
 * ou expose en CSRF.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { POST } from "./route";

function buildRequest(body: unknown): Request {
  return new Request("http://localhost/api/sync-auth-cookie", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/sync-auth-cookie", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
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
});
