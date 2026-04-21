import { afterEach, describe, expect, it, vi } from "vitest";
import { safeServerJson } from "./serverApi";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("safeServerJson", () => {
  it("returns parsed JSON when the response is OK", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ skills: [{ id: "a" }] }),
    } as unknown as Response);

    const result = await safeServerJson<{ skills: { id: string }[] }>(
      "http://server/api/skills",
    );

    expect(result).toEqual({ skills: [{ id: "a" }] });
  });

  it("returns null when the response is not OK", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as unknown as Response);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await safeServerJson("http://server/api/skills");

    expect(result).toBeNull();
  });

  it("returns null when fetch throws a network error", async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValue(new TypeError("fetch failed"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await safeServerJson("http://server/api/skills");

    expect(result).toBeNull();
    expect(errSpy).toHaveBeenCalled();
  });

  it("returns null when JSON parsing throws", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError("Unexpected token");
      },
    } as unknown as Response);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await safeServerJson("http://server/api/skills");

    expect(result).toBeNull();
  });
});
