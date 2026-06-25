/**
 * Tests du service `revalidate-web` : poste correctement au front, no-op si
 * non configuré, ne throw jamais.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { revalidateWeb, revalidateRosterPages } from "./revalidate-web";

const OLD_ENV = process.env;

describe("revalidate-web", () => {
  beforeEach(() => {
    process.env = {
      ...OLD_ENV,
      WEB_REVALIDATE_URL: "http://web:3100",
      REVALIDATE_SECRET: "s3cr3t",
    };
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it("poste les tags avec l'en-tête secret sur l'endpoint du front", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    await revalidateRosterPages(["underworld"]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://web:3100/api/revalidate");
    expect(opts.method).toBe("POST");
    expect(
      (opts.headers as Record<string, string>)["x-revalidate-secret"],
    ).toBe("s3cr3t");
    expect(JSON.parse(opts.body as string)).toEqual({
      tags: ["rosters", "skills", "roster:underworld"],
      paths: [],
    });
  });

  it("ne poste rien si REVALIDATE_SECRET absent (no-op)", async () => {
    delete process.env.REVALIDATE_SECRET;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await revalidateWeb({ tags: ["rosters"] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ne poste rien si WEB_REVALIDATE_URL absent (no-op)", async () => {
    delete process.env.WEB_REVALIDATE_URL;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await revalidateRosterPages(["underworld"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ne poste rien quand il n'y a ni tag ni path", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await revalidateWeb({ tags: [], paths: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ne throw jamais si fetch rejette", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("web down")));
    await expect(revalidateRosterPages()).resolves.toBeUndefined();
  });

  it("ne throw jamais sur réponse non-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(revalidateWeb({ tags: ["rosters"] })).resolves.toBeUndefined();
  });
});
