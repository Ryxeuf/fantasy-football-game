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

const router = Router();

router.use(authUser, adminOnly);

router.get("/teams", handleListTeams);
router.post("/run", validate(runSimSchema), handleRunSim);
router.get("/drift", handleGetDrift);

export default router;
