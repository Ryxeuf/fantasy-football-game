/**
 * Pro League sim runner — sprint Pro League lot 1.A.4.
 *
 * Orchestre la pré-simulation des matchs `ProLeagueMatch` à T-24h :
 *
 *   1. Charge les matchs `scheduled` dont `scheduledAt < now + 24h`.
 *   2. Pour chaque match, calcule un seed déterministe + invoke
 *      `simulateMatch` (sim-engine).
 *   3. Compresse les events via `compressEvents` (CBOR + gzip).
 *   4. Persiste le `Replay` (upsert par `matchId`).
 *   5. Met à jour `ProLeagueMatch` avec status `ready`, scores cachés,
 *      counters, replayId, engineVer.
 *
 * Pas de worker dédié au MVP — exécuté in-process via `setInterval` à
 * partir de `apps/server/src/index.ts` (cf. lot 1.A.4 sprint spec).
 * L'interface (`simulateUpcomingMatches`, `simulateProMatch`) reste
 * stable pour migration BullMQ ultérieure.
 *
 * Contrats :
 *  - Idempotent : un match déjà `ready` / `in_progress` / `completed`
 *    est skip.
 *  - Erreur par match isolée : si la sim throw, le match passe à
 *    `failed` avec `outcome=null` ; les autres matchs continuent.
 *  - Le seed est dérivé du `matchId` (cuid) via un hash FNV1a 32-bit
 *    pour rester déterministe et reproductible.
 *  - `engineVer` est lu de `season.engineVer` (pinné lot 1.A.5) ou,
 *    en fallback, de la version courante du sim-engine.
 */

import {
  ENGINE_VER as CURRENT_ENGINE_VER,
  PRO_LEAGUE_TEAM_BY_ID,
  compressEvents,
  computeCompressionStats,
  simulateMatch,
  type MatchEvent,
  type SimInput,
  type SimResult,
} from "@bb/sim-engine";

import { prisma } from "../prisma";
import { appMetrics, type SimDriver, type SimOutcome } from "../utils/metrics";
import {
  EngineVersionMismatchError,
  assertSimulationAllowed,
} from "./pro-league-engine-version";

/** Statuts de match qui n'ont plus besoin d'être simulés. */
const FINAL_STATUSES = new Set(["ready", "in_progress", "completed"]);

export interface SimulateUpcomingOptions {
  /** Fenêtre temporelle à pré-simuler (ms). Default 24h. */
  readonly windowMs?: number;
  /** Si fourni, override de `now()`. Pratique pour tests. */
  readonly now?: Date;
  /** Limite max de matchs traités par appel (anti-runaway). Default 50. */
  readonly maxBatchSize?: number;
}

export interface SimulateUpcomingResult {
  readonly simulated: number;
  readonly skipped: number;
  readonly failed: number;
  /** Lot 1.A.5 — matchs refusés car la version courante du sim-engine
   *  ne match pas la version pinnée sur la saison ou le match. */
  readonly versionMismatched: number;
  readonly inspected: number;
}

const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_BATCH = 50;

/**
 * Hash FNV1a 32-bit pour dériver un seed numérique d'un cuid string.
 * Pas cryptographique — juste déterministe et bien distribué pour seeds.
 */
function hashSeed(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0; // unsigned 32-bit
}

/** Highlight pré-extrait pour Replay.highlights (lot 1.A.4 + UI 1.C.3). */
interface ReplayHighlight {
  readonly type: "TD" | "CASUALTY" | "NUFFLE";
  readonly atMs: number;
  readonly meta: Record<string, unknown>;
}

function extractHighlights(events: readonly MatchEvent[]): ReplayHighlight[] {
  const out: ReplayHighlight[] = [];
  for (const ev of events) {
    if (ev.type === "TD" || ev.type === "CASUALTY" || ev.type === "NUFFLE") {
      out.push({
        type: ev.type,
        atMs: ev.displayAtMs,
        meta: (ev.meta as Record<string, unknown> | undefined) ?? {},
      });
    }
  }
  return out;
}

/**
 * Simule un seul match Pro League et persiste le résultat. Idempotent
 * si le match est déjà `ready` ou plus avancé — renvoie alors `false`.
 */
