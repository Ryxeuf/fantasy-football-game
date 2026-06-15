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
import { runEngineComparison } from "../services/engine-comparison";
import { computeEngineDrift } from "../services/pro-league-engine-drift-watcher";
import { getBroadcasterStats } from "../services/pro-league-match-broadcaster";
import {
  AdminToolsError,
  runReplayDiff,
  runVersionComparison,
} from "../services/pro-league-admin-tools";
import {
  NarrationError,
  getMatchNarration,
} from "../services/pro-league-narration";
import {
  createTestMatch,
  listTestMatches,
  resimulateTestMatch,
} from "../services/pro-league-sandbox";
import { computeSimHealthSnapshot } from "../services/pro-league-sim-health";
import { runBroadcasterLoadTest } from "../services/pro-league-broadcaster-loadtest";
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
  const { teamA, teamB, runs, seed }: RunSimBody = req.body;

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
 * Handler for `GET /admin/sim/health-snapshot` — Lot 2.B.3 (extension 4.A.3).
 *
 * Snapshot agrégé : drift samples + drift alerts + bound alerts +
 * timestamp dernier match. Sert au dashboard admin `/admin/sim/health`
 * en remplaçant les 3 round-trips drift / alerts / last-sim par un
 * unique appel cohérent (même `samples` / même `now()`).
 *
 * Query params identiques à `/admin/sim/drift` (`windowMs`, `seasonId`).
 */
