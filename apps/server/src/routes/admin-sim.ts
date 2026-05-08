import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  PRO_LEAGUE_TEAMS,
  PRO_LEAGUE_TEAM_BY_ID,
  formatBenchReport,
  runBench,
} from "@bb/sim-engine";

import { adminOnly } from "../middleware/adminOnly";
import { authUser } from "../middleware/authUser";
import { validate } from "../middleware/validate";
import { computeEngineDrift } from "../services/pro-league-engine-drift-watcher";
import { getBroadcasterStats } from "../services/pro-league-match-broadcaster";
import {
  createTestMatch,
  listTestMatches,
} from "../services/pro-league-sandbox";
import { appMetrics } from "../utils/metrics";

/**
 * Petit utilitaire admin (Phase 0 — pre-Pro League UI).
 *
 * Permet de declencher une simulation depuis le navigateur sans passer
 * par le CLI. Branche le `runBench` du sim-engine sur une route POST
 * `/admin/sim/run` qui retourne le `BenchPairing` (metrics + favori +
 * report texte).
 *
 * Cette route disparaitra quand la Phase 1 livrera la vraie UI Pro
 * League (lots 1.A scheduler + 1.B broadcaster + 1.C pages).
 */

export const runSimSchema = z.object({
  teamA: z.string().min(1),
  teamB: z.string().min(1),
  runs: z.number().int().positive().max(2000).default(50),
  seed: z.number().int().min(0).default(0),
});

export type RunSimBody = z.infer<typeof runSimSchema>;

/** Handler for `GET /admin/sim/teams` — list the 16 Pro League teams. */
export function handleListTeams(_req: Request, res: Response): void {
  res.json({
    teams: PRO_LEAGUE_TEAMS.map((t) => ({
      id: t.id,
      city: t.city,
      name: t.name,
      race: t.race,
      nflFlavor: t.nflFlavor,
    })),
  });
}

/** Handler for `POST /admin/sim/run` — runs a bench pairing. */
export function handleRunSim(req: Request, res: Response): void {
  const { teamA, teamB, runs, seed } = req.body as RunSimBody;

  const home = PRO_LEAGUE_TEAM_BY_ID[teamA];
  const away = PRO_LEAGUE_TEAM_BY_ID[teamB];
  if (!home) {
    res.status(400).json({ error: `Unknown teamA '${teamA}'` });
    return;
  }
  if (!away) {
    res.status(400).json({ error: `Unknown teamB '${teamB}'` });
    return;
  }
  if (teamA === teamB) {
    res.status(400).json({ error: "teamA and teamB must be distinct" });
    return;
  }

  const result = runBench({
    pairing: { home, away },
    runs,
    seedOffset: seed,
  });
  const report = formatBenchReport([result]);

  res.json({
    pairing: {
      home: { id: home.id, name: home.name, race: home.race },
      away: { id: away.id, name: away.name, race: away.race },
    },
    matches: result.matches,
    metrics: result.metrics,
    favorite: result.favorite,
    report,
  });
}

/**
 * Handler for `GET /admin/sim/drift` — Lot 2.A.5.
 *
 * Calcule la drift courante (rolling 7 jours par default) sans
 * dépendre de Prometheus / Grafana. Sert au dashboard admin
 * `/admin/sim/health` (Lot 2.B.3).
 *
 * Query params :
 *   - `windowMs` (number, optional) : fenêtre glissante en ms.
 *   - `seasonId` (string, optional) : filtre saison.
 */
export async function handleGetDrift(req: Request, res: Response): Promise<void> {
  const windowMsRaw = req.query.windowMs;
  const seasonId =
    typeof req.query.seasonId === "string" && req.query.seasonId.length > 0
      ? req.query.seasonId
      : undefined;
  const windowMs =
    typeof windowMsRaw === "string" && /^\d+$/.test(windowMsRaw)
      ? Number.parseInt(windowMsRaw, 10)
      : undefined;
  const samples = await computeEngineDrift({ windowMs, seasonId });
  res.json({
    samples,
    computedAt: new Date().toISOString(),
  });
}