export async function simulateProMatch(matchId: string): Promise<boolean> {
  const match = await prisma.proLeagueMatch.findUnique({
    where: { id: matchId },
    include: {
      season: { select: { id: true, engineVer: true } },
      homeTeam: { select: { slug: true, name: true } },
      awayTeam: { select: { slug: true, name: true } },
    },
  });
  if (!match) {
    throw new Error(`ProLeagueMatch '${matchId}' introuvable`);
  }

  if (FINAL_STATUSES.has(match.status as string)) {
    return false; // déjà simulé
  }

  // Lot 1.A.5 — gating engineVer : refuse de simuler si la version
  // courante ne match pas la version pinnée sur la saison ou (en cas
  // de re-simulation) sur le match. Lève EngineVersionMismatchError.
  assertSimulationAllowed({
    engineVer: (match.engineVer as string | null) ?? null,
    season: {
      id: match.season.id as string,
      engineVer: match.season.engineVer as string,
    },
  });

  const homeProfile = PRO_LEAGUE_TEAM_BY_ID[match.homeTeam.slug as string];
  const awayProfile = PRO_LEAGUE_TEAM_BY_ID[match.awayTeam.slug as string];
  if (!homeProfile || !awayProfile) {
    throw new Error(
      `ProTeam slug introuvable dans race-profiles : home='${match.homeTeam.slug}' away='${match.awayTeam.slug}'`,
    );
  }

  const seed = hashSeed(matchId);
  const engineVer = (match.season.engineVer as string) || CURRENT_ENGINE_VER;

  const input: SimInput = {
    seed,
    home: {
      id: homeProfile.id,
      name: homeProfile.name,
      side: "home",
      tactics: homeProfile.tactics,
      tv: homeProfile.tv,
    },
    away: {
      id: awayProfile.id,
      name: awayProfile.name,
      side: "away",
      tactics: awayProfile.tactics,
      tv: awayProfile.tv,
    },
  };

  // Lot 2.A.3 — instrumentation Prometheus. `driver` est figé à
  // 'hybrid' jusqu'à ce que Lot 3.B.1 introduise le toggle
  // `season.driverKind`. À ce moment-là, on lira la valeur depuis
  // la DB ici.
  const driver: SimDriver = "hybrid";

  let result: SimResult;
  const simStart = process.hrtime.bigint();
  try {
    result = simulateMatch(input);
  } catch (err: unknown) {
    const elapsedSec = Number(process.hrtime.bigint() - simStart) / 1e9;
    appMetrics.observeSimMatchDuration(
      { engineVer, driver, outcome: "failed" },
      elapsedSec,
    );
    appMetrics.recordSimMatch({ status: "failed", driver });
    const msg = err instanceof Error ? err.message : "unknown";
    await prisma.proLeagueMatch.update({
      where: { id: matchId },
      data: { status: "failed", simulatedAt: new Date() },
    });
    throw new Error(`Sim failed for match '${matchId}': ${msg}`);
  }
  const elapsedSec = Number(process.hrtime.bigint() - simStart) / 1e9;
  appMetrics.observeSimMatchDuration(
    { engineVer, driver, outcome: result.summary.outcome as SimOutcome },
    elapsedSec,
  );
  appMetrics.recordSimMatch({ status: "success", driver });

  const compressed = await compressEvents(result.events);
  const stats = computeCompressionStats(result.events, compressed);
  const highlights = extractHighlights(result.events);
  appMetrics.observeReplaySize({ engineVer }, compressed.byteLength);

  // Upsert Replay puis MAJ ProLeagueMatch en transaction pour cohérence.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.$transaction(async (tx: any) => {
    await tx.replay.upsert({
      where: { matchId },
      create: {
        matchId,
        payload: compressed,
        highlights,
        durationMs: result.summary.durationMs,
        rawJsonSize: stats.rawJsonSize,
      },
      update: {
        payload: compressed,
        highlights,
        durationMs: result.summary.durationMs,
        rawJsonSize: stats.rawJsonSize,
      },
    });

    await tx.proLeagueMatch.update({
      where: { id: matchId },
      data: {
        status: "ready",
        simulatedAt: new Date(),
        seed: BigInt(seed),
        engineVer,
        replayId: matchId,
        scoreHome: result.summary.score.home,
        scoreAway: result.summary.score.away,
        outcome: result.summary.outcome,
        touchdownCount: result.summary.touchdownCount,
        casualtyCount: result.casualties.length,
        turnoverCount: result.summary.turnoverCount,
        nuffleCount: result.summary.nuffleCount,
      },
    });
  });

  return true;
}

/**
 * Simule tous les matchs `scheduled` dont `scheduledAt` tombe dans la
 * fenêtre `[now, now + windowMs]`. Anti-runaway : limité à
 * `maxBatchSize` matchs par appel.
 *
 * Erreur par match isolée : un échec ne bloque pas le batch.
 */
export async function simulateUpcomingMatches(
  options: SimulateUpcomingOptions = {},
): Promise<SimulateUpcomingResult> {
  const now = options.now ?? new Date();
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const maxBatch = options.maxBatchSize ?? DEFAULT_MAX_BATCH;
  const horizon = new Date(now.getTime() + windowMs);

  const candidates = await prisma.proLeagueMatch.findMany({
    where: {
      status: "scheduled",
      scheduledAt: { gte: now, lte: horizon },
    },
    select: { id: true },
    orderBy: { scheduledAt: "asc" },
    take: maxBatch,
  });

  let simulated = 0;
  let skipped = 0;
  let failed = 0;
  let versionMismatched = 0;
  for (const { id } of candidates) {
    try {
      const ok = await simulateProMatch(id);
      if (ok) simulated += 1;
      else skipped += 1;
    } catch (err) {
      if (err instanceof EngineVersionMismatchError) {
        versionMismatched += 1;
      } else {
        failed += 1;
      }
    }
  }

  return {
    simulated,
    skipped,
    failed,
    versionMismatched,
    inspected: candidates.length,
  };
}
