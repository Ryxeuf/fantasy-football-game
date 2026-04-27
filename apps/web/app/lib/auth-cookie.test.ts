/**
 * Tests pour les helpers auth-cookie cote client (S24.1).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { syncAuthCookie, clearAuthCookie } from "./auth-cookie";

describe("syncAuthCookie", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts token to /api/sync-auth-cookie and returns true on success", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    const ok = await syncAuthCookie("token-xyz");

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/sync-auth-cookie");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ token: "token-xyz" }));
    expect(init?.credentials).toBe("same-origin");
  });

  it("returns false when fetch rejects", async () => {
    vi.mocked(globalThis.fetch).mockRejectedValue(new Error("offline"));
    const ok = await syncAuthCookie("token");
    expect(ok).toBe(false);
  });

  it("returns false on non-2xx response", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(null, { status: 500 }),
    );
    const ok = await syncAuthCookie("token");
    expect(ok).toBe(false);
  });
});

describe("clearAuthCookie", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts to /api/clear-auth-cookie", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    const ok = await clearAuthCookie();

    expect(ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/clear-auth-cookie");
    expect(init?.method).toBe("POST");
  });
});
