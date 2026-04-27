/**
 * Tests pour POST /api/clear-auth-cookie (S24.1).
 *
 * Quand un cookie auth_token est httpOnly, JavaScript ne peut plus
 * l'effacer via document.cookie. Il faut donc une route serveur
 * dediee qui retourne un Set-Cookie avec Max-Age=0.
 */
import { describe, it, expect } from "vitest";
import { POST } from "./route";

describe("POST /api/clear-auth-cookie", () => {
  it("returns 200 and clears auth_token cookie", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("auth_token=");
    expect(setCookie).toMatch(/Max-Age=0/i);
    expect(setCookie).toMatch(/Path=\//i);
  });
});
