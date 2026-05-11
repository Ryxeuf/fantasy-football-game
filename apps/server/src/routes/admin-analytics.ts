/**
 * Sprint P (Lot P.C.3) — Routes admin analytics.
 *
 * `GET /admin/analytics` retourne le snapshot (DAU/MAU/funnel/crowns).
 * Auth admin required (le router parent monte deja `adminOnly`).
 */

import { Router, type Request, type Response } from "express";

import { adminOnly } from "../middleware/adminOnly";
import { authUser } from "../middleware/authUser";
import { getAnalyticsSnapshot } from "../services/admin-analytics";
import { serverLog } from "../utils/server-log";

export async function handleGetAnalytics(
  _req: Request,
  res: Response,
): Promise<void> {
  try {
    const snapshot = await getAnalyticsSnapshot();
    res.json(snapshot);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown";
    serverLog.error(`[admin/analytics] failed: ${msg}`);
    res.status(500).json({ error: "internal-error" });
  }
}

const router = Router();

router.use(authUser, adminOnly);

router.get("/analytics", handleGetAnalytics);

export default router;
