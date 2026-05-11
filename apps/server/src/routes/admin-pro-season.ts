/**
 * Lot P.B.3 — Endpoints admin pour la season factory Pro League.
 *
 * Endpoints :
 *  - GET   /admin/pro-league/seasons                       — liste des saisons + counters
 *  - POST  /admin/pro-league/seasons/clone                 — clone une saison (new year)
 *  - POST  /admin/pro-league/seasons/:id/regenerate-schedule
 *  - POST  /admin/pro-league/seasons/:id/reset-standings
 *  - POST  /admin/pro-league/seasons/:id/cancel
 *  - POST  /admin/pro-league/matches/:id/force-forfeit     — { winnerSide }
 *
 * Tous les endpoints qui modifient l'etat tracent un audit log strict.
 * Les erreurs `SeasonFactoryError` sont mappees au HTTP status correspondant.
 */

import { Router } from "express";
import { prisma } from "../prisma";
import { authUser } from "../middleware/authUser";
import { adminOnly } from "../middleware/adminOnly";
import { validate } from "../middleware/validate";
import {
  adminCloneSeasonSchema,
  adminCreateSeasonSchema,
  adminForceForfeitSchema,
} from "../schemas/admin.schemas";
import { serverLog } from "../utils/server-log";
import { safeRecordAdminActionFromRequest } from "../services/audit-log";
import type { AuthenticatedRequest } from "../middleware/authUser";
import {
  cloneSeason,
  createSeason,
  resetStandings,
  cancelSeason,
  forceForfeit,
  SeasonFactoryError,
} from "../services/pro-season-factory";
import {
  buildProLeagueSchedule,
  regenerateProLeagueSchedule,
} from "../services/pro-league-scheduler";
import { simulateProMatch } from "../services/pro-league-sim-runner";

const router = Router();

router.use(authUser, adminOnly);

/** Mappe une `SeasonFactoryError` au status HTTP approprie. */
function errorStatus(code: SeasonFactoryError["code"]): number {
  switch (code) {
    case "SEASON_NOT_FOUND":
    case "MATCH_NOT_FOUND":
    case "LEAGUE_NOT_FOUND":
      return 404;
    case "MATCH_ALREADY_COMPLETED":
    case "DUPLICATE_YEAR":
    case "SEASON_HAS_RESULTS":
      return 409;
    case "INVALID_INPUT":
      return 400;
    case "NO_TEAMS":
      return 422;
    default:
      return 500;
  }
}

/**
 * GET /admin/pro-league/seasons — liste des saisons.
 *
 * Pour chaque saison : id, leagueId, year, status, driverKind, engineVer,
 * + compteurs `roundCount`, `matchCount`, `playedCount`. Ordre :
 * (status asc puis year desc) → in_progress / scheduled en haut.
 */
router.get("/seasons", async (_req, res) => {
  try {
    const seasons = (await prisma.proLeagueSeason.findMany({
      select: {
        id: true,
        leagueId: true,
        year: true,
        status: true,
        driverKind: true,
        engineVer: true,
        startsAt: true,
        endsAt: true,
        createdAt: true,
        _count: { select: { rounds: true, matches: true } },
      },
      orderBy: [{ status: "asc" }, { year: "desc" }],
    })) as Array<{
      id: string;
      leagueId: string;
      year: number;
      status: string;
      driverKind: string;
      engineVer: string;
      startsAt: Date | null;
      endsAt: Date | null;
      createdAt: Date;
      _count: { rounds: number; matches: number };
    }>;

    // Comptage des matchs joues (status != 'scheduled') en batch via groupBy.
    const seasonIds = seasons.map((s) => s.id);
    const playedAgg = seasonIds.length
      ? ((await prisma.proLeagueMatch.groupBy({
          by: ["seasonId"],
          where: { seasonId: { in: seasonIds }, NOT: { status: "scheduled" } },
          _count: { _all: true },
        })) as Array<{ seasonId: string; _count: { _all: number } }>)
      : [];
    const playedBySeason = new Map<string, number>();
    for (const row of playedAgg) {
      playedBySeason.set(row.seasonId, row._count._all);
    }

    res.json({
      seasons: seasons.map((s) => ({
        id: s.id,
        leagueId: s.leagueId,
        year: s.year,
        status: s.status,
        driverKind: s.driverKind,
        engineVer: s.engineVer,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        roundCount: s._count.rounds,
        matchCount: s._count.matches,
        playedCount: playedBySeason.get(s.id) ?? 0,
        createdAt: s.createdAt,
      })),
    });
  } catch (e) {
    serverLog.error(e);
    res.status(500).json({ error: "Erreur lors de la lecture des saisons" });
  }
});

