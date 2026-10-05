/**
 * Couronnes (Crowns) du coach connecté, hors Pro League.
 *
 *  - GET /crowns/me (authUser) → solde + 20 dernières opérations
 *
 * La monnaie est celle du wallet existant (`services/pro-wallet`) : les
 * routes `/pro-league/me/wallet*` sont gelées avec la Pro League, celle-ci
 * ne l'est pas. Monté derrière `requireFeatureFlag(CROWNS_FLAG)` (index.ts).
 */

import { Router } from "express";
import { authUser, type AuthenticatedRequest } from "../middleware/authUser";
import { getBalance, getRecentTransactions } from "../services/pro-wallet";
import { serverLog } from "../utils/server-log";

const router = Router();

/** Taille de l'historique servi au profil. */
export const CROWNS_HISTORY_LIMIT = 20;

router.get("/me", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const [balance, transactions] = await Promise.all([
      getBalance(userId),
      getRecentTransactions(userId, CROWNS_HISTORY_LIMIT),
    ]);
    return res.json({ balance, transactions });
  } catch (e: unknown) {
    serverLog.error("[crowns] lecture du solde échouée", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
