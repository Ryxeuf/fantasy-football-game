/**
 * Couronnes (Crowns) du coach connecté, hors Pro League.
 *
 *  - GET /crowns/me (authUser) → solde + 20 dernières opérations
 *
 * Avant de lire le solde, la route RATTRAPE les récompenses dues (feuilles
 * validées, succès, bonus de bienvenue — `services/crowns-rewards`), en
 * best-effort : un échec du rattrapage ne fait jamais échouer la lecture. Les
 * opérations d'un passage portent leur détail (`rewards`), et la réponse
 * porte le barème en vigueur (`schedule`).
 *
 * La monnaie est celle du wallet existant (`services/pro-wallet`) : les
 * routes `/pro-league/me/wallet*` sont gelées avec la Pro League, celle-ci
 * ne l'est pas. Monté derrière `requireFeatureFlag(CROWNS_FLAG)` (index.ts).
 */

import { Router } from "express";
import { authUser, type AuthenticatedRequest } from "../middleware/authUser";
import { getBalance, getRecentTransactions } from "../services/pro-wallet";
import {
  loadRewardBreakdowns,
  reconcileCrownsRewards,
} from "../services/crowns-rewards";
import {
  DEFAULT_CROWNS_REWARD_SCHEDULE,
  type CrownsRewardBreakdown,
} from "../services/crowns-rewards-rules";
import { serverLog } from "../utils/server-log";

const router = Router();

/** Taille de l'historique servi au profil. */
export const CROWNS_HISTORY_LIMIT = 20;

router.get("/me", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    try {
      await reconcileCrownsRewards(userId);
    } catch (e: unknown) {
      serverLog.error("[crowns] rattrapage des récompenses échoué", e);
    }
    const [balance, transactions] = await Promise.all([
      getBalance(userId),
      getRecentTransactions(userId, CROWNS_HISTORY_LIMIT),
    ]);
    let breakdowns = new Map<string, CrownsRewardBreakdown>();
    try {
      breakdowns = await loadRewardBreakdowns(transactions);
    } catch (e: unknown) {
      serverLog.error("[crowns] détail des récompenses indisponible", e);
    }
    return res.json({
      balance,
      // Barème en vigueur : l'écran l'affiche tel quel (« Comment gagner »),
      // sans recopier des montants qui divergeraient au premier calibrage.
      schedule: DEFAULT_CROWNS_REWARD_SCHEDULE,
      transactions: transactions.map((t) =>
        breakdowns.has(t.id) ? { ...t, rewards: breakdowns.get(t.id) } : t,
      ),
    });
  } catch (e: unknown) {
    serverLog.error("[crowns] lecture du solde échouée", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
