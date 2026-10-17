/**
 * Statistiques d'une coupe à la demande. Monté sur `/cup` AVANT `cupRoutes`.
 *
 *   GET /cup/:id/leaderboards?topN=10   classements joueurs + tops équipes
 *
 * Même porte que `GET /cup/:id` (tout compte connecté) ; `topN` est borné
 * côté serveur (1 à 50).
 */

import { Router } from "express";
import type { Response } from "express";
import { authUser, type AuthenticatedRequest } from "../middleware/authUser";
import { sendError, sendSuccess } from "../utils/api-response";
import { serverLog } from "../utils/server-log";
import {
  clampCupTopN,
  CupLeaderboardsError,
  loadCupLeaderboards,
} from "../services/cup-leaderboards";

export async function handleGetCupLeaderboards(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  if (!req.user?.id) {
    sendError(res, "Non authentifie", 401);
    return;
  }
  try {
    const view = await loadCupLeaderboards({
      cupId: req.params.id,
      topN: clampCupTopN(req.query.topN),
    });
    sendSuccess(res, view);
  } catch (e: unknown) {
    if (e instanceof CupLeaderboardsError) {
      sendError(res, e.message, 404);
      return;
    }
    serverLog.error("[cup-leaderboards] lecture échouée", e);
    sendError(res, "Erreur serveur", 500);
  }
}

const router = Router();
router.get("/:id/leaderboards", authUser, handleGetCupLeaderboards);

export default router;
