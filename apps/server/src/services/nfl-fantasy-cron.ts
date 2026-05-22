/**
 * Service NFL Fantasy Cron — Phase 2.H.
 *
 * Orchestre les jobs periodiques :
 *
 *   nflverseIngestTick     pull nflverse pour la semaine courante
 *                          (post-match data). Tick journalier.
 *   espnGamedayTick        pull ESPN scoreboard pour aujourd'hui
 *                          (Thu/Fri/Sun/Mon en saison). Tick 5min.
 *   lockLineupsTick        lock toutes les lineups de la semaine
 *                          courante (Sunday 17:00 UTC ~= 12:00 ET).
 *   settleWeekTick         pour chaque league in_progress, generate
 *                          matchups + settle la semaine precedente
 *                          (Tuesday 12:00 UTC).
 *
 * Pattern : chaque tick est idempotent (Q.D.1, herite des services
 * 2.A-2.E). Les `shouldRun*` purs sont exportes + testes en unit.
 *
 * Wiring : `apps/server/src/index.ts` lance un setInterval(5min) qui
 * appelle l'orchestrateur. Voir doc 17-crons.md.
 */

import { lockLineups } from "./nfl-fantasy-lineup";
import {
  generateMatchups,
  settleNflFantasyWeek,
} from "./nfl-fantasy-scoring";
import { ingestEspnGameday } from "./nfl-ingest-espn";
import { ingestNflverseWeek } from "./nfl-ingest";
import { ingestNflverseRosters } from "./nfl-ingest-rosters";
import { prisma } from "../prisma";
import { serverLog } from "../utils/server-log";

// ────────────────────────────────────────────────────────────────────
// Helpers purs (date arithmetique)
// ────────────────────────────────────────────────────────────────────

/**
 * Format YYYYMMDD UTC. Pur.
 */
export function dateYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/**
 * Determine la saison NFL active a partir d'une date.
 *
 *   - Janvier-juin : saison precedente (ex: jan 2026 = saison "2025")
 *   - Juillet-decembre : saison courante (ex: oct 2025 = saison "2025")
 *
 * Pur.
 */
export function currentSeasonId(now: Date): string {
  const month = now.getUTCMonth();
  const year = now.getUTCFullYear();
  if (month >= 6) return String(year);
  return String(year - 1);
}

/**
 * Returns true si on est dans une journee NFL plausible (jeudi,
 * vendredi, samedi, dimanche, lundi UTC). Le tick ESPN tourne dans
 * ces creneaux uniquement pour eviter de spammer l'API.
 *
 *   Sun=0, Mon=1, Thu=4, Fri=5, Sat=6.
 *
 * Pur.
 */
export function isNflGameday(now: Date): boolean {
  const day = now.getUTCDay();
  return day === 0 || day === 1 || day === 4 || day === 5 || day === 6;
}

/**
 * True dans la fenetre Sunday 17:00-17:59 UTC (~= 12:00 ET kickoff
 * Sunday afternoon). Marge volontaire 1h pour absorber un tick rate
 * de 5-10 minutes.
 *
 * Pur.
 */
export function isLockLineupsWindow(now: Date): boolean {
  return now.getUTCDay() === 0 && now.getUTCHours() === 17;
}

/**
 * True dans la fenetre Tuesday 12:00-12:59 UTC. Settlement post
 * Monday Night Football (qui se termine vers 06:00 UTC mardi).
 *
 * Pur.
 */
export function isSettleWindow(now: Date): boolean {
  return now.getUTCDay() === 2 && now.getUTCHours() === 12;
}

/**
 * True dans la fenetre 03:00-03:59 UTC (n'importe quel jour). Permet
 * de declencher le pull nflverse journalier sans doublon.
 *
 * Pur.
 */
export function isNflverseDailyWindow(now: Date): boolean {
  return now.getUTCHours() === 3;
}

// ────────────────────────────────────────────────────────────────────
// Helpers DB read-only
// ────────────────────────────────────────────────────────────────────

