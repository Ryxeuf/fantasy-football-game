/**
 * Routes user-facing pour les cycles de saison Nuffle Coach.
 *
 *   GET /                    listCyclesWithStatus(seasonId)
 *
 * Authentification optionnelle : tout le monde peut consulter la
 * liste des cycles (info publique non sensible). Utilise par /new
 * pour afficher le prochain cycle joignable et par la page detail
 * pour resoudre le label cycle.
 */

import { Router } from "express";
import { z } from "zod";

import { validateQuery } from "../middleware/validate";
import { listCyclesWithStatus } from "../services/nfl-fantasy-season-cycle";
import { sendNflError } from "../utils/nfl-error-mapper";
import { serverLog } from "../utils/server-log";

const router = Router();

const listQuerySchema = z.object({
  seasonId: z.string().min(1),
});

router.get("/", validateQuery(listQuerySchema), async (req, res) => {
  try {
    const { seasonId } = req.query as unknown as z.infer<typeof listQuerySchema>;
    const cycles = await listCyclesWithStatus(seasonId);
    res.json({ cycles });
  } catch (err) {
    if (!sendNflError(res, err)) {
      serverLog.error("[nfl-fantasy-cycles] list failed", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
});

export default router;
