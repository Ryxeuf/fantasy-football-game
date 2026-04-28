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
});
