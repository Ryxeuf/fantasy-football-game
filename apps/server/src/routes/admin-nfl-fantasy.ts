/**
 * Routes admin Phase 2.G pour les operations mass-action du module
 * NFL Fantasy : lock weekly lineups, generate matchups, settle.
 *
 * Sous /admin/nfl-fantasy, authUser + adminOnly.
 *
 *   POST /lock-lineups               body { weekId } -> lockLineups
 *   POST /generate-matchups          body { leagueId, weekId } -> generateMatchups
 *   POST /settle-week                body { leagueId, weekId } -> settleNflFantasyWeek
 *   POST /seed-rerolls               body { entryId, count? } -> seedStartingRerolls
 */

import { Router } from "express";
import { z } from "zod";

import { adminOnly } from "../middleware/adminOnly";
import { authUser } from "../middleware/authUser";
import { validate } from "../middleware/validate";
import { lockLineups } from "../services/nfl-fantasy-lineup";
import {
  generateMatchups,
  settleNflFantasyWeek,
} from "../services/nfl-fantasy-scoring";
import { seedStartingRerolls } from "../services/nfl-fantasy-mercato";
import {
  autoFillRosters,
  finalizeLeague,
  getDraftStats,
  MAX_PLAYERS_PER_ENTRY,
  MIN_PLAYERS_PER_ENTRY,
} from "../services/nfl-fantasy-draft";
import { sendNflError } from "../utils/nfl-error-mapper";
import { serverLog } from "../utils/server-log";

const router = Router();
router.use(authUser, adminOnly);

const lockSchema = z.object({ weekId: z.string().min(1) });
const matchupsSchema = z.object({
  leagueId: z.string().min(1),
  weekId: z.string().min(1),
});
const settleSchema = matchupsSchema;
const seedRerollsSchema = z.object({
  entryId: z.string().min(1),
  count: z.number().int().min(1).max(50).optional(),
});

const autoFillSchema = z.object({
  leagueId: z.string().min(1),
  playersPerEntry: z
    .number()
    .int()
    .min(MIN_PLAYERS_PER_ENTRY)
    .max(MAX_PLAYERS_PER_ENTRY)
    .optional(),
  seed: z.string().optional(),
});

const finalizeSchema = z.object({
  leagueId: z.string().min(1),
});

router.post("/lock-lineups", validate(lockSchema), async (req, res) => {
  try {
    const { weekId } = req.body as z.infer<typeof lockSchema>;
    const out = await lockLineups(weekId);
    res.json({ weekId, ...out });
  } catch (err) {
    if (!sendNflError(res, err)) {
      serverLog.error("[admin-nfl-fantasy] lock-lineups failed", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
});

router.post(
  "/generate-matchups",
  validate(matchupsSchema),
  async (req, res) => {
    try {
      const body = req.body as z.infer<typeof matchupsSchema>;
      const out = await generateMatchups(body);
      res.json(out);
    } catch (err) {
      if (!sendNflError(res, err)) {
        serverLog.error("[admin-nfl-fantasy] generate-matchups failed", err);
        res.status(500).json({ error: "Erreur serveur" });
      }
    }
  },
);

router.post("/settle-week", validate(settleSchema), async (req, res) => {
  try {
    const body = req.body as z.infer<typeof settleSchema>;
    const out = await settleNflFantasyWeek(body);
    res.json(out);
  } catch (err) {
    if (!sendNflError(res, err)) {
      serverLog.error("[admin-nfl-fantasy] settle-week failed", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
});

router.post(
  "/seed-rerolls",
  validate(seedRerollsSchema),
  async (req, res) => {
    try {
      const body = req.body as z.infer<typeof seedRerollsSchema>;
      const out = await seedStartingRerolls(body);
      res.json(out);
    } catch (err) {
      if (!sendNflError(res, err)) {
        serverLog.error("[admin-nfl-fantasy] seed-rerolls failed", err);
        res.status(500).json({ error: "Erreur serveur" });
      }
    }
  },
);

router.post("/auto-fill-rosters", validate(autoFillSchema), async (req, res) => {
  try {
    const body = req.body as z.infer<typeof autoFillSchema>;
    const out = await autoFillRosters(body);
    res.json(out);
  } catch (err) {
    if (!sendNflError(res, err)) {
      serverLog.error("[admin-nfl-fantasy] auto-fill-rosters failed", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
});

router.post("/finalize-league", validate(finalizeSchema), async (req, res) => {
  try {
    const body = req.body as z.infer<typeof finalizeSchema>;
    const out = await finalizeLeague(body);
    res.json(out);
  } catch (err) {
    if (!sendNflError(res, err)) {
      serverLog.error("[admin-nfl-fantasy] finalize-league failed", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
});

router.get("/draft-stats/:leagueId", async (req, res) => {
  try {
    const out = await getDraftStats(req.params.leagueId);
    res.json(out);
  } catch (err) {
    if (!sendNflError(res, err)) {
      serverLog.error("[admin-nfl-fantasy] draft-stats failed", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
});

export default router;