/**
 * GET /admin/pro-league/seasons/:id — detail saison.
 *
 * Retourne : season meta + rounds (1..N avec status, scheduledAt et
 * counters matches) + standings ordonnees par points desc.
 */
router.get("/seasons/:id", async (req, res) => {
  try {
    const season = await prisma.proLeagueSeason.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        leagueId: true,
        year: true,
        status: true,
        driverKind: true,
        engineVer: true,
        startsAt: true,
        endsAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!season) {
      return res.status(404).json({ error: "Saison introuvable" });
    }

    const [rounds, standings] = await Promise.all([
      prisma.proLeagueRound.findMany({
        where: { seasonId: req.params.id },
        select: {
          id: true,
          roundNumber: true,
          status: true,
          scheduledAt: true,
          startedAt: true,
          completedAt: true,
          _count: { select: { matches: true } },
        },
        orderBy: { roundNumber: "asc" },
      }),
      prisma.proLeagueStandings.findMany({
        where: { seasonId: req.params.id },
        select: {
          teamId: true,
          played: true,
          wins: true,
          draws: true,
          losses: true,
          points: true,
          tdFor: true,
          tdAgainst: true,
          team: { select: { name: true, slug: true, race: true } },
        },
        orderBy: [{ points: "desc" }, { tdFor: "desc" }],
      }),
    ]);

    res.json({ season, rounds, standings });
  } catch (e) {
    serverLog.error(e);
    res.status(500).json({ error: "Erreur lors du chargement de la saison" });
  }
});

/**
 * POST /admin/pro-league/seasons — cree une saison from scratch.
 *
 * `autoSchedule: true` enchaine `buildProLeagueSchedule` apres la
 * creation, ce qui genere les 15 rounds + 120 matches du round-robin
 * (en utilisant le defaut "prochain mardi 21h00 UTC" comme date du
 * round 1).
 */
router.post(
  "/seasons",
  validate(adminCreateSeasonSchema),
  async (req, res) => {
    try {
      const { autoSchedule = false, ...createInput } = req.body as {
        year: number;
        driverKind?: "hybrid" | "full";
        engineVer?: string;
        autoSchedule?: boolean;
      };
      const created = await createSeason(createInput);

      let scheduled: { roundsCreated: number; matchesCreated: number } | null =
        null;
      if (autoSchedule) {
        const build = await buildProLeagueSchedule({ seasonId: created.seasonId });
        scheduled = {
          roundsCreated: build.roundsCreated,
          matchesCreated: build.matchesCreated,
        };
      }

      await safeRecordAdminActionFromRequest(
        prisma,
        req as AuthenticatedRequest,
        {
          action: "pro-season.create",
          entity: "ProLeagueSeason",
          entityId: created.seasonId,
          newValue: {
            year: created.year,
            driverKind: created.driverKind,
            engineVer: created.engineVer,
            autoSchedule,
            scheduled,
          },
        },
      );

      res.json({ ...created, scheduled });
    } catch (e) {
      if (e instanceof SeasonFactoryError) {
        return res.status(errorStatus(e.code)).json({ error: e.message });
      }
      serverLog.error(e);
      res.status(500).json({ error: "Erreur lors de la creation de la saison" });
    }
  },
);

