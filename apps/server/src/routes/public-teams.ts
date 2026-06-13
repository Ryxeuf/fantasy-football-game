/**
 * Route publique d'une équipe partagée (lecture seule, sans auth).
 *
 * `GET /api/public/teams/:token` → l'équipe + son roster si elle a été
 * rendue publique par son coach (opt-in). 404 sinon. Alimente la page
 * publique de partage et l'image OG dynamique.
 */

import { Router } from "express";
import { getPublicTeamByToken } from "../services/team-share";
import { serverLog } from "../utils/server-log";

const router = Router();

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