/**
 * Handler for `GET /admin/sim/broadcaster` — Lot 2.B.4.
 *
 * Retourne l'état live du broadcaster (sessions actives, total
 * subscribers) et les histogrammes Prometheus dérivés (lag dispatch
 * dernier scrape interne). Utilisé par l'UI admin
 * `/admin/sim/broadcaster` qui rafraîchit toutes les 5s.
 *
 * On lit `getBroadcasterStats()` (synchrone) plus le snapshot des
 * gauges Prometheus pour confirmer la cohérence.
 */
export async function handleGetBroadcasterStats(
  _req: Request,
  res: Response,
): Promise<void> {
  const stats = getBroadcasterStats();
  // On lit directement depuis le registre Prometheus pour être sûr
  // que ce qu'on affiche dans l'UI = ce que voit Grafana.
  const activeSessionsGauge = await appMetrics.snapshotGauge(
    "nuffle_broadcaster_active_sessions",
  );
  const totalSubscribersGauge = await appMetrics.snapshotGauge(
    "nuffle_broadcaster_total_subscribers",
  );
  res.json({
    activeSessions: stats.activeSessions,
    totalSubscribers: stats.totalSubscribers,
    /** Valeurs lues côté Prometheus — utile pour détecter une dérive
     *  entre l'état mémoire et ce qui est exposé. */
    promExposed: {
      activeSessions: activeSessionsGauge,
      totalSubscribers: totalSubscribersGauge,
    },
    fetchedAt: new Date().toISOString(),
  });
}

/**
 * Schema for `POST /admin/sim/test-match` — Lot 2.C.2.
 *
 * Pas de `seed` exposé dans cette V1 — le sim-runner dérive le seed
 * depuis le matchId (cuid) ce qui est suffisant pour relancer
 * exactement le même match en re-cliquant. Lot futur : exposer un
 * seed override pour reproduire un bug donné.
 *
 * Lot 3.B.1 : `driverKind` optionnel pour forcer le driver de
 * simulation au niveau du sandbox match (utile pour A/B test ou
 * rejouer un match en hybrid après bug full). Si omis, la saison
 * fournit le default (`'hybrid'` pour toutes les saisons existantes).
 */
export const testMatchSchema = z.object({
  homeTeamId: z.string().min(1),
  awayTeamId: z.string().min(1),
  driverKind: z.enum(["hybrid", "full"]).optional(),
});

export type TestMatchBody = z.infer<typeof testMatchSchema>;

/** Handler `POST /admin/sim/test-match` — Lot 2.C.2. */
export async function handleCreateTestMatch(
  req: Request,
  res: Response,
): Promise<void> {
  const { homeTeamId, awayTeamId, driverKind } = req.body as TestMatchBody;
  try {
    const result = await createTestMatch({
      homeTeamId,
      awayTeamId,
      driverKind,
    });
    res.status(201).json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown";
    // Erreur user-input → 400 ; sim qui throw → 500 propagé.
    if (
      msg.includes("introuvables") ||
      msg.includes("distincts") ||
      msg.includes("saison")
    ) {
      res.status(400).json({ error: msg });
    } else {
      res.status(500).json({ error: msg });
    }
  }
}

/** Handler `GET /admin/sim/test-matches` — Lot 2.C.4. */
export async function handleListTestMatches(
  req: Request,
  res: Response,
): Promise<void> {
  const limitRaw = req.query.limit;
  const limit =
    typeof limitRaw === "string" && /^\d+$/.test(limitRaw)
      ? Number.parseInt(limitRaw, 10)
      : undefined;
  const matches = await listTestMatches(limit);
  res.json({ matches });
}

const router = Router();

router.use(authUser, adminOnly);

router.get("/teams", handleListTeams);
router.post("/run", validate(runSimSchema), handleRunSim);
router.get("/drift", handleGetDrift);
router.get("/broadcaster", handleGetBroadcasterStats);
router.post(
  "/test-match",
  validate(testMatchSchema),
  handleCreateTestMatch,
);
router.get("/test-matches", handleListTestMatches);

export default router;
