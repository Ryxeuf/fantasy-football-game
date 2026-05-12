/**
 * Sprint Q lot Q.A.1 — Service stats career joueur.
 *
 * Le service expose 2 fonctions principales :
 *
 *   - `getCareerSnapshot(playerId)` : retourne le snapshot persistant.
 *     Si stale (recomputedAt > STALE_WINDOW) ou manquant, declenche
 *     un recompute synchrone et persist.
 *
 *   - `recomputeCareerSnapshot(playerId)` : full recompute en scannant
 *     les derniers matchs (cap STATS_MATCH_CAP) de la team du joueur.
 *     Reutilise `attributeSpp` (pur) sur les replays decompresses pour
 *     extraire les rewards per-match.
 *
 * Le compute lazy evite un job cron : c'est l'utilisateur qui
 * "paye" le recompute quand il ouvre la page career. Coup raisonnable
 * (~ 50 replays decompresses = quelques centaines de ms).
 */

import { prisma } from "../prisma";
import { decompressEvents } from "@bb/sim-engine";

import { attributeSpp } from "./pro-roster-spp";

/** Cap des matchs scannes pour limiter le cout du recompute. */
export const STATS_MATCH_CAP = 50;

/** Fenetre de validite d'un snapshot avant recompute lazy. 1h. */
export const STALE_WINDOW_MS = 60 * 60 * 1000;

export class PlayerCareerNotFoundError extends Error {
  constructor(playerId: string) {
    super(`ProTeamRoster id='${playerId}' introuvable`);
    this.name = "PlayerCareerNotFoundError";
  }
}

export type StreakKind = "win" | "loss" | "draw" | "none";

export interface CareerSnapshotData {
  readonly playerId: string;
  readonly matchesPlayed: number;
  readonly tdTotal: number;
  readonly casTotal: number;
  readonly compTotal: number;
  readonly mvpTotal: number;
  readonly sppTotal: number;
  readonly bestMatchId: string | null;
  readonly bestMatchSpp: number | null;
  readonly worstMatchId: string | null;
  readonly worstMatchSpp: number | null;
  readonly topNemesisTeamId: string | null;
  readonly topVictoryTeamId: string | null;
  readonly streakKind: StreakKind;
  readonly streakLength: number;
  readonly recomputedAt: Date;
}

/** Determine le resultat d'un match du point de vue du joueur (team locale). */
export function outcomeForPlayerTeam(
  matchOutcome: string | null,
  playerIsHome: boolean,
): "win" | "loss" | "draw" | null {
  if (matchOutcome === null) return null;
  if (matchOutcome === "draw") return "draw";
  if (matchOutcome === "home") return playerIsHome ? "win" : "loss";
  if (matchOutcome === "away") return playerIsHome ? "loss" : "win";
  return null;
}

interface RawMatch {
  id: string;
  status: string;
  scheduledAt: Date | null;
  homeTeamId: string;
  awayTeamId: string;
  outcome: string | null;
  seed: bigint | number | null;
}

interface MatchContribution {
  readonly matchId: string;
  readonly opponentTeamId: string;
  readonly outcome: "win" | "loss" | "draw";
  readonly totalSpp: number;
  readonly td: number;
  readonly cas: number;
  readonly comp: number;
  readonly mvp: number;
}

export type { MatchContribution };

/**
 * Pour un match donne, compute la contribution stat du joueur (SPP,
 * TD, CAS, etc.) en decompressant le replay et en utilisant
 * attributeSpp. Si pas de replay ou pas d'outcome → returns null
 * (n'est pas comptabilise).
 */
