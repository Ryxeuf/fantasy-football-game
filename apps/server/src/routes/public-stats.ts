/**
 * Route publique de statistiques agrégées (sans authentification).
 *
 * `GET /api/public/stats` → compteurs catalogue + activité. Léger (6
 * COUNT), idéal pour la home (preuve sociale) sans charger les listes
 * complètes. Mis en cache HTTP via `publicCache()` au montage.
 */

import { Router } from "express";
import { prisma } from "../prisma";
import { gatherPublicStats } from "../services/public-stats";
import { serverLog } from "../utils/server-log";

const router = Router();

router.get("/public/stats", async (_req, res) => {
  try {
    const stats = await gatherPublicStats(prisma);
    res.json({ ...stats, generatedAt: new Date().toISOString() });
  } catch (error) {
    serverLog.error("[public-stats] failed", error);
    res.status(500).json({ error: "stats_unavailable" });
  }
});

export default router;
