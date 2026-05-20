/**
 * Routes admin Phase 3.C — vues read-only sur le referentiel NFL et
 * actions de resync par joueur.
 *
 * Sous /admin/nfl-fantasy, prefixe `/explore/*` pour eviter les
 * collisions avec les routes action existantes (lock-lineups, etc.).
 *
 *   GET  /explore/seasons                       -> listNflSeasonsForAdmin
 *   GET  /explore/teams?seasonId=               -> listNflTeamsForAdmin
 *   GET  /explore/teams/:code?seasonId=         -> getNflTeamDetail
 *   GET  /explore/players?...                   -> listNflPlayersForAdmin
 *   GET  /explore/players/:id?seasonId=         -> getNflPlayerDetail
 *   POST /explore/players/:id/recompute-spp     -> recomputePlayerSpp
 *   POST /explore/players/:id/re-derive-bb      -> reDerivePlayerBb
 *
 * Toutes sous authUser + adminOnly (montees au niveau du router parent).
 */

import { Router } from "express";
import { z } from "zod";

import { adminOnly } from "../middleware/adminOnly";
import { authUser } from "../middleware/authUser";
import { validateQuery } from "../middleware/validate";
import {
  getNflPlayerDetail,
  getNflTeamDetail,
  listNflPlayersForAdmin,
  listNflSeasonsForAdmin,
  listNflTeamsForAdmin,
  recomputePlayerSpp,
  reDerivePlayerBb,
} from "../services/nfl-fantasy-admin-explorer";
import { sendNflError } from "../utils/nfl-error-mapper";
import { serverLog } from "../utils/server-log";

const router = Router();
router.use(authUser, adminOnly);

// ────────────────────────────────────────────────────────────────────
// Schemas query
// ────────────────────────────────────────────────────────────────────

const seasonIdParam = z.string().regex(/^\d{4}$/).optional();

const teamsListSchema = z.object({
  seasonId: seasonIdParam,
});

const teamDetailSchema = z.object({
  seasonId: seasonIdParam,
});

const playersListSchema = z.object({
  seasonId: seasonIdParam,
  teamCode: z.string().min(2).max(4).optional(),
  bbPosition: z.string().min(1).max(20).optional(),
  nflPosition: z.string().min(1).max(20).optional(),
  status: z.enum(["active", "ir", "retired", "suspended"]).optional(),
  search: z.string().min(1).max(64).optional(),
  page: z.coerce.number().int().min(1).max(10000).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
});

const playerDetailSchema = z.object({
  seasonId: seasonIdParam,
});

// ────────────────────────────────────────────────────────────────────
// Seasons
// ────────────────────────────────────────────────────────────────────

router.get("/explore/seasons", async (_req, res) => {
  try {
    const out = await listNflSeasonsForAdmin();
    res.json({ seasons: out });
  } catch (err) {
    if (!sendNflError(res, err)) {
      serverLog.error("[admin-nfl-fantasy-explorer] seasons failed", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
});

// ────────────────────────────────────────────────────────────────────
// Teams
// ────────────────────────────────────────────────────────────────────

router.get(
  "/explore/teams",
  validateQuery(teamsListSchema),
  async (req, res) => {
    try {
      const q = req.query as z.infer<typeof teamsListSchema>;
      const out = await listNflTeamsForAdmin({ seasonId: q.seasonId });
      res.json({ teams: out });
    } catch (err) {
      if (!sendNflError(res, err)) {
        serverLog.error("[admin-nfl-fantasy-explorer] teams failed", err);
        res.status(500).json({ error: "Erreur serveur" });
      }
    }
  },
);

router.get(
  "/explore/teams/:code",
  validateQuery(teamDetailSchema),
  async (req, res) => {
    try {
      const q = req.query as z.infer<typeof teamDetailSchema>;
      const detail = await getNflTeamDetail({
        code: req.params.code.toUpperCase(),
        seasonId: q.seasonId,
      });
      if (!detail) {
        res
          .status(404)
          .json({ error: `NflTeam ${req.params.code} introuvable`, code: "TEAM_NOT_FOUND" });
        return;
      }
      res.json(detail);
    } catch (err) {
      if (!sendNflError(res, err)) {
        serverLog.error("[admin-nfl-fantasy-explorer] team detail failed", err);
        res.status(500).json({ error: "Erreur serveur" });
      }
    }
  },
);

// ────────────────────────────────────────────────────────────────────
// Players
// ────────────────────────────────────────────────────────────────────

router.get(
  "/explore/players",
  validateQuery(playersListSchema),
  async (req, res) => {
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
        serverLog.error("[admin-nfl-fantasy-explorer] players failed", err);
        res.status(500).json({ error: "Erreur serveur" });
      }
    }
  },
);

router.get(
  "/explore/players/:id",
  validateQuery(playerDetailSchema),
  async (req, res) => {
    try {
      const q = req.query as z.infer<typeof playerDetailSchema>;
      const detail = await getNflPlayerDetail({
        id: req.params.id,
        seasonId: q.seasonId,
      });
      if (!detail) {
        res
          .status(404)
          .json({ error: `NflPlayer ${req.params.id} introuvable`, code: "PLAYER_NOT_FOUND" });
        return;
      }
      res.json(detail);
    } catch (err) {
      if (!sendNflError(res, err)) {
        serverLog.error("[admin-nfl-fantasy-explorer] player detail failed", err);
        res.status(500).json({ error: "Erreur serveur" });
      }
    }
  },
);

// ────────────────────────────────────────────────────────────────────
// Resync actions (idempotents)
// ────────────────────────────────────────────────────────────────────

router.post("/explore/players/:id/recompute-spp", async (req, res) => {
  try {
    const out = await recomputePlayerSpp(req.params.id);
    res.json(out);
  } catch (err) {
    if (!sendNflError(res, err)) {
      serverLog.error(
        "[admin-nfl-fantasy-explorer] recompute-spp failed",
        err,
      );
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
});

router.post("/explore/players/:id/re-derive-bb", async (req, res) => {
  try {
    const out = await reDerivePlayerBb(req.params.id);
    res.json(out);
  } catch (err) {
    if (!sendNflError(res, err)) {
      serverLog.error(
        "[admin-nfl-fantasy-explorer] re-derive-bb failed",
        err,
      );
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
});

export default router;