/**
 * Trouve la NflWeek "courante" : derniere week dont startDate <= now,
 * pour la saison `currentSeasonId(now)`. Tri secondaire par weekNumber
 * desc pour briser les ex-aequo (le seed Phase 2.A donne le meme
 * startDate a toutes les weeks ; un seed affine via ESPN schedules
 * arrivera en V2). Retourne null si aucune.
 */
export async function findCurrentNflWeek(now: Date): Promise<{
  id: string;
  seasonId: string;
  weekNumber: number;
} | null> {
  const seasonId = currentSeasonId(now);
  const w = await prisma.nflWeek.findFirst({
    where: { seasonId, startDate: { lte: now } },
    orderBy: [{ startDate: "desc" }, { weekNumber: "desc" }],
    select: { id: true, seasonId: true, weekNumber: true },
  });
  return w;
}

/**
 * Trouve la NflWeek precedente (pour settle). Meme tri secondaire que
 * findCurrentNflWeek pour briser les ex-aequo.
 */
export async function findPreviousNflWeek(now: Date): Promise<{
  id: string;
  seasonId: string;
  weekNumber: number;
} | null> {
  const seasonId = currentSeasonId(now);
  const weeks = await prisma.nflWeek.findMany({
    where: { seasonId, startDate: { lte: now } },
    orderBy: [{ startDate: "desc" }, { weekNumber: "desc" }],
    take: 2,
    select: { id: true, seasonId: true, weekNumber: true },
  });
  return weeks[1] ?? null;
}

// ────────────────────────────────────────────────────────────────────
// Ticks
// ────────────────────────────────────────────────────────────────────

export interface TickResult {
  readonly ran: boolean;
  readonly reason?: string;
  readonly detail?: unknown;
}

/**
 * Pull nflverse pour la semaine courante. Idempotent (service 2.A).
 *
 * Tourne uniquement dans la fenetre 03:00 UTC pour eviter de spammer.
 * Forcer via `opts.force = true` pour les tests.
 */
export async function nflverseIngestTick(opts: {
  now?: Date;
  force?: boolean;
} = {}): Promise<TickResult> {
  const now = opts.now ?? new Date();
  if (!opts.force && !isNflverseDailyWindow(now)) {
    return { ran: false, reason: "out_of_window" };
  }

  const week = await findCurrentNflWeek(now);
  if (!week) {
    return { ran: false, reason: "no_current_week" };
  }

  try {
    const result = await ingestNflverseWeek({
      seasonId: week.seasonId,
      weekNumber: week.weekNumber,
    });
    serverLog.info(
      `[nfl-cron] nflverse ${week.id} : players=${result.playersUpdated} stats=${result.statsUpdated} games=${result.gamesUpdated}`,
    );
    return { ran: true, detail: result };
  } catch (e) {
    serverLog.error(
      `[nfl-cron] nflverse ${week.id} failed: ${(e as Error).message}`,
    );
    return { ran: true, reason: "ingest_failed", detail: (e as Error).message };
  }
}

/**
 * Pull rosters nflverse pour la saison en cours. Tourne 1x/jour
 * dans la meme fenetre que le nflverseDailyTick. Backfill jersey +
 * bio (height/weight/college/headshot/draft).
 */
export async function nflverseRostersTick(opts: {
  now?: Date;
  force?: boolean;
} = {}): Promise<TickResult> {
  const now = opts.now ?? new Date();
  if (!opts.force && !isNflverseDailyWindow(now)) {
    return { ran: false, reason: "out_of_window" };
  }

  const week = await findCurrentNflWeek(now);
  if (!week) {
    return { ran: false, reason: "no_current_week" };
  }

  try {
    const result = await ingestNflverseRosters({ seasonId: week.seasonId });
    serverLog.info(
      `[nfl-cron] rosters ${week.seasonId} : updated=${result.playersUpdated} created=${result.playersCreated} skipped=${result.playersSkipped} errors=${result.errors.length}`,
    );
    return { ran: true, detail: result };
  } catch (e) {
    serverLog.error(
      `[nfl-cron] rosters ${week.seasonId} failed: ${(e as Error).message}`,
    );
    return { ran: true, reason: "ingest_failed", detail: (e as Error).message };
  }
}