/**
 * POST /admin/pro-league/seasons/clone — clone une saison existante.
 *
 * Cree une nouvelle ProLeagueSeason avec une `year` distincte +
 * initialise les standings (zero) pour toutes les teams de la ligue.
 * Le schedule n'est PAS clone — appeler ensuite regenerate-schedule.
 */
router.post(
  "/seasons/clone",
  validate(adminCloneSeasonSchema),
  async (req, res) => {
    try {
      const result = await cloneSeason(req.body);
      await safeRecordAdminActionFromRequest(
        prisma,
        req as AuthenticatedRequest,
        {
          action: "pro-season.clone",
          entity: "ProLeagueSeason",
          entityId: result.newSeasonId,
          newValue: {
            fromSeasonId: result.fromSeasonId,
            year: result.year,
          },
        },
      );
      res.json(result);
    } catch (e) {
      if (e instanceof SeasonFactoryError) {
        return res.status(errorStatus(e.code)).json({ error: e.message });
      }
      serverLog.error(e);
      res.status(500).json({ error: "Erreur lors du clone" });
    }
  },
);

/** POST /admin/pro-league/seasons/:id/regenerate-schedule */
router.post("/seasons/:id/regenerate-schedule", async (req, res) => {
  try {
    const result = await regenerateProLeagueSchedule({ seasonId: req.params.id });
    await safeRecordAdminActionFromRequest(
      prisma,
      req as AuthenticatedRequest,
      {
        action: "pro-season.regenerate-schedule",
        entity: "ProLeagueSeason",
        entityId: req.params.id,
        newValue: {
          roundsCreated: result.roundsCreated,
          matchesCreated: result.matchesCreated,
        },
      },
    );
    res.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    // Le scheduler throw un Error standard avec un message lisible (ex.
    // "match deja simule"). On retourne 409 pour ces cas business + 500 sinon.
    if (msg.includes("introuvable")) {
      return res.status(404).json({ error: msg });
    }
    if (msg.includes("Impossible") || msg.includes("deja")) {
      return res.status(409).json({ error: msg });
    }
    serverLog.error(e);
    res.status(500).json({ error: msg });
  }
});

/** POST /admin/pro-league/seasons/:id/reset-standings */
router.post("/seasons/:id/reset-standings", async (req, res) => {
  try {
    const result = await resetStandings(req.params.id);
    await safeRecordAdminActionFromRequest(
      prisma,
      req as AuthenticatedRequest,
      {
        action: "pro-season.reset-standings",
        entity: "ProLeagueSeason",
        entityId: req.params.id,
        newValue: { resetCount: result.resetCount },
      },
    );
    res.json(result);
  } catch (e) {
    if (e instanceof SeasonFactoryError) {
      return res.status(errorStatus(e.code)).json({ error: e.message });
    }
    serverLog.error(e);
    res.status(500).json({ error: "Erreur lors du reset des standings" });
  }
});

/** POST /admin/pro-league/seasons/:id/cancel */
router.post("/seasons/:id/cancel", async (req, res) => {
  try {
    const result = await cancelSeason(req.params.id);
    await safeRecordAdminActionFromRequest(
      prisma,
      req as AuthenticatedRequest,
      {
        action: "pro-season.cancel",
        entity: "ProLeagueSeason",
        entityId: req.params.id,
        oldValue: { status: result.previousStatus },
        newValue: { status: "cancelled" },
      },
    );
    res.json(result);
  } catch (e) {
    if (e instanceof SeasonFactoryError) {
      return res.status(errorStatus(e.code)).json({ error: e.message });
    }
    serverLog.error(e);
    res.status(500).json({ error: "Erreur lors de l'annulation" });
  }
});

