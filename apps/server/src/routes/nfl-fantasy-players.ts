/**
 * Routes publiques (auth user) du catalogue NFL Fantasy / Nuffle Coach.
 *
 * Sous `/api/nfl-fantasy/players`, protege par authUser uniquement
 * (pas adminOnly). Reutilise les services existants
 * `listNflPlayersForAdmin` et `getNflPlayerDetail` — le filtrage
 * `realName` (V1 prive) est applique par le service lui-meme via
 * `realNameDisplay`.
 *
 *   GET  /                  liste paginee + filtres (seasonId, teamCode,
 *                           bbPosition, nflPosition, status, search)
 *   GET  /:id?seasonId=     fiche player + stats agregees saison
 */

import { Router } from "express";
import { z } from "zod";

import { authUser } from "../middleware/authUser";
import { validateQuery } from "../middleware/validate";
import {
  getNflPlayerDetail,
  listNflPlayersForAdmin,
} from "../services/nfl-fantasy-admin-explorer";
import { sendNflError } from "../utils/nfl-error-mapper";
import { serverLog } from "../utils/server-log";

const router = Router();
router.use(authUser);

const seasonIdParam = z.string().regex(/^\d{4}$/).optional();

const playersListSchema = z.object({
  seasonId: seasonIdParam,
  teamCode: z.string().min(2).max(4).optional(),
  bbPosition: z.string().min(1).max(20).optional(),
  nflPosition: z.string().min(1).max(20).optional(),
  status: z.enum(["active", "ir", "retired", "suspended"]).optional(),
  search: z.string().min(1).max(64).optional(),
  page: z.coerce.number().int().min(1).max(10000).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

const playerDetailSchema = z.object({
  seasonId: seasonIdParam,
});

router.get("/", validateQuery(playersListSchema), async (req, res) => {
  try {
    const q = req.query as z.infer<typeof playersListSchema>;
    const out = await listNflPlayersForAdmin({
      seasonId: q.seasonId,
      teamCode: q.teamCode?.toUpperCase(),
      bbPosition: q.bbPosition,
      nflPosition: q.nflPosition?.toUpperCase(),
      status: q.status,
      search: q.search,
      page: q.page,
      pageSize: q.pageSize,
    });
    res.json(out);
  } catch (err) {
    if (!sendNflError(res, err)) {
      serverLog.error("[nfl-fantasy-players] list failed", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
});

router.get(
  "/:id",
  validateQuery(playerDetailSchema),
  async (req, res) => {
    try {
      const q = req.query as z.infer<typeof playerDetailSchema>;
      const detail = await getNflPlayerDetail({
        id: req.params.id,
        seasonId: q.seasonId,
      });
      if (!detail) {
        res.status(404).json({
          error: `Joueur ${req.params.id} introuvable`,
          code: "PLAYER_NOT_FOUND",
        });
        return;
      }
      res.json(detail);
    } catch (err) {
      if (!sendNflError(res, err)) {
        serverLog.error("[nfl-fantasy-players] detail failed", err);
        res.status(500).json({ error: "Erreur serveur" });
      }
    }
  },
);

export default router;
