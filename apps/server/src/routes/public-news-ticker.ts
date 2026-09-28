/**
 * Route publique du bandeau « dernières infos » de la home.
 *
 * `GET /api/public/news-ticker` → `{ items, generatedAt }`. Sans
 * authentification : ne sert que des compétitions PUBLIQUES (cf. service).
 * Mémoïsé 60 s en process + cache HTTP court posé au montage : le bandeau
 * doit rester frais, contrairement aux données de référence (1 h).
 */

import { Router } from "express";
import { prisma } from "../prisma";
import { gatherNewsTicker, type NewsTickerClient } from "../services/public-news-ticker";
import { memoizeAsync } from "../utils/memoize-async";
import { serverLog } from "../utils/server-log";

const router = Router();

const NEWS_TICKER_TTL_MS = 60 * 1000;

router.get("/public/news-ticker", async (_req, res) => {
  try {
    const items = await memoizeAsync("public-news-ticker", "home", NEWS_TICKER_TTL_MS, () =>
      gatherNewsTicker(prisma as unknown as NewsTickerClient),
    );
    res.json({ items, generatedAt: new Date().toISOString() });
  } catch (error) {
    serverLog.error("[public-news-ticker] failed", error);
    res.status(500).json({ error: "news_ticker_unavailable" });
  }
});

export default router;
