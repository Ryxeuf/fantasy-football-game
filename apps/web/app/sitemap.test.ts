import { describe, it, expect, vi, afterEach } from "vitest";
import sitemap from "./sitemap";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown): Response {
  return { ok: true, json: async () => body } as unknown as Response;
}

describe("sitemap — positions de roster", () => {
  it("emet une URL par position season_3, dedupe, et n'utilise pas season_2", async () => {
    const calls: string[] = [];
    global.fetch = vi.fn().mockImplementation((url: string) => {
      calls.push(url);
      // Detail roster avec positions (dont un doublon pour tester la dedup).
      if (url.includes("/api/rosters/skaven")) {
        return Promise.resolve(
          jsonResponse({
            roster: {
              slug: "skaven",
              positions: [
                { slug: "skaven_lineman" },
                { slug: "skaven_gutter_runner" },
                { slug: "skaven_lineman" },
              ],
            },
          }),
        );
      }
      if (url.includes("/api/rosters/amazon")) {
        return Promise.resolve(
          jsonResponse({
            roster: { slug: "amazon", positions: [{ slug: "amazon_blitzer" }] },
          }),
        );
      }
      // Liste des rosters (avec ou sans ruleset).
      if (url.includes("/api/rosters?")) {
        return Promise.resolve(
          jsonResponse({ rosters: [{ slug: "skaven" }, { slug: "amazon" }] }),
        );
      }
      if (url.includes("/api/skills")) {
        return Promise.resolve(jsonResponse({ skills: [] }));
      }
      if (url.includes("/star-players")) {
        return Promise.resolve(jsonResponse({ success: true, data: [] }));
      }
      if (url.includes("/coach")) {
        return Promise.resolve(
          jsonResponse({ success: true, data: { slugs: [] } }),
        );
      }
      return Promise.resolve(jsonResponse({}));
    }) as unknown as typeof fetch;

    const entries = await sitemap();
    const urls = entries.map((e) => e.url);

    expect(urls.some((u) => u.endsWith("/teams/skaven/lineman"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/teams/skaven/gutter_runner"))).toBe(
      true,
    );
    expect(urls.some((u) => u.endsWith("/teams/amazon/blitzer"))).toBe(true);

    // Dedup : une seule entree pour skaven/lineman malgre le doublon.
    expect(urls.filter((u) => u.endsWith("/teams/skaven/lineman")).length).toBe(
      1,
    );

    // Les positions proviennent d'un appel ruleset=season_3, jamais season_2.
    expect(
      calls.some(
        (u) => u.includes("/api/rosters?") && u.includes("ruleset=season_3"),
      ),
    ).toBe(true);
    expect(calls.some((u) => u.includes("ruleset=season_2"))).toBe(false);
  });
});