async function contributionForMatch(
  match: RawMatch,
  playerId: string,
  playerTeamId: string,
): Promise<MatchContribution | null> {
  if (match.outcome === null) return null;

  const replay = (await prisma.replay.findUnique({
    where: { matchId: match.id },
    select: { payload: true },
  })) as { payload: Buffer | null } | null;
  if (!replay || !replay.payload) return null;

  let events: readonly unknown[];
  try {
    events = await decompressEvents(replay.payload);
  } catch {
    return null;
  }

  // Casualties extraites des events.
  const casualtiesFromEvents: Array<{
    playerId: string;
    team: string;
    causedById?: string;
    outcome: string;
  }> = [];
  for (const ev of events) {
    if (!ev || typeof ev !== "object") continue;
    const e = ev as { type?: unknown; meta?: unknown };
    if (e.type !== "CASUALTY") continue;
    const meta = (e.meta ?? {}) as Record<string, unknown>;
    const causedBy =
      typeof meta.causedBy === "string"
        ? meta.causedBy
        : typeof meta.causedById === "string"
          ? meta.causedById
          : undefined;
    casualtiesFromEvents.push({
      playerId: String(meta.playerId ?? ""),
      team: String(meta.team ?? ""),
      causedById: causedBy,
      outcome: String(meta.outcome ?? "badly_hurt"),
    });
  }

  const homeRows = (await prisma.proTeamRoster.findMany({
    where: { teamId: match.homeTeamId, status: "active" },
    select: { id: true },
  })) as Array<{ id: string }>;
  const awayRows = (await prisma.proTeamRoster.findMany({
    where: { teamId: match.awayTeamId, status: "active" },
    select: { id: true },
  })) as Array<{ id: string }>;
  const homeIds = new Set(homeRows.map((r) => r.id));
  const awayIds = new Set(awayRows.map((r) => r.id));

  if (!homeIds.has(playerId) && !awayIds.has(playerId)) {
    if (playerTeamId === match.homeTeamId) homeIds.add(playerId);
    else if (playerTeamId === match.awayTeamId) awayIds.add(playerId);
  }

  const seedNum =
    typeof match.seed === "bigint"
      ? Number(match.seed)
      : Number(match.seed ?? 0);

  const { rewards } = attributeSpp({
    seed: seedNum,
    events,
    casualties: casualtiesFromEvents,
    homeRosterIds: homeIds,
    awayRosterIds: awayIds,
  });
  const own = rewards.find((r) => r.rosterId === playerId);
  if (!own) return null;

  const isHome = playerTeamId === match.homeTeamId;
  const opponentTeamId = isHome ? match.awayTeamId : match.homeTeamId;
  const outcome = outcomeForPlayerTeam(match.outcome, isHome);
  if (outcome === null) return null;

  return {
    matchId: match.id,
    opponentTeamId,
    outcome,
    totalSpp: own.totalSpp,
    td: own.tdCount,
    cas: own.casCount,
    comp: own.compCount,
    mvp: own.mvpCount,
  };
}

/**
 * Compute le streak en cours a partir des contributions ordonnees
 * du plus recent au plus ancien. Renvoie kind + length.
 */
export function computeCurrentStreak(
  contributionsNewestFirst: ReadonlyArray<Pick<MatchContribution, "outcome">>,
): { kind: StreakKind; length: number } {
  if (contributionsNewestFirst.length === 0) {
    return { kind: "none", length: 0 };
  }
  const first = contributionsNewestFirst[0].outcome;
  let length = 1;
  for (let i = 1; i < contributionsNewestFirst.length; i += 1) {
    if (contributionsNewestFirst[i].outcome !== first) break;
    length += 1;
  }
  return { kind: first, length };
}

/** Compte le top opponent par filtre (par exemple "loss" pour nemesis). */
export function topOpponent(
  contributions: ReadonlyArray<MatchContribution>,
  filter: "win" | "loss",
): string | null {
  const counts = new Map<string, number>();
  for (const c of contributions) {
    if (c.outcome !== filter) continue;
    counts.set(c.opponentTeamId, (counts.get(c.opponentTeamId) ?? 0) + 1);
  }
  let topId: string | null = null;
  let topCount = 0;
  for (const [id, count] of counts) {
    if (count > topCount) {
      topId = id;
      topCount = count;
    }
  }
  return topId;
}

interface AggregatedSnapshot {
  matchesPlayed: number;
  tdTotal: number;
  casTotal: number;
  compTotal: number;
  mvpTotal: number;
  sppTotal: number;
  bestMatchId: string | null;
  bestMatchSpp: number | null;
  worstMatchId: string | null;
  worstMatchSpp: number | null;
  topNemesisTeamId: string | null;
  topVictoryTeamId: string | null;
  streakKind: StreakKind;
  streakLength: number;
}

