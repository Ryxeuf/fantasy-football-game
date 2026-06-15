/**
 * Tests pour le client API enveloppe (tâche S25.5b).
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ApiClientError,
  isApiResponse,
  parseApiBody,
} from "./api-client";

describe("isApiResponse", () => {
  it("vrai sur un succes valide", () => {
    expect(isApiResponse({ success: true, data: { x: 1 } })).toBe(true);
  });

  it("vrai sur une erreur valide", () => {
    expect(isApiResponse({ success: false, error: "msg" })).toBe(true);
  });

  it("faux sur un body sans champ success", () => {
    expect(isApiResponse({ data: { x: 1 } })).toBe(false);
  });

  it("faux sur null/undefined/non-objet", () => {
    expect(isApiResponse(null)).toBe(false);
    expect(isApiResponse(undefined)).toBe(false);
    expect(isApiResponse("string")).toBe(false);
    expect(isApiResponse(42)).toBe(false);
  });

  it("faux sur success non-boolean", () => {
    expect(isApiResponse({ success: "true", data: {} })).toBe(false);
  });
});

describe("parseApiBody", () => {
  it("retourne data quand body est une enveloppe success", () => {
    const out = parseApiBody({ success: true, data: { x: 1 } }, true);
    expect(out).toEqual({ x: 1 });
  });

  it("throw ApiClientError quand body est une enveloppe error", () => {
    expect(() =>
      parseApiBody({ success: false, error: "bad" }, true),
    ).toThrow(ApiClientError);
    try {
      parseApiBody({ success: false, error: "bad" }, true);
    } catch (e) {
      expect((e as ApiClientError).message).toBe("bad");
    }
  });

  it("retourne le body brut en mode legacy quand il n'est pas enveloppe", () => {
    const raw = { leagues: [{ id: "1" }] };
    expect(parseApiBody(raw, true)).toEqual(raw);
  });

  it("throw ApiClientError sur HTTP error sans body parsable", () => {
    expect(() => parseApiBody(null, false)).toThrow(ApiClientError);
  });

  it("priorise l'enveloppe error sur le statut HTTP", () => {
    expect(() =>
      parseApiBody({ success: false, error: "domain msg" }, false),
    ).toThrow("domain msg");
  });

  it("utilise le statut HTTP quand le body legacy expose juste { error }", () => {
    expect(() =>
      parseApiBody({ error: "raw legacy" }, false),
    ).toThrow("raw legacy");
  });
});

describe("ApiClientError", () => {
  it("expose le statut HTTP optionnel", () => {
    const err = new ApiClientError("oops", 404);
    expect(err.message).toBe("oops");
    expect(err.status).toBe(404);
    expect(err).toBeInstanceOf(Error);
  });

  it("default a undefined si pas de status fourni", () => {
    expect(new ApiClientError("oops").status).toBeUndefined();
  });
});

describe("apiRequest helper", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("unwrap automatiquement une reponse ApiResponse<T>", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { id: "abc" } }),
      }),
    );
    const { apiRequest } = await import("./api-client");
    const result = await apiRequest<{ id: string }>("/test");
    expect(result).toEqual({ id: "abc" });
  });

  it("retourne le body brut quand l'endpoint n'est pas encore migre", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ leagues: [{ id: "1" }] }),
      }),
    );
    const { apiRequest } = await import("./api-client");
    const result = await apiRequest<{ leagues: unknown[] }>("/legacy");
    expect(result.leagues).toHaveLength(1);
  });

  it("throw ApiClientError sur reponse HTTP 4xx avec enveloppe error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ success: false, error: "Not found" }),
      }),
    );
    const { apiRequest } = await import("./api-client");
    await expect(apiRequest("/missing")).rejects.toThrow("Not found");
  });

  it("ne tente PAS de refresh sur 401 quand aucun refresh token n'est stocké", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "Token invalide" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { apiRequest } = await import("./api-client");

    await expect(apiRequest("/local-match")).rejects.toThrow("Token invalide");
    // Sans refresh token : pas de retry, un seul appel réseau.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sur 401 avec refresh token : refresh silencieux puis retry réussi", async () => {
    window.localStorage.setItem("auth_token", "expired-access");
    window.localStorage.setItem("auth_refresh_token", "valid-refresh");

    const fetchMock = vi.fn((url: string) => {
      const u = String(url);
      if (u.endsWith("/auth/refresh")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            token: "fresh-access",
            refreshToken: "rotated-refresh",
          }),
        });
      }
      if (u.includes("/api/sync-auth-cookie")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
      }
      // /local-match : 401 tant que le token est l'ancien (expiré), 200 une
      // fois que le refresh a écrit le nouveau token en localStorage.
      if (window.localStorage.getItem("auth_token") === "fresh-access") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ localMatches: [{ id: "m1" }] }),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 401,
        json: async () => ({ error: "Token invalide" }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { apiRequest } = await import("./api-client");
    const result = await apiRequest<{ localMatches: { id: string }[] }>(
      "/local-match",
    );

    expect(result.localMatches).toEqual([{ id: "m1" }]);
    // Le token rafraîchi a bien été persisté.
    expect(window.localStorage.getItem("auth_token")).toBe("fresh-access");
    // Exactement un appel /auth/refresh.
    const refreshCalls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).endsWith("/auth/refresh"),
    );
    expect(refreshCalls).toHaveLength(1);
  });
});
