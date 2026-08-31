/**
 * Route publique d'une équipe partagée (lecture seule, sans auth).
 *
 * `GET /api/public/teams/:token` → l'équipe + son roster si elle a été
 * rendue publique par son coach (opt-in). 404 sinon. Alimente la page
 * publique de partage et l'image OG dynamique.
 *
 * `GET /api/public/teams/by-id/:id` → aperçu MINIMAL de la même équipe,
 * résolu par son id. Alimente la metadata de la fiche `/me/teams/:id`,
 * seule URL dont dispose un scraper quand le coach colle ce lien. Même
 * porte (`isPublic`), moins de données.
 */

import { Router } from "express";
import {
  getPublicTeamByToken,
  getPublicTeamPreviewById,
} from "../services/team-share";
import { serverLog } from "../utils/server-log";

const router = Router();

// Déclarée AVANT `/public/teams/:token` : sans cela, Express ferait
// correspondre « by-id » au paramètre `:token`.
router.get("/public/teams/by-id/:id", async (req, res) => {
  try {
    const preview = await getPublicTeamPreviewById(req.params.id);
    if (!preview) {
      res.status(404).json({ error: "team_not_found" });
      return;
    }
    res.json({ preview });
  } catch (error) {
    serverLog.error("[public-teams] preview failed", error);
    res.status(500).json({ error: "stats_unavailable" });
  }
});

router.get("/public/teams/:token", async (req, res) => {
  try {
    const team = await getPublicTeamByToken(req.params.token);
    if (!team) {
      res.status(404).json({ error: "team_not_found" });
      return;
    }
    res.json({ team });
  } catch (error) {
    serverLog.error("[public-teams] failed", error);
    res.status(500).json({ error: "stats_unavailable" });
  }
});

export default router;
