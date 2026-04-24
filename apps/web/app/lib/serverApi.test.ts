import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchServerJson, safeServerJson, ServerApiError } from "./serverApi";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("fetchServerJson", () => {
  it("returns parsed JSON when the response is OK", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ skills: [{ id: "a" }] }),
    } as unknown as Response);

    const result = await fetchServerJson<{ skills: { id: string }[] }>(
      "http://server/api/skills",
    );

    expect(result).toEqual({ skills: [{ id: "a" }] });
  });

  it("returns null when the response is 404", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    } as unknown as Response);

    const result = await fetchServerJson("http://server/api/skills");
    expect(result).toBeNull();
  });

  it("throws a ServerApiError with kind='http' on 5xx", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as unknown as Response);

    await expect(
      fetchServerJson("http://server/api/skills"),
    ).rejects.toMatchObject({
      name: "ServerApiError",
      kind: "http",
      status: 500,
    });
  });

  it("throws a ServerApiError with kind='network' when fetch throws", async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValue(new TypeError("fetch failed"));

    await expect(
      fetchServerJson("http://server/api/skills"),
    ).rejects.toMatchObject({
      name: "ServerApiError",
      kind: "network",
    });
  });

  it("throws a ServerApiError with kind='parse' when JSON parsing fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token");
      },
    } as unknown as Response);

    await expect(
      fetchServerJson("http://server/api/skills"),
    ).rejects.toMatchObject({
      name: "ServerApiError",
      kind: "parse",
    });
  });

  it("aborts with kind='timeout' when the request exceeds timeoutMs", async () => {
    global.fetch = vi
      .fn()
      .mockImplementation((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const err = new DOMException("aborted", "AbortError");
            reject(err);
          });
        });
      });

    await expect(
      fetchServerJson("http://server/api/skills", { timeoutMs: 10 }),
    ).rejects.toMatchObject({
      name: "ServerApiError",
      kind: "timeout",
    });
  });
});

describe("safeServerJson", () => {
  it("returns parsed JSON when the response is OK", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    } as unknown as Response);

    const result = await safeServerJson<{ ok: boolean }>(
      "http://server/api/skills",
    );
    expect(result).toEqual({ ok: true });
  });

  it("returns null (and logs) when the underlying fetch throws", async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValue(new TypeError("fetch failed"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await safeServerJson("http://server/api/skills");
    expect(result).toBeNull();
    expect(errSpy).toHaveBeenCalled();
  });

  it("returns null on 5xx instead of throwing", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as unknown as Response);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await safeServerJson("http://server/api/skills");
    expect(result).toBeNull();
  });
});

describe("ServerApiError", () => {
  it("exposes kind, status and url", () => {
    const err = new ServerApiError({
      kind: "http",
      message: "boom",
      url: "http://x/y",
      status: 502,
    });
    expect(err.name).toBe("ServerApiError");
    expect(err.kind).toBe("http");
    expect(err.status).toBe(502);
    expect(err.url).toBe("http://x/y");
  });
});