/**
 * Pull ESPN scoreboard pour aujourd'hui. Tourne sur les jours NFL
 * uniquement.
 */
export async function espnGamedayTick(opts: {
  now?: Date;
  force?: boolean;
} = {}): Promise<TickResult> {
  const now = opts.now ?? new Date();
  if (!opts.force && !isNflGameday(now)) {
    return { ran: false, reason: "not_gameday" };
  }

  const ymd = dateYmd(now);
  try {
    const result = await ingestEspnGameday({ dateYmd: ymd });
    if (result.gamesUpdated > 0) {
      serverLog.info(
        `[nfl-cron] espn ${ymd} : games=${result.gamesUpdated} skipped=${result.gamesSkipped}`,
      );
    }
    return { ran: true, detail: result };
  } catch (e) {
    serverLog.error(`[nfl-cron] espn ${ymd} failed: ${(e as Error).message}`);
    return { ran: true, reason: "ingest_failed", detail: (e as Error).message };
  }
}

/**
 * Lock toutes les lineups de la semaine courante. Idempotent.
 *
 * Tourne uniquement dans la fenetre Sunday 17:00 UTC.
 */
export async function lockLineupsTick(opts: {
  now?: Date;
  force?: boolean;
} = {}): Promise<TickResult> {
  const now = opts.now ?? new Date();
  if (!opts.force && !isLockLineupsWindow(now)) {
    return { ran: false, reason: "out_of_window" };
  }

  const week = await findCurrentNflWeek(now);
  if (!week) {
    return { ran: false, reason: "no_current_week" };
  }

  try {
    const result = await lockLineups(week.id);
    if (result.locked > 0) {
      serverLog.info(
        `[nfl-cron] lockLineups ${week.id} : locked=${result.locked}`,
      );
    }
    return { ran: true, detail: result };
  } catch (e) {
    serverLog.error(
      `[nfl-cron] lockLineups ${week.id} failed: ${(e as Error).message}`,
    );
    return { ran: true, reason: "lock_failed", detail: (e as Error).message };
  }
}

/**
 * Pour chaque league in_progress, genere les matchups de la semaine
 * precedente (idempotent) puis settle. Idempotent end-to-end.
 *
 * Tourne uniquement dans la fenetre Tuesday 12:00 UTC.
 */
export async function settleWeekTick(opts: {
  now?: Date;
  force?: boolean;
} = {}): Promise<TickResult> {
  const now = opts.now ?? new Date();
  if (!opts.force && !isSettleWindow(now)) {
    return { ran: false, reason: "out_of_window" };
  }

  const week = await findPreviousNflWeek(now);
  if (!week) {
    return { ran: false, reason: "no_previous_week" };
  }

  const leagues = await prisma.nflFantasyLeague.findMany({
    where: { status: "in_progress", seasonId: week.seasonId },
    select: { id: true },
  });

  let totalSettled = 0;
  let totalSkipped = 0;
  const errors: Array<{ leagueId: string; error: string }> = [];

  for (const lg of leagues) {
    try {
      await generateMatchups({ leagueId: lg.id, weekId: week.id });
      const out = await settleNflFantasyWeek({ leagueId: lg.id, weekId: week.id });
      totalSettled += out.matchupsSettled;
      totalSkipped += out.matchupsSkipped;
    } catch (e) {
      errors.push({ leagueId: lg.id, error: (e as Error).message });
    }
  }

  if (totalSettled > 0 || errors.length > 0) {
    serverLog.info(
      `[nfl-cron] settle ${week.id} : leagues=${leagues.length} settled=${totalSettled} skipped=${totalSkipped} errors=${errors.length}`,
    );
  }

  // V3 — recompute des cotes dynamiques juste apres le settle.
  // Independent du resultat du settle : meme si aucune league
  // settled, les stats nflverse ont ete ingerees et meritent un
  // recompute pour la prochaine session mercato.
  try {
    const { recomputeAllPlayerValues } = await import(
      "./nfl-fantasy-player-value"
    );
    const out = await recomputeAllPlayerValues({
      weekId: week.id,
      seasonId: week.seasonId,
    });
    if (out.updated > 0) {
      serverLog.info(
        `[nfl-cron] value-recompute ${week.id} : updated=${out.updated} top-gainer=${out.topGainers[0]?.delta ?? 0} top-loser=${out.topLosers[0]?.delta ?? 0}`,
      );
    }
  } catch (e) {
    serverLog.error(
      `[nfl-cron] value-recompute ${week.id} failed : ${(e as Error).message}`,
    );
  }

  return {
    ran: true,
    detail: {
      weekId: week.id,
      leaguesProcessed: leagues.length,
      matchupsSettled: totalSettled,
      matchupsSkipped: totalSkipped,
      errors,
    },
  };
}