/** Agrege les contributions en un snapshot. Logique pure, testable. */
export function aggregateContributions(
  contributionsNewestFirst: ReadonlyArray<MatchContribution>,
): AggregatedSnapshot {
  if (contributionsNewestFirst.length === 0) {
    return {
      matchesPlayed: 0,
      tdTotal: 0,
      casTotal: 0,
      compTotal: 0,
      mvpTotal: 0,
      sppTotal: 0,
      bestMatchId: null,
      bestMatchSpp: null,
      worstMatchId: null,
      worstMatchSpp: null,
      topNemesisTeamId: null,
      topVictoryTeamId: null,
      streakKind: "none",
      streakLength: 0,
    };
  }

  let tdTotal = 0;
  let casTotal = 0;
  let compTotal = 0;
  let mvpTotal = 0;
  let sppTotal = 0;
  let bestMatchId: string | null = null;
  let bestMatchSpp: number | null = null;
  let worstMatchId: string | null = null;
  let worstMatchSpp: number | null = null;

  for (const c of contributionsNewestFirst) {
    tdTotal += c.td;
    casTotal += c.cas;
    compTotal += c.comp;
    mvpTotal += c.mvp;
    sppTotal += c.totalSpp;
    if (bestMatchSpp === null || c.totalSpp > bestMatchSpp) {
      bestMatchSpp = c.totalSpp;
      bestMatchId = c.matchId;
    }
    if (worstMatchSpp === null || c.totalSpp < worstMatchSpp) {
      worstMatchSpp = c.totalSpp;
      worstMatchId = c.matchId;
    }
  }

  const streak = computeCurrentStreak(contributionsNewestFirst);

  return {
    matchesPlayed: contributionsNewestFirst.length,
    tdTotal,
    casTotal,
    compTotal,
    mvpTotal,
    sppTotal,
    bestMatchId,
    bestMatchSpp,
    worstMatchId,
    worstMatchSpp,
    topNemesisTeamId: topOpponent(contributionsNewestFirst, "loss"),
    topVictoryTeamId: topOpponent(contributionsNewestFirst, "win"),
    streakKind: streak.kind,
    streakLength: streak.length,
  };
}

/** Full recompute + upsert du snapshot. */
export async function recomputeCareerSnapshot(
  playerId: string,
): Promise<CareerSnapshotData> {
  const player = (await prisma.proTeamRoster.findUnique({
    where: { id: playerId },
    select: { teamId: true },
  })) as { teamId: string } | null;
  if (!player) {
    throw new PlayerCareerNotFoundError(playerId);
  }

  const matchesRaw = (await prisma.proLeagueMatch.findMany({
    where: {
      OR: [{ homeTeamId: player.teamId }, { awayTeamId: player.teamId }],
      status: "completed",
    },
    orderBy: { scheduledAt: "desc" },
    take: STATS_MATCH_CAP,
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      homeTeamId: true,
      awayTeamId: true,
      outcome: true,
      seed: true,
    },
  })) as RawMatch[];

  const contributions: MatchContribution[] = [];
  for (const m of matchesRaw) {
    const c = await contributionForMatch(m, playerId, player.teamId);
    if (c) contributions.push(c);
  }

  const aggregate = aggregateContributions(contributions);
  const now = new Date();

  await prisma.proPlayerCareerSnapshot.upsert({
    where: { playerId },
    create: {
      playerId,
      ...aggregate,
      recomputedAt: now,
    },
    update: {
      ...aggregate,
      recomputedAt: now,
    },
  });

  return {
    playerId,
    ...aggregate,
    recomputedAt: now,
  };
}

/**
 * Retourne le snapshot. Si manquant ou stale (recomputedAt >
 * STALE_WINDOW_MS), declenche un recompute synchrone.
 */
export async function getCareerSnapshot(
  playerId: string,
): Promise<CareerSnapshotData> {
  const existing = (await prisma.proPlayerCareerSnapshot.findUnique({
    where: { playerId },
  })) as {
    playerId: string;
    matchesPlayed: number;
    tdTotal: number;
    casTotal: number;
    compTotal: number;
    mvpTotal: number;
    sppTotal: number;
    bestMatchId: string | null;
    bestMatchSpp: number | null;
    worstMatchId: string | null;
    worstMatchSpp: number | null;
    topNemesisTeamId: string | null;
    topVictoryTeamId: string | null;
    streakKind: string;
    streakLength: number;
    recomputedAt: Date;
  } | null;

  const isStale =
    existing === null ||
    Date.now() - new Date(existing.recomputedAt).getTime() >= STALE_WINDOW_MS;

  if (isStale) {
    return recomputeCareerSnapshot(playerId);
  }

  return {
    playerId: existing.playerId,
    matchesPlayed: existing.matchesPlayed,
    tdTotal: existing.tdTotal,
    casTotal: existing.casTotal,
    compTotal: existing.compTotal,
    mvpTotal: existing.mvpTotal,
    sppTotal: existing.sppTotal,
    bestMatchId: existing.bestMatchId,
    bestMatchSpp: existing.bestMatchSpp,
    worstMatchId: existing.worstMatchId,
    worstMatchSpp: existing.worstMatchSpp,
    topNemesisTeamId: existing.topNemesisTeamId,
    topVictoryTeamId: existing.topVictoryTeamId,
    streakKind: existing.streakKind as StreakKind,
    streakLength: existing.streakLength,
    recomputedAt: new Date(existing.recomputedAt),
  };
}
