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
import { validate, validateQuery } from "../middleware/validate";
import {
  getLeagueDetailForAdmin,
  getNflIngestRunForAdmin,
  getNflPlayerDetail,
  getNflTeamDetail,
  getWeekDetail,
  listAllLeaguesForAdmin,
  listNflIngestRunsForAdmin,
  listNflPlayersForAdmin,
  listNflSeasonsForAdmin,
  listNflTeamsForAdmin,
  listWeeksForSeason,
  reDerivePlayerBb,
  recomputePlayerSpp,
  recomputeSeasonSpp,
  reDeriveAllPlayersBb,
} from "../services/nfl-fantasy-admin-explorer";
import { replaySeason } from "../services/nfl-fantasy-replay";
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

const ingestRunsListSchema = z.object({
  source: z.enum(["nflverse", "espn"]).optional(),
  status: z.enum(["success", "partial", "failed", "in_progress"]).optional(),
  weekId: z.string().min(1).max(32).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

const weeksListSchema = z.object({
  seasonId: z.string().regex(/^\d{4}$/),
});

const leaguesListSchema = z.object({
  seasonId: seasonIdParam,
  status: z.enum(["draft", "in_progress", "completed"]).optional(),
  type: z.enum(["public", "private"]).optional(),
  search: z.string().min(1).max(64).optional(),
  page: z.coerce.number().int().min(1).max(10000).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
});

const replayBodySchema = z.object({
  teamCount: z.number().int().min(2).max(16).optional(),
  playersPerEntry: z.number().int().min(11).max(30).optional(),
  fromWeek: z.number().int().min(1).max(22).optional(),
  toWeek: z.number().int().min(1).max(22).optional(),
  nameSuffix: z.string().min(1).max(64).optional(),
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

// ────────────────────────────────────────────────────────────────────
// Ingest runs (Phase 3.D)
// ────────────────────────────────────────────────────────────────────

router.get(
  "/explore/ingest-runs",
  validateQuery(ingestRunsListSchema),
  async (req, res) => {
    try {
      const q = req.query as z.infer<typeof ingestRunsListSchema>;
      const runs = await listNflIngestRunsForAdmin({
        source: q.source,
        status: q.status,
        weekId: q.weekId,
        limit: q.limit,
      });
      res.json({ runs });
    } catch (err) {
      if (!sendNflError(res, err)) {
        serverLog.error("[admin-nfl-fantasy-explorer] ingest-runs failed", err);
        res.status(500).json({ error: "Erreur serveur" });
      }
    }
  },
);

router.get("/explore/ingest-runs/:id", async (req, res) => {
  try {
    const run = await getNflIngestRunForAdmin(req.params.id);
    if (!run) {
      res
        .status(404)
        .json({ error: `NflIngestRun ${req.params.id} introuvable`, code: "NOT_FOUND" });
      return;
    }
    res.json(run);
  } catch (err) {
    if (!sendNflError(res, err)) {
      serverLog.error(
        "[admin-nfl-fantasy-explorer] ingest-run detail failed",
        err,
      );
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
});

// ────────────────────────────────────────────────────────────────────
// Weeks + games (Phase 3.D)
// ────────────────────────────────────────────────────────────────────

router.get(
  "/explore/weeks",
  validateQuery(weeksListSchema),
  async (req, res) => {
    try {
      const q = req.query as z.infer<typeof weeksListSchema>;
      const weeks = await listWeeksForSeason(q.seasonId);
      res.json({ weeks });
    } catch (err) {
      if (!sendNflError(res, err)) {
        serverLog.error("[admin-nfl-fantasy-explorer] weeks failed", err);
        res.status(500).json({ error: "Erreur serveur" });
      }
    }
  },
);

router.get("/explore/weeks/:weekId", async (req, res) => {
  try {
    const detail = await getWeekDetail(req.params.weekId);
    if (!detail) {
      res
        .status(404)
        .json({ error: `NflWeek ${req.params.weekId} introuvable`, code: "WEEK_NOT_FOUND" });
      return;
    }
    res.json(detail);
  } catch (err) {
    if (!sendNflError(res, err)) {
      serverLog.error("[admin-nfl-fantasy-explorer] week detail failed", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
});

// ────────────────────────────────────────────────────────────────────
// Leagues admin (Phase 3.D)
// ────────────────────────────────────────────────────────────────────

router.get(
  "/explore/leagues",
  validateQuery(leaguesListSchema),
  async (req, res) => {
    try {
      const q = req.query as z.infer<typeof leaguesListSchema>;
      const out = await listAllLeaguesForAdmin({
        seasonId: q.seasonId,
        status: q.status,
        type: q.type,
        search: q.search,
        page: q.page,
        pageSize: q.pageSize,
      });
      res.json(out);
    } catch (err) {
      if (!sendNflError(res, err)) {
        serverLog.error("[admin-nfl-fantasy-explorer] leagues failed", err);
        res.status(500).json({ error: "Erreur serveur" });
      }
    }
  },
);

router.get("/explore/leagues/:id", async (req, res) => {
  try {
    const detail = await getLeagueDetailForAdmin(req.params.id);
    if (!detail) {
      res
        .status(404)
        .json({ error: `NflFantasyLeague ${req.params.id} introuvable`, code: "LEAGUE_NOT_FOUND" });
      return;
    }
    res.json(detail);
  } catch (err) {
    if (!sendNflError(res, err)) {
      serverLog.error("[admin-nfl-fantasy-explorer] league detail failed", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
});

// ────────────────────────────────────────────────────────────────────
// Bulk actions saison (Phase 3.F)
// ────────────────────────────────────────────────────────────────────

router.post("/explore/seasons/:id/recompute-spp", async (req, res) => {
  try {
    const out = await recomputeSeasonSpp(req.params.id);
    res.json(out);
  } catch (err) {
    if (!sendNflError(res, err)) {
      serverLog.error(
        "[admin-nfl-fantasy-explorer] recompute-season-spp failed",
        err,
      );
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
});

router.post("/explore/players/re-derive-bb-bulk", async (_req, res) => {
  try {
    const out = await reDeriveAllPlayersBb();
    res.json(out);
  } catch (err) {
    if (!sendNflError(res, err)) {
      serverLog.error(
        "[admin-nfl-fantasy-explorer] re-derive-bb-bulk failed",
        err,
      );
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
});

// ────────────────────────────────────────────────────────────────────
// Replay saison (Phase 3.G)
// ────────────────────────────────────────────────────────────────────

router.post(
  "/explore/seasons/:id/replay",
  validate(replayBodySchema),
  async (req, res) => {
    try {
      const body = req.body as z.infer<typeof replayBodySchema>;
      const out = await replaySeason({
        seasonId: req.params.id,
        teamCount: body.teamCount,
        playersPerEntry: body.playersPerEntry,
        fromWeek: body.fromWeek,
        toWeek: body.toWeek,
        nameSuffix: body.nameSuffix,
      });
      res.json(out);
    } catch (err) {
      if (!sendNflError(res, err)) {
        serverLog.error("[admin-nfl-fantasy-explorer] replay failed", err);
        res.status(500).json({ error: "Erreur serveur" });
      }
    }
  },
);

export default router;
