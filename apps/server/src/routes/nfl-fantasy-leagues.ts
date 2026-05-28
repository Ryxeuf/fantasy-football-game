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
import { validate, validateQuery } from "../middleware/validate";
import {
  createLeague,
  deleteLeague,
  getLeague,
  joinLeague,
  leaveLeague,
  listLeaguesForUser,
  listPublicLeagues,
  NflFantasyLeagueError,
  populateLeagueWithTestCoaches,
  updateLeague,
  LEAGUE_SIZE_MAX,
  LEAGUE_SIZE_MIN,
  DRAFT_BUDGET_MAX,
  DRAFT_BUDGET_MIN,
} from "../services/nfl-fantasy-league";
import { finalizeLeague } from "../services/nfl-fantasy-draft";
import { lockLineups } from "../services/nfl-fantasy-lineup";
import {
  generateMatchups,
  settleNflFantasyWeek,
} from "../services/nfl-fantasy-scoring";
import { ingestNflverseWeek } from "../services/nfl-ingest";
import { prisma } from "../prisma";
import {
  getLeagueStandings,
  listMatchupsForWeek,
} from "../services/nfl-fantasy-scoring";
import { sendNflError } from "../utils/nfl-error-mapper";
import { serverLog } from "../utils/server-log";
import { isEnabled, NUFFLE_COACH_TEST_FLAG } from "../services/featureFlags";

const router = Router();
router.use(authUser);

