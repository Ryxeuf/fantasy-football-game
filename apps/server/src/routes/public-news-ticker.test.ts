/**
 * Route `GET /api/public/news-ticker` : gatée par `home_news_ticker`.
 *
 * Chaîne Express réelle (http natif, pas de supertest), flag et service
 * mockés. Invariants : 403 quand le flag est OFF pour l'appelant (sans
 * toucher au service), 200 + cache PRIVÉ quand il est ON — la réponse
 * dépend de l'appelant, un cache public la servirait à tous.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";

vi.mock("../services/featureFlags", () => ({
  HOME_NEWS_TICKER_FLAG: "home_news_ticker",
  isEnabled: vi.fn(),
}));
vi.mock("../services/public-news-ticker", () => ({
  gatherNewsTicker: vi.fn(),
}));
vi.mock("../prisma", () => ({ prisma: {} }));

import { isEnabled } from "../services/featureFlags";
import { gatherNewsTicker } from "../services/public-news-ticker";
import { invalidateMemoNamespace } from "../utils/memoize-async";
import router from "./public-news-ticker";

const mockedIsEnabled = isEnabled as unknown as ReturnType<typeof vi.fn>;
const mockedGather = gatherNewsTicker as unknown as ReturnType<typeof vi.fn>;

let server: http.Server;
let port: number;

function get(path: string): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: unknown }> {
  return new Promise((resolve, reject) => {
    http
      .get({ host: "127.0.0.1", port, path }, (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () =>
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body: raw ? JSON.parse(raw) : null }),
        );
      })
      .on("error", reject);
  });
}

beforeEach(async () => {
  vi.resetAllMocks();
  invalidateMemoNamespace("public-news-ticker");
  const app = express();
  app.use("/api", router);
  server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  port = (server.address() as AddressInfo).port;
});

afterEach(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});

describe("GET /api/public/news-ticker", () => {
  it("403 quand le flag est OFF, sans charger les données", async () => {
    mockedIsEnabled.mockResolvedValue(false);
    const res = await get("/api/public/news-ticker");
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: "feature_flag_disabled", flag: "home_news_ticker" });
    expect(mockedIsEnabled).toHaveBeenCalledWith("home_news_ticker", undefined, { roles: [] });
    expect(mockedGather).not.toHaveBeenCalled();
  });

  it("200 + cache privé quand le flag est ON", async () => {
    mockedIsEnabled.mockResolvedValue(true);
    mockedGather.mockResolvedValue([{ kind: "blog_post", id: "b1" }]);
    const res = await get("/api/public/news-ticker");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ items: [{ kind: "blog_post", id: "b1" }] });
    expect(res.headers["cache-control"]).toBe("private, max-age=120");
  });

  it("500 si le chargement échoue", async () => {
    mockedIsEnabled.mockResolvedValue(true);
    mockedGather.mockRejectedValue(new Error("db down"));
    const res = await get("/api/public/news-ticker");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "news_ticker_unavailable" });
  });
});
