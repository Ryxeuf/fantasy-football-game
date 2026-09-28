import { describe, it, expect, beforeEach } from "vitest";
import { post, rawGet, resetDb } from "../helpers/api";
import { seedAndLogin } from "../helpers/factories";

/**
 * Spec /api/public/news-ticker (bandeau « À la une » de la home).
 *
 * Route publique, sans auth. Valide contre une vraie base (miroir SQLite)
 * que les requêtes imbriquées du service passent, et la règle de visibilité :
 * une coupe PRIVÉE ne s'annonce jamais. `resetDb` invalide la mémoïsation.
 * La route est gatée par `home_news_ticker` (OFF en prod) : la suite tourne
 * avec `FEATURE_FLAGS_FORCE_ENABLED` (cf. setup.ts), le gate lui-même est
 * couvert par `apps/server/src/routes/public-news-ticker.test.ts`.
 */

interface TickerItem {
  kind: string;
  id: string;
  href: string;
  title: string;
  competition?: string;
}

interface TickerResponse {
  items: TickerItem[];
  generatedAt: string;
}

describe("E2E API — /api/public/news-ticker", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("répond 200 sans auth, liste vide sur une base vide", async () => {
    const res = await rawGet("/api/public/news-ticker", null);
    expect(res.status).toBe(200);
    const json = (await res.json()) as TickerResponse;
    expect(json.items).toEqual([]);
    expect(typeof json.generatedAt).toBe("string");
  });

  it("annonce une coupe publique ouverte, jamais une coupe privée", async () => {
    const { token } = await seedAndLogin("ticker@cup.test", "pwd", "Ticker");
    await post("/cup", token, { name: "Coupe publique" });
    await post("/cup", token, { name: "Coupe privée", isPublic: false });

    const res = await rawGet("/api/public/news-ticker", null);
    expect(res.status).toBe(200);
    const json = (await res.json()) as TickerResponse;
    const titles = json.items.map((i) => i.title);
    expect(titles).toContain("Coupe publique");
    expect(titles).not.toContain("Coupe privée");
    const open = json.items.find((i) => i.title === "Coupe publique");
    expect(open).toMatchObject({ kind: "competition_open", competition: "cup" });
    expect(open?.href).toMatch(/^\/cups\//);
  });
});