const createLeagueSchema = z.object({
  name: z.string().min(3).max(50),
  teamName: z.string().min(3).max(50),
  seasonId: z.string().min(1),
  size: z.number().int().min(LEAGUE_SIZE_MIN).max(LEAGUE_SIZE_MAX).optional(),
  type: z.enum(["public", "private"]).optional(),
  draftMode: z.enum(["snake", "auction", "free"]).optional(),
  draftBudget: z
    .number()
    .int()
    .min(DRAFT_BUDGET_MIN)
    .max(DRAFT_BUDGET_MAX)
    .optional(),
  /**
   * Optionnel : id du cycle (NflFantasySeasonCycle) sur lequel adosser
   * le championnat. Si omis, le service applique snap-to-next-window.
   */
  cycleId: z.string().min(1).optional(),
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
    const authReq = req as AuthenticatedRequest;
    // Bypass snap-to-next-window pour les comptes test (cycle deja
    // demarre / closed accepte). Decide cote route, jamais expose dans
    // le body API : on consulte le flag pour cet utilisateur.
    const allowAnyCycle = await isEnabled(NUFFLE_COACH_TEST_FLAG, userId(authReq), {
      roles: authReq.user?.roles,
    });
    const lg = await createLeague({
      ownerId: userId(authReq),
      ...body,
      allowAnyCycle,
    });
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

// IMPORTANT : ce handler doit etre defini AVANT /:id, sinon Express
// matche "public" comme un id.
router.get("/public", async (req, res) => {
  try {
    const leagues = await listPublicLeagues({ userId: userId(req) });
    res.json({ leagues });
  } catch (err) {
    serverLog.error("[nfl-fantasy-leagues] list-public failed", err);
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

// Helper test : remplir le championnat avec des coachs de test pour
// pouvoir simuler un mercato / matchups complets sans avoir a faire
// rejoindre 9 comptes manuellement. Gate par feature flag.
router.post("/:id/populate-test-coaches", async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const flagOn = await isEnabled(NUFFLE_COACH_TEST_FLAG, userId(authReq), {
      roles: authReq.user?.roles,
    });
    if (!flagOn) {
      res
        .status(403)
        .json({ error: "Test mode requis", code: "TEST_MODE_REQUIRED" });
      return;
    }
    const out = await populateLeagueWithTestCoaches({
      leagueId: req.params.id,
      userId: userId(authReq),
    });
    res.json(out);
  } catch (err) {
    if (!sendNflError(res, err)) {
      serverLog.error("[nfl-fantasy-leagues] populate failed", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
});

// ──────────────────────────────────────────────────────────────────
// Lifecycle : demarrer la saison (draft -> in_progress)
// ──────────────────────────────────────────────────────────────────

/**
 * POST /api/nfl-fantasy/leagues/:id/start-season
 *
 * Transitionne le championnat de "draft" vers "in_progress". Owner
 * uniquement. Une fois la saison demarree :
 *   - les coachs peuvent configurer leur lineup hebdomadaire
 *   - les matchups sont generes par les ticks cron settle
 *   - le mercato ne peut plus etre relance manuellement
 *
 * Reutilise `finalizeLeague` (seed des rerolls de demarrage inclus).
 */
router.post("/:id/start-season", async (req, res) => {
  try {
    const league = await prisma.nflFantasyLeague.findUnique({
      where: { id: req.params.id },
      select: { ownerId: true },
    });
    if (!league) {
      res.status(404).json({ error: "League introuvable", code: "NOT_FOUND" });
      return;
    }
    if (league.ownerId !== userId(req)) {
      throw new NflFantasyLeagueError("NOT_OWNER", "Action reservee a l'owner");
    }
    const out = await finalizeLeague({ leagueId: req.params.id });
    res.json(out);
  } catch (err) {
    if (!sendNflError(res, err)) {
      serverLog.error("[nfl-fantasy-leagues] start-season failed", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
});

// ──────────────────────────────────────────────────────────────────
// Matchups + standings (read-only views)
// ──────────────────────────────────────────────────────────────────

const matchupsQuerySchema = z.object({
  weekId: z.string().min(1),
});

router.get(
  "/:id/matchups",
  validateQuery(matchupsQuerySchema),
  async (req, res) => {
    try {
      const { weekId } = req.query as unknown as z.infer<typeof matchupsQuerySchema>;
      const matchups = await listMatchupsForWeek({
        leagueId: req.params.id,
        weekId,
      });
      res.json({ matchups });
    } catch (err) {
      if (!sendNflError(res, err)) {
        serverLog.error("[nfl-fantasy-leagues] matchups failed", err);
        res.status(500).json({ error: "Erreur serveur" });
      }
    }
  },
);

router.get("/:id/standings", async (req, res) => {
  try {
    const standings = await getLeagueStandings(req.params.id);
    res.json({ standings });
  } catch (err) {
    if (!sendNflError(res, err)) {
      serverLog.error("[nfl-fantasy-leagues] standings failed", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
});

// ──────────────────────────────────────────────────────────────────
// Mode test : force-trigger des taches habituellement automatiques
// (cron). Gate : owner du championnat + feature flag nuffle_coach_test.
// Permet de derouler une saison complete sur un cycle passe sans
// attendre les fenetres temporelles des ticks.
// ──────────────────────────────────────────────────────────────────

async function assertOwnerAndTestMode(
  req: AuthenticatedRequest,
  leagueId: string,
): Promise<{ ownerId: string; seasonId: string; cycleId: string | null }> {
  const flagOn = await isEnabled(NUFFLE_COACH_TEST_FLAG, userId(req), {
    roles: req.user?.roles,
  });
  if (!flagOn) {
    throw new NflFantasyLeagueError(
      "NOT_OWNER",
      "Mode test requis (feature flag nuffle_coach_test)",
    );
  }
  const league = await prisma.nflFantasyLeague.findUnique({
    where: { id: leagueId },
    select: { ownerId: true, seasonId: true, cycleId: true },
  });
  if (!league) {
    throw new NflFantasyLeagueError("NOT_FOUND", "League introuvable");
  }
  if (league.ownerId !== userId(req)) {
    throw new NflFantasyLeagueError("NOT_OWNER", "Action reservee a l'owner");
  }
  return league;
}

const weekIdBodySchema = z.object({
  weekId: z.string().min(1),
});

/**
 * GET /:id/test/weeks
 * Liste les NflWeek du cycle adosse au championnat. Permet a la UI
 * de Mode test de proposer un picker semaine.
 */
router.get("/:id/test/weeks", async (req, res) => {
  try {
    const league = await assertOwnerAndTestMode(
      req as AuthenticatedRequest,
      req.params.id,
    );
    if (!league.cycleId) {
      res.json({ weeks: [] });
      return;
    }
    const cycle = await prisma.nflFantasySeasonCycle.findUnique({
      where: { id: league.cycleId },
      select: { startWeek: true, endWeek: true },
    });
    if (!cycle) {
      res.json({ weeks: [] });
      return;
    }
    const weeks = await prisma.nflWeek.findMany({
      where: {
        seasonId: league.seasonId,
        weekNumber: { gte: cycle.startWeek, lte: cycle.endWeek },
      },
      orderBy: { weekNumber: "asc" },
      select: {
        id: true,
        weekNumber: true,
        startDate: true,
        endDate: true,
        isPlayoffs: true,
      },
    });
    res.json({ weeks });
  } catch (err) {
    if (!sendNflError(res, err)) {
      serverLog.error("[nfl-fantasy-leagues] test/weeks failed", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
});

/**
 * POST /:id/test/ingest-stats
 * Force pull nflverse pour la semaine donnee. Idempotent (upsert).
 */
router.post(
  "/:id/test/ingest-stats",
  validate(weekIdBodySchema),
  async (req, res) => {
    try {
      const league = await assertOwnerAndTestMode(
        req as AuthenticatedRequest,
        req.params.id,
      );
      const { weekId } = req.body as z.infer<typeof weekIdBodySchema>;
      const week = await prisma.nflWeek.findUnique({
        where: { id: weekId },
        select: { seasonId: true, weekNumber: true },
      });
      if (!week || week.seasonId !== league.seasonId) {
        res.status(404).json({
          error: "Semaine introuvable dans la saison du championnat",
          code: "WEEK_NOT_FOUND",
        });
        return;
      }
      const result = await ingestNflverseWeek({
        seasonId: week.seasonId,
        weekNumber: week.weekNumber,
      });
      res.json(result);
    } catch (err) {
      if (!sendNflError(res, err)) {
        serverLog.error("[nfl-fantasy-leagues] test/ingest-stats failed", err);
        res.status(500).json({ error: "Erreur serveur" });
      }
    }
  },
);

/**
 * POST /:id/test/lock-lineups
 * Lock toutes les lineups de la semaine. Idempotent.
 */
router.post(
  "/:id/test/lock-lineups",
  validate(weekIdBodySchema),
  async (req, res) => {
    try {
      await assertOwnerAndTestMode(req as AuthenticatedRequest, req.params.id);
      const { weekId } = req.body as z.infer<typeof weekIdBodySchema>;
      const result = await lockLineups(weekId);
      res.json(result);
    } catch (err) {
      if (!sendNflError(res, err)) {
        serverLog.error("[nfl-fantasy-leagues] test/lock-lineups failed", err);
        res.status(500).json({ error: "Erreur serveur" });
      }
    }
  },
);

/**
 * POST /:id/test/generate-matchups
 * Genere les matchups (round-robin) pour la semaine. Idempotent.
 */
router.post(
  "/:id/test/generate-matchups",
  validate(weekIdBodySchema),
  async (req, res) => {
    try {
      await assertOwnerAndTestMode(req as AuthenticatedRequest, req.params.id);
      const { weekId } = req.body as z.infer<typeof weekIdBodySchema>;
      const result = await generateMatchups({
        leagueId: req.params.id,
        weekId,
      });
      res.json(result);
    } catch (err) {
      if (!sendNflError(res, err)) {
        serverLog.error(
          "[nfl-fantasy-leagues] test/generate-matchups failed",
          err,
        );
        res.status(500).json({ error: "Erreur serveur" });
      }
    }
  },
);

/**
 * POST /:id/test/settle-week
 * Settle la semaine : calcule SPP, applique multipliers, persiste
 * matchup scores + winners. Idempotent.
 */
router.post(
  "/:id/test/settle-week",
  validate(weekIdBodySchema),
  async (req, res) => {
    try {
      await assertOwnerAndTestMode(req as AuthenticatedRequest, req.params.id);
      const { weekId } = req.body as z.infer<typeof weekIdBodySchema>;
      const result = await settleNflFantasyWeek({
        leagueId: req.params.id,
        weekId,
      });
      res.json(result);
    } catch (err) {
      if (!sendNflError(res, err)) {
        serverLog.error("[nfl-fantasy-leagues] test/settle-week failed", err);
        res.status(500).json({ error: "Erreur serveur" });
      }
    }
  },
);

export default router;
