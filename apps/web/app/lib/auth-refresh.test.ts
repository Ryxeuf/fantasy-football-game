/**
 * Tests pour le helper de rafraichissement silencieux (S24.3).
 *
 * fetch et la route /api/sync-auth-cookie sont mockes pour eviter le reseau.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  window.localStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

import { refreshAccessToken } from "./auth-refresh";
import { setAuthTokens, getAuthToken, getRefreshToken } from "./auth-storage";

function mockResponse(status: number, body?: unknown): Response {
  return new Response(body ? JSON.stringify(body) : null, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Rule: refreshAccessToken (S24.3)", () => {
  it("returns null when no refresh token is stored", async () => {
    const result = await refreshAccessToken();
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls /auth/refresh with the stored refresh token", async () => {
    setAuthTokens({ token: "old-access", refreshToken: "old-refresh" });
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith("/auth/refresh")) {
        return Promise.resolve(
          mockResponse(200, { token: "new-access", refreshToken: "new-refresh" }),
        );
      }
      // /api/sync-auth-cookie
      return Promise.resolve(mockResponse(200));
    });

    const result = await refreshAccessToken();
    expect(result).toBe("new-access");

    const refreshCall = fetchMock.mock.calls.find((c) =>
      String(c[0]).endsWith("/auth/refresh"),
    );
    expect(refreshCall).toBeDefined();
    const init = refreshCall![1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      refreshToken: "old-refresh",
    });
  });

  it("stores the new pair in localStorage on success", async () => {
    setAuthTokens({ token: "old-access", refreshToken: "old-refresh" });
    fetchMock.mockResolvedValue(
      mockResponse(200, { token: "new-access", refreshToken: "new-refresh" }),
    );

    await refreshAccessToken();
    expect(getAuthToken()).toBe("new-access");
    expect(getRefreshToken()).toBe("new-refresh");
  });

  it("clears tokens on 401 (server signaled reuse or invalid token)", async () => {
    setAuthTokens({ token: "old-access", refreshToken: "old-refresh" });
    fetchMock.mockResolvedValue(mockResponse(401, { error: "boom" }));

    const result = await refreshAccessToken();
    expect(result).toBeNull();
    expect(getAuthToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it("clears tokens on 403 (account disabled)", async () => {
    setAuthTokens({ token: "old-access", refreshToken: "old-refresh" });
    fetchMock.mockResolvedValue(mockResponse(403));

    const result = await refreshAccessToken();
    expect(result).toBeNull();
    expect(getAuthToken()).toBeNull();
  });

  it("returns null and keeps tokens on network error (fetch throws)", async () => {
    setAuthTokens({ token: "old-access", refreshToken: "old-refresh" });
    fetchMock.mockRejectedValue(new Error("network down"));

    const result = await refreshAccessToken();
    expect(result).toBeNull();
    // Network errors are transient — keep the existing tokens so the next
    // attempt can retry without forcing a logout.
    expect(getRefreshToken()).toBe("old-refresh");
  });

  it("returns null when response is missing token field", async () => {
    setAuthTokens({ token: "old-access", refreshToken: "old-refresh" });
    fetchMock.mockResolvedValue(mockResponse(200, { foo: "bar" }));

    const result = await refreshAccessToken();
    expect(result).toBeNull();
  });

  it("single-flight: concurrent callers share one /auth/refresh request", async () => {
    // Régression : deux refresh concurrents avec le même refresh token
    // déclenchent la détection de réuse côté serveur (révocation de TOUTES les
    // sessions). Le single-flight doit garantir un seul appel réseau.
    setAuthTokens({ token: "old-access", refreshToken: "old-refresh" });

    let resolveRefresh: (r: Response) => void = () => {};
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith("/auth/refresh")) {
        return new Promise<Response>((resolve) => {
          resolveRefresh = resolve;
        });
      }
      return Promise.resolve(mockResponse(200));
    });

    // Trois appels concurrents avant la résolution.
    const p1 = refreshAccessToken();
    const p2 = refreshAccessToken();
    const p3 = refreshAccessToken();

    resolveRefresh(
      mockResponse(200, { token: "new-access", refreshToken: "new-refresh" }),
    );

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
    expect(r1).toBe("new-access");
    expect(r2).toBe("new-access");
    expect(r3).toBe("new-access");

    const refreshCalls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).endsWith("/auth/refresh"),
    );
    expect(refreshCalls).toHaveLength(1);
  });

  it("allows a fresh request once the previous one settled", async () => {
    setAuthTokens({ token: "old-access", refreshToken: "old-refresh" });
    fetchMock.mockResolvedValue(
      mockResponse(200, { token: "a", refreshToken: "b" }),
    );

    await refreshAccessToken();
    await refreshAccessToken();

    const refreshCalls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).endsWith("/auth/refresh"),
    );
    // Single-flight ne bloque pas les appels séquentiels : 2 appels => 2 requêtes.
    expect(refreshCalls).toHaveLength(2);
  });
});
