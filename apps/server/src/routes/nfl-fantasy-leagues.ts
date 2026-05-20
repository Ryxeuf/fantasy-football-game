/**
 * Routes user-facing Phase 2.G — wrappers HTTP du service
 * `nfl-fantasy-league.ts` (Phase 2.C).
 *
 * Sous /api/nfl-fantasy/leagues, protege par authUser.
 *
 *   POST /                        createLeague
 *   GET  /                        listLeaguesForUser (current user)
 *   GET  /:id                     getLeague
 *   PATCH /:id                    updateLeague
 *   DELETE /:id                   deleteLeague
 *   POST /:id/join                joinLeague (par id, leagues publiques)
 *   POST /join-by-code            joinLeague (par inviteCode)
 *   POST /:id/leave               leaveLeague
 */

import { Router } from "express";
import { z } from "zod";

import { authUser, type AuthenticatedRequest } from "../middleware/authUser";
import { validate } from "../middleware/validate";
import {
  createLeague,
  deleteLeague,
  getLeague,
  joinLeague,
  leaveLeague,
  listLeaguesForUser,
  updateLeague,
  LEAGUE_SIZE_MAX,
  LEAGUE_SIZE_MIN,
} from "../services/nfl-fantasy-league";
import { sendNflError } from "../utils/nfl-error-mapper";
import { serverLog } from "../utils/server-log";

const router = Router();
router.use(authUser);

const createLeagueSchema = z.object({
  name: z.string().min(3).max(50),
  teamName: z.string().min(3).max(50),
  seasonId: z.string().min(1),
  size: z.number().int().min(LEAGUE_SIZE_MIN).max(LEAGUE_SIZE_MAX).optional(),
  type: z.enum(["public", "private"]).optional(),
  draftMode: z.enum(["snake", "auction", "free"]).optional(),
});

const updateLeagueSchema = z.object({
  name: z.string().min(3).max(50).optional(),
  type: z.enum(["public", "private"]).optional(),
  size: z.number().int().min(LEAGUE_SIZE_MIN).max(LEAGUE_SIZE_MAX).optional(),
});

const joinByIdSchema = z.object({
  teamName: z.string().min(3).max(50),
});

const joinByCodeSchema = z.object({
  inviteCode: z.string().min(4).max(16),
  teamName: z.string().min(3).max(50),
});

function userId(req: AuthenticatedRequest): string {
  return req.user!.id;
}

router.post("/", validate(createLeagueSchema), async (req, res) => {
  try {
    const body = req.body as z.infer<typeof createLeagueSchema>;
    const lg = await createLeague({ ownerId: userId(req), ...body });
    res.status(201).json(lg);
  } catch (err) {
    if (!sendNflError(res, err)) {
      serverLog.error("[nfl-fantasy-leagues] create failed", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
});

router.get("/", async (req, res) => {
  try {
    const leagues = await listLeaguesForUser(userId(req));
    res.json({ leagues });
  } catch (err) {
    serverLog.error("[nfl-fantasy-leagues] list failed", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const lg = await getLeague(req.params.id);
    res.json(lg);
  } catch (err) {
    if (!sendNflError(res, err)) {
      serverLog.error("[nfl-fantasy-leagues] get failed", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
});

router.patch("/:id", validate(updateLeagueSchema), async (req, res) => {
  try {
    const body = req.body as z.infer<typeof updateLeagueSchema>;
    const lg = await updateLeague({
      leagueId: req.params.id,
      userId: userId(req),
      ...body,
    });
    res.json(lg);
  } catch (err) {
    if (!sendNflError(res, err)) {
      serverLog.error("[nfl-fantasy-leagues] update failed", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await deleteLeague({ leagueId: req.params.id, userId: userId(req) });
    res.status(204).end();
  } catch (err) {
    if (!sendNflError(res, err)) {
      serverLog.error("[nfl-fantasy-leagues] delete failed", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
});

router.post("/:id/join", validate(joinByIdSchema), async (req, res) => {
  try {
    const { teamName } = req.body as z.infer<typeof joinByIdSchema>;
    const entry = await joinLeague({
      userId: userId(req),
      teamName,
      leagueId: req.params.id,
    });
    res.status(201).json(entry);
  } catch (err) {
    if (!sendNflError(res, err)) {
      serverLog.error("[nfl-fantasy-leagues] join failed", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
});

router.post("/join-by-code", validate(joinByCodeSchema), async (req, res) => {
  try {
    const { inviteCode, teamName } = req.body as z.infer<typeof joinByCodeSchema>;
    const entry = await joinLeague({ userId: userId(req), teamName, inviteCode });
    res.status(201).json(entry);
  } catch (err) {
    if (!sendNflError(res, err)) {
      serverLog.error("[nfl-fantasy-leagues] join-by-code failed", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
});

router.post("/:id/leave", async (req, res) => {
  try {
    await leaveLeague({ leagueId: req.params.id, userId: userId(req) });
    res.status(204).end();
  } catch (err) {
    if (!sendNflError(res, err)) {
      serverLog.error("[nfl-fantasy-leagues] leave failed", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
});

export default router;