/** POST /admin/pro-league/matches/:id/force-forfeit — { winnerSide } */
router.post(
  "/matches/:id/force-forfeit",
  validate(adminForceForfeitSchema),
  async (req, res) => {
    try {
      const result = await forceForfeit({
        matchId: req.params.id,
        winnerSide: req.body.winnerSide,
      });
      await safeRecordAdminActionFromRequest(
        prisma,
        req as AuthenticatedRequest,
        {
          action: "pro-season.force-forfeit",
          entity: "ProLeagueMatch",
          entityId: req.params.id,
          oldValue: { status: result.previousStatus },
          newValue: { status: "completed", winnerSide: result.winnerSide },
        },
      );
      res.json(result);
    } catch (e) {
      if (e instanceof SeasonFactoryError) {
        return res.status(errorStatus(e.code)).json({ error: e.message });
      }
      serverLog.error(e);
      res.status(500).json({ error: "Erreur lors du forfait" });
    }
  },
);

/**
 * GET /admin/pro-league/seasons/:id/matches — liste des matchs d'une saison.
 *
 * Filtres optionnels : `?roundNumber=N` (1..15), `?status=scheduled|ready|
 * in_progress|completed|failed`. Ordre par roundNumber asc puis
 * scheduledAt asc pour faciliter le triage round-par-round.
 */
router.get("/seasons/:id/matches", async (req, res) => {
  try {
    const where: {
      seasonId: string;
      status?: string;
      round?: { roundNumber: number };
    } = { seasonId: req.params.id };

    const roundNumberRaw = req.query.roundNumber as string | undefined;
    if (roundNumberRaw !== undefined && roundNumberRaw !== "") {
      const n = parseInt(roundNumberRaw, 10);
      if (!Number.isInteger(n) || n < 1 || n > 50) {
        return res.status(400).json({ error: "roundNumber doit etre 1..50" });
      }
      where.round = { roundNumber: n };
    }
    const statusFilter = req.query.status as string | undefined;
    if (statusFilter) {
      where.status = statusFilter;
    }

    const matches = (await prisma.proLeagueMatch.findMany({
      where,
      select: {
        id: true,
        status: true,
        scheduledAt: true,
        simulatedAt: true,
        completedAt: true,
        scoreHome: true,
        scoreAway: true,
        outcome: true,
        isTest: true,
        replayId: true,
        homeTeam: { select: { name: true, slug: true } },
        awayTeam: { select: { name: true, slug: true } },
        round: { select: { roundNumber: true } },
      },
      orderBy: [
        { round: { roundNumber: "asc" } },
        { scheduledAt: "asc" },
      ],
      take: 500,
    })) as Array<unknown>;

    res.json({ matches });
  } catch (e) {
    serverLog.error(e);
    res.status(500).json({ error: "Erreur lors de la lecture des matchs" });
  }
});

/**
 * GET /admin/pro-league/matches/:id — detail d'un match Pro League.
 *
 * Renvoie : meta complete (status, score, outcome, counters, engineVer),
 * teams, round, replayId. Utilise par la page detail match + decisions
 * admin (simulate, force-forfeit).
 */
router.get("/matches/:id", async (req, res) => {
  try {
    const match = await prisma.proLeagueMatch.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        seasonId: true,
        roundId: true,
        status: true,
        scheduledAt: true,
        simulatedAt: true,
        completedAt: true,
        scoreHome: true,
        scoreAway: true,
        outcome: true,
        touchdownCount: true,
        casualtyCount: true,
        turnoverCount: true,
        nuffleCount: true,
        isTest: true,
        engineVer: true,
        driverKindOverride: true,
        replayId: true,
        homeTeam: { select: { id: true, name: true, slug: true, race: true } },
        awayTeam: { select: { id: true, name: true, slug: true, race: true } },
        round: { select: { id: true, roundNumber: true } },
        season: { select: { id: true, year: true, engineVer: true, driverKind: true } },
      },
    });
    if (!match) {
      return res.status(404).json({ error: "Match introuvable" });
    }
    res.json({ match });
  } catch (e) {
    serverLog.error(e);
    res.status(500).json({ error: "Erreur lors du chargement du match" });
  }
});

