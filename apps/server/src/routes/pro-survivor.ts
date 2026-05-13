/**
 * Sprint Q lot Q.D.2 — Endpoints HTTP pour le Survivor Pick'em.
 *
 * Endpoints :
 *   GET   /pro-league/survivor/seasons/:id/overview       — round courant + my status (authUser optionnel)
 *   POST  /pro-league/survivor/picks                      — submit pick (auth)
 *   GET   /pro-league/survivor/seasons/:id/me             — mes entries pour la saison (auth)
 *   GET   /pro-league/survivor/seasons/:id/standings      — standings publics
 */

import { Router } from "express";
import { prisma } from "../prisma";
import { authUser, type AuthenticatedRequest } from "../middleware/authUser";
import { validate } from "../middleware/validate";
import { submitSurvivorPickSchema } from "../schemas/pro-survivor.schemas";
import { serverLog } from "../utils/server-log";
import {
  SurvivorError,
  submitSurvivorPick,
  getMySurvivorStatus,
  getSurvivorStandings,
} from "../services/pro-survivor";

const router = Router();

function errorStatus(code: SurvivorError["code"]): number {
  switch (code) {
    case "SEASON_NOT_FOUND":
    case "ROUND_NOT_FOUND":
      return 404;
    case "TEAM_NOT_IN_ROUND":
    case "TEAM_ALREADY_PICKED":
    case "ALREADY_ELIMINATED":
    case "ALREADY_PICKED_THIS_WEEK":
    case "ROUND_LOCKED":
      return 409;
    case "INVALID_INPUT":
      return 400;
    default:
      return 500;
  }
}

/**
 * GET /pro-league/survivor/seasons/:id/overview
 *
 * Endpoint public — retourne la saison + le round courant (premier
 * "pending") + ses matchs. Le client appelle `/me` separement pour
 * son statut personnel.
 */
router.get("/seasons/:id/overview", async (req, res) => {
  try {
    const season = (await prisma.proLeagueSeason.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        year: true,
        status: true,
        isTest: true,
      },
    })) as {
      id: string;
      year: number;
      status: string;
      isTest: boolean;
    } | null;
    if (!season || season.isTest) {
      return res.status(404).json({ error: "Saison introuvable" });
    }

    const currentRound = (await prisma.proLeagueRound.findFirst({
      where: { seasonId: req.params.id, status: "pending" },
      orderBy: { roundNumber: "asc" },
      select: {
        id: true,
        roundNumber: true,
        scheduledAt: true,
      },
    })) as {
      id: string;
      roundNumber: number;
      scheduledAt: Date | null;
    } | null;

    let currentMatches: Array<{
      id: string;
      homeTeamId: string;
      awayTeamId: string;
      scheduledAt: Date | null;
    }> = [];
    if (currentRound) {
      currentMatches = (await prisma.proLeagueMatch.findMany({
        where: { roundId: currentRound.id },
        select: {
          id: true,
          homeTeamId: true,
          awayTeamId: true,
          scheduledAt: true,
        },
        orderBy: { scheduledAt: "asc" },
      })) as Array<{
        id: string;
        homeTeamId: string;
        awayTeamId: string;
        scheduledAt: Date | null;
      }>;
    }

    res.json({
      season,
      currentRound,
      currentMatches,
    });
  } catch (e) {
    serverLog.error(e);
    res.status(500).json({ error: "Erreur lors de la lecture" });
  }
});

/** GET /pro-league/survivor/seasons/:id/standings — standings publics. */
router.get("/seasons/:id/standings", async (req, res) => {
  try {
    const entries = await getSurvivorStandings(req.params.id);
    res.json({ entries });
  } catch (e) {
    serverLog.error(e);
    res.status(500).json({ error: "Erreur lors de la lecture" });
  }
});

// === Endpoints auth ===
router.use(authUser);

/** POST /pro-league/survivor/picks — submit pick. */
router.post(
  "/picks",
  validate(submitSurvivorPickSchema),
  async (req, res) => {
    try {
      const auth = req as AuthenticatedRequest;
      const userId = auth.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifie" });
      }
      const { seasonId, roundId, teamId } = req.body as {
        seasonId: string;
        roundId: string;
        teamId: string;
      };
      const result = await submitSurvivorPick({
        seasonId,
        userId,
        roundId,
        teamId,
      });
      res.status(201).json(result);
    } catch (e) {
      if (e instanceof SurvivorError) {
        return res.status(errorStatus(e.code)).json({ error: e.message });
      }
      serverLog.error(e);
      res.status(500).json({ error: "Erreur lors du pick" });
    }
  },
);

/** GET /pro-league/survivor/seasons/:id/me — mon statut + entries. */
router.get("/seasons/:id/me", async (req, res) => {
  try {
    const auth = req as AuthenticatedRequest;
    const userId = auth.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    const status = await getMySurvivorStatus(req.params.id, userId);
    res.json(status);
  } catch (e) {
    serverLog.error(e);
    res.status(500).json({ error: "Erreur lors de la lecture" });
  }
});

export default router;