export async function handleGetHealthSnapshot(
  req: Request,
  res: Response,
): Promise<void> {
  const windowMsRaw = req.query.windowMs;
  const seasonId =
    typeof req.query.seasonId === "string" && req.query.seasonId.length > 0
      ? req.query.seasonId
      : undefined;
  const windowMs =
    typeof windowMsRaw === "string" && /^\d+$/.test(windowMsRaw)
      ? Number.parseInt(windowMsRaw, 10)
      : undefined;
  const snapshot = await computeSimHealthSnapshot({ windowMs, seasonId });
  res.json(snapshot);
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
  const { homeTeamId, awayTeamId, driverKind }: TestMatchBody = req.body;
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

export const resimulateTestMatchSchema = z.object({
  driverKind: z.enum(["hybrid", "full"]).optional(),
});

export type ResimulateTestMatchBody = z.infer<typeof resimulateTestMatchSchema>;

/**
 * Handler `POST /admin/sim/test-match/:id/resimulate`. Wipes the
 * existing Replay, resets the match to `scheduled` and triggers a
 * fresh simulation. Refuses non-test matches (isTest=false) — never
 * touch a production match's replay.
 */
export async function handleResimulateTestMatch(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = req.params as { id: string };
  const { driverKind }: ResimulateTestMatchBody = req.body ?? {};
  try {
    const result = await resimulateTestMatch({ matchId: id, driverKind });
    res.status(200).json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown";
    if (msg.includes("introuvable")) {
      res.status(404).json({ error: msg });
    } else if (msg.includes("pas un test match")) {
      res.status(400).json({ error: msg });
    } else {
      res.status(500).json({ error: msg });
    }
  }
}

/**
 * Handler `GET /admin/sim/matches/:id/narration` — Lot 3.E.4.
 *
 * Retourne la narration texte du match (events reformatés en langage
 * naturel avec noms réels du roster). Mime `text/plain` quand
 * `?format=text`, sinon JSON `{ matchId, narration, ... }`.
 */
export async function handleGetMatchNarration(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = req.params as { id: string };
  const format = (req.query.format as string | undefined) ?? "json";
  try {
    const out = await getMatchNarration(id);
    if (format === "text") {
      res.type("text/plain; charset=utf-8").send(out.narration);
      return;
    }
    res.json(out);
  } catch (err: unknown) {
    if (err instanceof NarrationError) {
      const status =
        err.code === "MATCH_NOT_REPLAYABLE"
          ? 409
          : err.code === "MATCH_NOT_FOUND" ||
              err.code === "REPLAY_NOT_FOUND"
            ? 404
            : 500;
      res.status(status).json({ error: err.message, code: err.code });
      return;
    }
    const msg = err instanceof Error ? err.message : "unknown";
    res.status(500).json({ error: msg });
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

/**
 * Schema pour `POST /admin/sim/comparison` — Lot 3.B.2.
 *
 * Lance N matchs avec hybrid + full driver (même seed à chaque step)
 * et persiste un row `EngineComparison` + met à jour les Prometheus
 * gauges. Ce endpoint est intentionnellement synchrone — pour 25
 * matchs en hybrid (~50ms) + 25 en full (~1-3s) on est sous 90s ; pour
 * des batchs plus gros, utiliser `pnpm sim:compare --json` côté CLI.
 *
 * Bornes :
 *   - matches ∈ [1, 1000] (defense-in-depth, route bloquante au-delà).
 *   - seedOffset ∈ tout entier (négatifs autorisés pour éviter de coller
 *     aux seeds de prod par accident).
 */
export const comparisonSchema = z.object({
  homeTeamId: z.string().min(1),
  awayTeamId: z.string().min(1),
  matches: z.number().int().min(1).max(1000),
  seedOffset: z.number().int(),
});

export type ComparisonBody = z.infer<typeof comparisonSchema>;

/** Handler `POST /admin/sim/comparison` — Lot 3.B.2. */
export async function handleRunComparison(
  req: Request,
  res: Response,
): Promise<void> {
  const { homeTeamId, awayTeamId, matches, seedOffset }: ComparisonBody =
    req.body;
  try {
    const result = await runEngineComparison(
      { homeTeamId, awayTeamId, matches, seedOffset, source: "admin" },
      { metrics: appMetrics },
    );
    res.status(201).json({
      id: result.id,
      engineVer: result.engineVer,
      aggregate: result.aggregate,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown";
    if (
      msg.includes("distincts") ||
      msg.includes("inconnue") ||
      msg.includes("matches")
    ) {
      res.status(400).json({ error: msg });
    } else {
      res.status(500).json({ error: msg });
    }
  }
}

/**
 * Schema pour `POST /admin/sim/compare-versions` — Lot 4.F.
 *
 * Recoit 2 baselines JSON (Bench snapshot files) + thresholds optionnels.
 * Le service service valide les schemas Zod et delegue a `compareBaselines`.
 */
export const compareVersionsSchema = z.object({
  baseRaw: z.unknown(),
  headRaw: z.unknown(),
  warnThreshold: z.number().positive().lt(1).optional(),
  criticalThreshold: z.number().positive().lt(1).optional(),
});

export type CompareVersionsBody = z.infer<typeof compareVersionsSchema>;

/** Handler `POST /admin/sim/compare-versions` — Lot 4.F. */
export async function handleCompareVersions(
  req: Request,
  res: Response,
): Promise<void> {
  const body: CompareVersionsBody = req.body;
  try {
    const result = runVersionComparison(body);
    res.status(200).json(result);
  } catch (err: unknown) {
    if (err instanceof AdminToolsError) {
      res.status(400).json({ error: err.message, code: err.code });
      return;
    }
    const msg = err instanceof Error ? err.message : "unknown";
    res.status(500).json({ error: msg });
  }
}

/**
 * Schema pour `POST /admin/sim/diff-replays` — Lot 4.F.
 *
 * Recoit 2 matchIds (cuids) ; le service charge les Replay.payload
 * de la DB, les decompresse et runne `diffReplayEvents`.
 */
export const diffReplaysSchema = z.object({
  matchIdA: z.string().min(1),
  matchIdB: z.string().min(1),
  maxDivergences: z.number().int().min(1).max(1000).optional(),
});

export type DiffReplaysBody = z.infer<typeof diffReplaysSchema>;

/** Handler `POST /admin/sim/diff-replays` — Lot 4.F. */
export async function handleDiffReplays(
  req: Request,
  res: Response,
): Promise<void> {
  const body: DiffReplaysBody = req.body;
  try {
    const result = await runReplayDiff(body);
    res.status(200).json(result);
  } catch (err: unknown) {
    if (err instanceof AdminToolsError) {
      const status =
        err.code === "MATCH_NOT_FOUND" || err.code === "REPLAY_NOT_FOUND"
          ? 404
          : 400;
      res.status(status).json({ error: err.message, code: err.code });
      return;
    }
    const msg = err instanceof Error ? err.message : "unknown";
    res.status(500).json({ error: msg });
  }
}

/**
 * Schema pour `POST /admin/sim/loadtest` — Lot J (wrappe le CLI 4.C.1).
 *
 * Les caps sont volontairement plus stricts que le CLI : la route
 * tourne dans le process server prod, donc un load test mal
 * dimensionné saturerait l'event loop. Le CLI offline accepte des
 * scaling tests plus agressifs.
 *   - matches ≤ 50 (vs 1000 CLI)
 *   - subscribers ≤ 1000 (vs 5000 CLI)
 *   - events ≤ 200 (vs 1000 CLI)
 *   - durée capée par eventSpacingMs × events × matches (sanity)
 */
export const loadtestSchema = z.object({
  matches: z.number().int().min(1).max(50),
  subscribers: z.number().int().min(1).max(1000),
  events: z.number().int().min(1).max(200),
  eventSpacingMs: z.number().int().min(1).max(1000).optional(),
  tickIntervalMs: z.number().int().min(1).max(1000).optional(),
});

export type LoadtestBody = z.infer<typeof loadtestSchema>;

/** Handler `POST /admin/sim/loadtest` — Lot J. */
export async function handleRunLoadtest(
  req: Request,
  res: Response,
): Promise<void> {
  const body: LoadtestBody = req.body;
  try {
    const result = await runBroadcasterLoadTest(body);
    res.status(200).json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown";
    res.status(500).json({ error: msg });
  }
}

const router = Router();

router.use(authUser, adminOnly);

router.get("/teams", handleListTeams);
router.post("/run", validate(runSimSchema), handleRunSim);
router.get("/drift", handleGetDrift);
router.get("/health-snapshot", handleGetHealthSnapshot);
router.get("/broadcaster", handleGetBroadcasterStats);
router.post(
  "/test-match",
  validate(testMatchSchema),
  handleCreateTestMatch,
);
router.get("/test-matches", handleListTestMatches);
router.get("/matches/:id/narration", handleGetMatchNarration);
router.post(
  "/test-match/:id/resimulate",
  validate(resimulateTestMatchSchema),
  handleResimulateTestMatch,
);
router.post(
  "/comparison",
  validate(comparisonSchema),
  handleRunComparison,
);
router.post(
  "/compare-versions",
  validate(compareVersionsSchema),
  handleCompareVersions,
);
router.post(
  "/diff-replays",
  validate(diffReplaysSchema),
  handleDiffReplays,
);
router.post(
  "/loadtest",
  validate(loadtestSchema),
  handleRunLoadtest,
);

export default router;