/**
 * POST /admin/pro-league/matches/:id/simulate — declenche la simulation
 * d'un match Pro League individuel.
 *
 * Utilise le sim-runner standard (`simulateProMatch`). Idempotent :
 * retourne `{ simulated: false }` si le match est deja dans un status
 * final (`completed` / `failed`).
 *
 * Le sim peut lever `EngineVersionMismatchError` si le match avait deja
 * un engineVer pinne different de la version courante. On retourne 422
 * dans ce cas (le re-sim n'est pas autorise — il faut bouger le match
 * ou la saison vers la nouvelle version d'abord).
 */
router.post("/matches/:id/simulate", async (req, res) => {
  try {
    const simulated = await simulateProMatch(req.params.id);

    await safeRecordAdminActionFromRequest(
      prisma,
      req as AuthenticatedRequest,
      {
        action: "pro-season.simulate-match",
        entity: "ProLeagueMatch",
        entityId: req.params.id,
        newValue: { simulated },
      },
    );

    res.json({ matchId: req.params.id, simulated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    if (msg.includes("introuvable") || msg.includes("not found")) {
      return res.status(404).json({ error: msg });
    }
    if (msg.includes("EngineVersionMismatch") || msg.includes("engineVer")) {
      return res.status(422).json({ error: msg });
    }
    serverLog.error(e);
    res.status(500).json({ error: msg });
  }
});

/**
 * POST /admin/pro-league/seasons/:seasonId/rounds/:roundNumber/simulate-all
 *
 * Simule en serie tous les matchs non-finaux d'un round. Utile pour
 * avancer rapidement une saison de demo (1 click = 8 matchs simules en
 * ~400ms hybrid driver). Retourne un agregat { simulated, skipped, failed }.
 *
 * Strategie : sequentiel pour respecter la backpressure du sim-runner
 * (chaque simulateProMatch fait des $transactions Prisma — paralleliser
 * 8 d'un coup peut saturer le pool de connexions). Acceptable pour < 16
 * matchs (1 round = 8 matchs max).
 */
router.post(
  "/seasons/:seasonId/rounds/:roundNumber/simulate-all",
  async (req, res) => {
    try {
      const { seasonId, roundNumber: roundNumberRaw } = req.params;
      const roundNumber = parseInt(roundNumberRaw, 10);
      if (!Number.isInteger(roundNumber) || roundNumber < 1 || roundNumber > 50) {
        return res.status(400).json({ error: "roundNumber doit etre 1..50" });
      }

      // Charge les matchs du round non-finaux. Limite a 50 pour cap les
      // bulk insanes (un round-robin standard = 8 matchs).
      const matches = (await prisma.proLeagueMatch.findMany({
        where: {
          seasonId,
          round: { roundNumber },
          status: { notIn: ["completed", "failed"] },
        },
        select: { id: true },
        take: 50,
      })) as Array<{ id: string }>;

      if (matches.length === 0) {
        return res.json({
          seasonId,
          roundNumber,
          simulated: 0,
          skipped: 0,
          failed: 0,
          failures: [],
        });
      }

      let simulated = 0;
      let skipped = 0;
      let failed = 0;
      const failures: Array<{ matchId: string; error: string }> = [];

      for (const m of matches) {
        try {
          const ok = await simulateProMatch(m.id);
          if (ok) simulated++;
          else skipped++;
        } catch (e) {
          failed++;
          failures.push({
            matchId: m.id,
            error: e instanceof Error ? e.message : String(e),
          });
          serverLog.error(
            `[admin.simulate-all] match=${m.id} round=${roundNumber} failed:`,
            e,
          );
        }
      }

      await safeRecordAdminActionFromRequest(
        prisma,
        req as AuthenticatedRequest,
        {
          action: "pro-season.simulate-round",
          entity: "ProLeagueSeason",
          entityId: seasonId,
          newValue: {
            roundNumber,
            total: matches.length,
            simulated,
            skipped,
            failed,
          },
        },
      );

      res.json({
        seasonId,
        roundNumber,
        total: matches.length,
        simulated,
        skipped,
        failed,
        failures,
      });
    } catch (e) {
      serverLog.error(e);
      res.status(500).json({
        error: e instanceof Error ? e.message : "Erreur inconnue",
      });
    }
  },
);

export default router;
