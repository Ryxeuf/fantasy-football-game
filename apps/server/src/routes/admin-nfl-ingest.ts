/**
 * Routes admin Phase 2.G — wrappers HTTP des services d'ingestion
 * `nfl-ingest.ts` (Phase 2.A) et `nfl-ingest-espn.ts` (Phase 2.B).
 *
 * Sous /admin/nfl/ingest, protege par authUser + adminOnly.
 *
 *   POST /seed-teams                 -> seedNflTeams
 *   POST /seed-season                -> seedNflSeason(seasonId)
 *   POST /week                       -> ingestNflverseWeek(seasonId, weekNumber)
 *   POST /gameday                    -> ingestEspnGameday(dateYmd)
 *   POST /rosters                    -> ingestEspnRosters(seasonId, teamCodes?)
 *
 * Tous les endpoints retournent le payload `IngestResult` ou `SeedResult`
 * du service avec status 200. Les erreurs typees `NflIngestError` sont
 * mappees via `nfl-error-mapper`.
 */

import { Router } from "express";
import { z } from "zod";

import { adminOnly } from "../middleware/adminOnly";
import { authUser } from "../middleware/authUser";
import { validate } from "../middleware/validate";
import {
  ingestNflverseWeek,
  seedNflSeason,
  seedNflTeams,
} from "../services/nfl-ingest";
import {
  ingestEspnGameday,
  ingestEspnRosters,
} from "../services/nfl-ingest-espn";
import { sendNflError } from "../utils/nfl-error-mapper";
import { serverLog } from "../utils/server-log";

const router = Router();
router.use(authUser, adminOnly);

const seedSeasonSchema = z.object({
  seasonId: z.string().regex(/^\d{4}$/),
});

const ingestWeekSchema = z.object({
  seasonId: z.string().regex(/^\d{4}$/),
  weekNumber: z.number().int().min(1).max(22),
});

const gamedaySchema = z.object({
  dateYmd: z.string().regex(/^\d{8}$/),
});

const rostersSchema = z.object({
  seasonId: z.string().regex(/^\d{4}$/),
  teamCodes: z.array(z.string().min(2).max(4)).optional(),
});

router.post("/seed-teams", async (_req, res) => {
  try {
    const result = await seedNflTeams();
    res.json(result);
  } catch (err) {
    if (!sendNflError(res, err)) {
      serverLog.error("[admin-nfl-ingest] seed-teams failed", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
});

router.post("/seed-season", validate(seedSeasonSchema), async (req, res) => {
  try {
    const { seasonId }: z.infer<typeof seedSeasonSchema> = req.body;
    await seedNflSeason(seasonId);
    res.json({ seasonId, status: "seeded" });
  } catch (err) {
    if (!sendNflError(res, err)) {
      serverLog.error("[admin-nfl-ingest] seed-season failed", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
});

router.post("/week", validate(ingestWeekSchema), async (req, res) => {
  try {
    const opts: z.infer<typeof ingestWeekSchema> = req.body;
    const result = await ingestNflverseWeek(opts);
    res.json(result);
  } catch (err) {
    if (!sendNflError(res, err)) {
      serverLog.error("[admin-nfl-ingest] week failed", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
});

router.post("/gameday", validate(gamedaySchema), async (req, res) => {
  try {
    const { dateYmd }: z.infer<typeof gamedaySchema> = req.body;
    const result = await ingestEspnGameday({ dateYmd });
    res.json(result);
  } catch (err) {
    if (!sendNflError(res, err)) {
      serverLog.error("[admin-nfl-ingest] gameday failed", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
});

router.post("/rosters", validate(rostersSchema), async (req, res) => {
  try {
    const opts: z.infer<typeof rostersSchema> = req.body;
    const result = await ingestEspnRosters({
      seasonId: opts.seasonId,
      teamCodes: opts.teamCodes as never,
    });
    res.json(result);
  } catch (err) {
    if (!sendNflError(res, err)) {
      serverLog.error("[admin-nfl-ingest] rosters failed", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
});

export default router;
