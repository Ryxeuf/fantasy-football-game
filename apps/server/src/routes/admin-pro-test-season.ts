/**
 * Sprint test-leagues — endpoints admin pour les saisons Pro League de
 * test (`ProLeagueSeason.isTest = true`).
 *
 * Endpoints :
 *  - POST   /admin/pro-league/test-seasons      — cree une saison full
 *                                                 (rounds + matchs +
 *                                                  replays simules immediats)
 *  - GET    /admin/pro-league/test-seasons      — liste les test seasons
 *  - DELETE /admin/pro-league/test-seasons/:id  — delete cascade
 *
 * Auth : admin-only (cf. `adminOnly` middleware). Tous les endpoints
 * mutants tracent un audit log strict (`safeRecordAdminActionFromRequest`).
 */

import { Router } from "express";

import { prisma } from "../prisma";
import { authUser } from "../middleware/authUser";
import { adminOnly } from "../middleware/adminOnly";
import { validate } from "../middleware/validate";
import { adminCreateTestSeasonSchema } from "../schemas/admin.schemas";
import { serverLog } from "../utils/server-log";
import { safeRecordAdminActionFromRequest } from "../services/audit-log";
import type { AuthenticatedRequest } from "../middleware/authUser";
import {
  createTestSeason,
  deleteTestSeason,
  listTestSeasons,
  TestFactoryError,
} from "../services/pro-league-test-factory";

const router = Router();
router.use(authUser, adminOnly);

/** Mappe un code metier `TestFactoryError` au status HTTP approprie. */
function errorStatus(code: TestFactoryError["code"]): number {
  switch (code) {
    case "SEASON_NOT_FOUND":
    case "LEAGUE_NOT_FOUND":
      return 404;
    case "SEASON_NOT_TEST":
      return 409;
    case "INVALID_INPUT":
    case "NO_TEAMS_AVAILABLE":
      return 400;
    case "YEAR_RANGE_EXHAUSTED":
      return 422;
    default:
      return 500;
  }
}

/**
 * POST /admin/pro-league/test-seasons — cree une test season + simule
 * tous les matchs en serie. Repond une fois tous les replays persistes.
 *
 * Pour 16 teams (round-robin standard), c'est ~6s en hybrid driver et
 * potentiellement 2-4min en full driver. Pour des iterations rapides,
 * limiter `teamSlugs` a 4-8 teams (6-28 matchs).
 */
router.post(
  "/",
  validate(adminCreateTestSeasonSchema),
  async (req, res) => {
    try {
      const result = await createTestSeason(req.body);
      await safeRecordAdminActionFromRequest(
        prisma,
        req as AuthenticatedRequest,
        {
          action: "pro-test-season.create",
          entity: "ProLeagueSeason",
          entityId: result.seasonId,
          newValue: {
            year: result.year,
            label: result.label,
            teamCount: result.teamCount,
            roundsCreated: result.roundsCreated,
            matchesSimulated: result.matchesSimulated,
            matchesFailed: result.matchesFailed,
            engineVer: result.engineVer,
            driverKind: result.driverKind,
          },
        },
      );
      res.json(result);
    } catch (e) {
      if (e instanceof TestFactoryError) {
        return res.status(errorStatus(e.code)).json({ error: e.message });
      }
      serverLog.error(e);
      res
        .status(500)
        .json({ error: "Erreur lors de la creation de la test season" });
    }
  },
);

/** GET /admin/pro-league/test-seasons — liste decroissante par date. */
router.get("/", async (_req, res) => {
  try {
    const seasons = await listTestSeasons();
    res.json({ seasons });
  } catch (e) {
    serverLog.error(e);
    res
      .status(500)
      .json({ error: "Erreur lors de la lecture des test seasons" });
  }
});

/**
 * DELETE /admin/pro-league/test-seasons/:id — supprime la saison + ses
 * replays + cascade naturelle sur rounds/matches/standings/bet markets.
 *
 * Refuse explicitement si la saison cible n'a pas `isTest=true`
 * (`SEASON_NOT_TEST` -> 409). Defense-in-depth contre un id admin
 * pointant accidentellement sur une saison prod.
 */
router.delete("/:id", async (req, res) => {
  try {
    const result = await deleteTestSeason(req.params.id);
    await safeRecordAdminActionFromRequest(
      prisma,
      req as AuthenticatedRequest,
      {
        action: "pro-test-season.delete",
        entity: "ProLeagueSeason",
        entityId: result.seasonId,
        newValue: {
          deletedReplays: result.deletedReplays,
          deletedMatches: result.deletedMatches,
          deletedRounds: result.deletedRounds,
          deletedStandings: result.deletedStandings,
        },
      },
    );
    res.json(result);
  } catch (e) {
    if (e instanceof TestFactoryError) {
      return res.status(errorStatus(e.code)).json({ error: e.message });
    }
    serverLog.error(e);
    res
      .status(500)
      .json({ error: "Erreur lors de la suppression de la test season" });
  }
});

export default router;
