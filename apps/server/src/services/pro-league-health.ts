/**
 * Pro League healthcheck — sprint 1.F.2.
 *
 * Expose un sous-systeme observable specifique a la Pro League, en
 * complement du `/health/ready` generique. Pour chaque check, on
 * renvoie `up | degraded | down` avec un indice metier :
 *   - `season`         : up si une saison `in_progress` existe.
 *   - `simRunner`      : up si la derniere `ProLeagueMatch` completed
 *                        date de moins de 24h. degraded sinon (en
 *                        intersaison, c'est attendu).
 *   - `gazette`        : up si une edition Gazette publiee dans les
 *                        48h. degraded sinon.
 *   - `bettingMarkets` : up si au moins 1 ProBetMarket open existe sur
 *                        un match a venir.
 *   Lot 5 « exploitation » :
 *   - `simPool`        : up si le pool de workers sert (ou mode inline) ;
 *                        degraded si la file d'attente deborde ou si un
 *                        worker a du etre remplace.
 *   - `liveCompletion` : up si aucun match en direct n'attend sa cloture
 *                        depuis plus de 3h (transition ready → completed).
 *
 * Le statut global = pire des sous-statuts (down > degraded > up).
 *
 * Toutes les queries sont read-only et bornees pour ne pas charger la
 * DB. Erreur isolee par check.
 */

import { prisma } from "../prisma";
import { countStaleLiveMatches } from "./pro-league-match-completion";
import { getSimPoolStats } from "./pro-league-sim-pool";

export type CheckStatus = "up" | "degraded" | "down";

export interface CheckResult {
  readonly name: string;
  readonly status: CheckStatus;
  readonly detail?: string;
}

export interface ProLeagueHealth {
  readonly status: CheckStatus;
  readonly checks: readonly CheckResult[];
  readonly checkedAt: string;
}

const HOUR_MS = 60 * 60 * 1000;
const SIM_FRESHNESS_MS = 24 * HOUR_MS;
const GAZETTE_FRESHNESS_MS = 48 * HOUR_MS;

function worstStatus(checks: readonly CheckResult[]): CheckStatus {
  if (checks.some((c) => c.status === "down")) return "down";
  if (checks.some((c) => c.status === "degraded")) return "degraded";
  return "up";
}

async function checkSeason(): Promise<CheckResult> {
  try {
    const season = await prisma.proLeagueSeason.findFirst({
      where: { status: "in_progress", isTest: false },
      select: { id: true, year: true },
    });
    if (!season) {
      return {
        name: "season",
        status: "degraded",
        detail: "no in_progress season (intersaison ?)",
      };
    }
    return { name: "season", status: "up", detail: `season ${season.year}` };
  } catch (e: unknown) {
    return {
      name: "season",
      status: "down",
      detail: e instanceof Error ? e.message : "unknown",
    };
  }
}

async function checkSimRunner(): Promise<CheckResult> {
  try {
    const last = await prisma.proLeagueMatch.findFirst({
      where: { status: "completed" },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true },
    });
    if (!last || !last.completedAt) {
      return {
        name: "simRunner",
        status: "degraded",
        detail: "no completed match yet",
      };
    }
    const ageMs = Date.now() - last.completedAt.getTime();
    if (ageMs > SIM_FRESHNESS_MS) {
      return {
        name: "simRunner",
        status: "degraded",
        detail: `last match completed ${Math.floor(ageMs / HOUR_MS)}h ago`,
      };
    }
    return {
      name: "simRunner",
      status: "up",
      detail: `last match ${Math.floor(ageMs / HOUR_MS)}h ago`,
    };
  } catch (e: unknown) {
    return {
      name: "simRunner",
      status: "down",
      detail: e instanceof Error ? e.message : "unknown",
    };
  }
}

async function checkGazette(): Promise<CheckResult> {
  try {
    const last = await prisma.proGazetteArticle.findFirst({
      orderBy: { date: "desc" },
      select: { date: true },
    });
    if (!last) {
      return {
        name: "gazette",
        status: "degraded",
        detail: "no gazette article yet",
      };
    }
    const ageMs = Date.now() - last.date.getTime();
    if (ageMs > GAZETTE_FRESHNESS_MS) {
      return {
        name: "gazette",
        status: "degraded",
        detail: `last edition ${Math.floor(ageMs / HOUR_MS)}h ago`,
      };
    }
    return {
      name: "gazette",
      status: "up",
      detail: `last edition ${Math.floor(ageMs / HOUR_MS)}h ago`,
    };
  } catch (e: unknown) {
    return {
      name: "gazette",
      status: "down",
      detail: e instanceof Error ? e.message : "unknown",
    };
  }
}

async function checkBettingMarkets(): Promise<CheckResult> {
  try {
    const count = await prisma.proBetMarket.count({
      where: { status: "open" },
    });
    if (count === 0) {
      return {
        name: "bettingMarkets",
        status: "degraded",
        detail: "no open markets",
      };
    }
    return {
      name: "bettingMarkets",
      status: "up",
      detail: `${count} open markets`,
    };
  } catch (e: unknown) {
    return {
      name: "bettingMarkets",
      status: "down",
      detail: e instanceof Error ? e.message : "unknown",
    };
  }
}

/**
 * Aggrege tous les checks Pro League. Run en parallele pour latency.
 */
const LIVE_COMPLETION_STALE_MS = 3 * HOUR_MS;
/** File d'attente du pool au-dela de laquelle on degrade (par worker). */
const SIM_POOL_QUEUE_PER_WORKER = 25;

export function checkSimPool(stats = getSimPoolStats()): CheckResult {
  if (stats.mode === "inline") {
    return { name: "simPool", status: "up", detail: "inline (event loop)" };
  }
  const detail = `${stats.size} worker(s), ${stats.busy} busy, ${stats.queued} queued, ${stats.completed} done, ${stats.failed} failed, ${stats.respawned} respawned`;
  if (stats.size === 0) return { name: "simPool", status: "down", detail };
  if (stats.queued > stats.size * SIM_POOL_QUEUE_PER_WORKER || stats.respawned > 0) {
    return { name: "simPool", status: "degraded", detail };
  }
  return { name: "simPool", status: "up", detail };
}

async function checkLiveCompletion(): Promise<CheckResult> {
  try {
    const stale = await countStaleLiveMatches(new Date(), LIVE_COMPLETION_STALE_MS);
    if (stale > 0) {
      return {
        name: "liveCompletion",
        status: "degraded",
        detail: `${stale} match(s) en direct attendent leur cloture depuis plus de 3h`,
      };
    }
    return { name: "liveCompletion", status: "up", detail: "no stale live match" };
  } catch (e: unknown) {
    return {
      name: "liveCompletion",
      status: "down",
      detail: e instanceof Error ? e.message : "unknown",
    };
  }
}

export async function getProLeagueHealth(): Promise<ProLeagueHealth> {
  const checks = await Promise.all([
    checkSeason(),
    checkSimRunner(),
    checkGazette(),
    checkBettingMarkets(),
    Promise.resolve(checkSimPool()),
    checkLiveCompletion(),
  ]);
  return {
    status: worstStatus(checks),
    checks,
    checkedAt: new Date().toISOString(),
  };
}
