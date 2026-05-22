/**
 * Routes user-facing pour le catalogue des equipes NFL (32 teams).
 *
 *   GET /                    listNflTeams()
 *
 * Public read-only : tout le monde peut consulter (le catalogue Nuffle
 * est marketing-friendly). Utilise par la page mercato pour populer
 * les filtres equipe / race / ville.
 */

import { Router } from "express";

import { prisma } from "../prisma";
import { serverLog } from "../utils/server-log";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const teams = await prisma.nflTeam.findMany({
      orderBy: { code: "asc" },
      select: {
        code: true,
        city: true,
        bbRace: true,
        raceLabel: true,
      },
    });
    res.json({ teams });
  } catch (err) {
    serverLog.error("[nfl-fantasy-teams] list failed", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
