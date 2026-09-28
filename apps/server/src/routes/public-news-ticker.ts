/**
 * Route publique du bandeau « dernières infos » de la home.
 *
 * `GET /api/public/news-ticker` → `{ items, generatedAt }`. Sans
 * authentification : ne sert que des compétitions PUBLIQUES (cf. service).
 *
 * Gaté par `home_news_ticker` (403 si inactif pour l'appelant). La réponse
 * dépend donc du porteur du token (admin, override) : cache HTTP PRIVÉ —
 * un `publicCache` laisserait un proxy servir à tous la réponse d'un admin.
 * Les données, elles, sont les mêmes pour tous : mémoïsées 60 s en process.
 */

import { Router } from "express";
import { prisma } from "../prisma";
import { gatherNewsTicker, type NewsTickerClient } from "../services/public-news-ticker";
import { memoizeAsync } from "../utils/memoize-async";
import { requireFeatureFlag } from "../middleware/requireFeatureFlag";
import { HOME_NEWS_TICKER_FLAG } from "../services/featureFlags";
import { serverLog } from "../utils/server-log";

const router = Router();

const NEWS_TICKER_TTL_MS = 60 * 1000;

router.get("/public/news-ticker", requireFeatureFlag(HOME_NEWS_TICKER_FLAG), async (_req, res) => {
  res.setHeader("Cache-Control", "private, max-age=120");
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
