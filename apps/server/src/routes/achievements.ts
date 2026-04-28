import { Router } from "express";
import { authUser, AuthenticatedRequest } from "../middleware/authUser";
import { getUserAchievements } from "../services/achievements";
import { serverLog } from "../utils/server-log";

const router = Router();

/**
 * N.7 — Systeme d'achievements (succes).
 *
 * GET /achievements
 *   Retourne le catalogue complet avec statut verrouille/deverouille pour
 *   l'utilisateur courant. Les achievements nouvellement satisfaits sont
 *   deverouilles lazy au moment de la lecture.
 */
router.get("/", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await getUserAchievements(req.user!.id);
    return res.json({ success: true, data: result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    serverLog.error("[GET /achievements] error:", message);
    return res.status(500).json({ success: false, error: message });
  }
});

export default router;