// ────────────────────────────────────────────────────────────────────
// Orchestrateur (5min)
// ────────────────────────────────────────────────────────────────────

/**
 * Resout toutes les sessions de mercato dont closesAt est passe et
 * dont le status est encore "open". Idempotent : marque chaque
 * session "resolved" + transactionne l'application des outcomes.
 *
 * Tourne a chaque tick (toutes les 5 min) : la fenetre temporelle
 * est implicite (closesAt <= now).
 */
export async function mercatoResolveTick(opts: {
  now?: Date;
} = {}): Promise<TickResult> {
  const now = opts.now ?? new Date();

  const due = await prisma.nflFantasyDraftSession.findMany({
    where: { status: "open", closesAt: { lte: now } },
    select: { id: true, leagueId: true, sessionNumber: true },
  });

  if (due.length === 0) {
    return { ran: false, reason: "no_due_sessions" };
  }

  type DueSession = (typeof due)[number];

  let resolved = 0;
  const errors: Array<{ sessionId: string; error: string }> = [];

  // Import dynamique : evite une dependance circulaire entre
  // nfl-fantasy-cron (importe par index.ts) et nfl-fantasy-draft-session
  // (importe par les routes mountees par index.ts).
  const { resolveSession } = await import("./nfl-fantasy-draft-session");

  for (const s of due as DueSession[]) {
    try {
      const out = await resolveSession(s.id);
      resolved += 1;
      serverLog.info(
        `[nfl-cron] mercato session ${s.id} (league ${s.leagueId} #${s.sessionNumber}) resolved : ${out.outcomes.length} outcomes`,
      );
    } catch (e) {
      errors.push({ sessionId: s.id, error: (e as Error).message });
      serverLog.error(
        `[nfl-cron] mercato session ${s.id} resolve failed : ${(e as Error).message}`,
      );
    }
  }

  return {
    ran: true,
    detail: {
      due: due.length,
      resolved,
      errors,
    },
  };
}

/**
 * Tick principal appele toutes les 5 minutes par setInterval dans
 * index.ts. Verifie chaque fenetre et appelle le tick approprie.
 *
 * Volontairement non-overlapping via runOnceAtATime cote caller.
 */
export async function nflFantasyOrchestratorTick(opts: {
  now?: Date;
} = {}): Promise<{
  nflverse: TickResult;
  rosters: TickResult;
  espn: TickResult;
  lock: TickResult;
  settle: TickResult;
  mercato: TickResult;
}> {
  const now = opts.now ?? new Date();
  // Sequenced pour eviter pression DB simultanee. Chacun retourne
  // immediatement avec { ran:false } hors de sa fenetre.
  const nflverse = await nflverseIngestTick({ now });
  const rosters = await nflverseRostersTick({ now });
  const espn = await espnGamedayTick({ now });
  const lock = await lockLineupsTick({ now });
  const settle = await settleWeekTick({ now });
  const mercato = await mercatoResolveTick({ now });
  return { nflverse, rosters, espn, lock, settle, mercato };
}
