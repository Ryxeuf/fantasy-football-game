/**
 * Pro player match history — Lot L.
 *
 * Service qui mine les replays Pro League par playerId pour
 * reconstituer l'historique per-match d'un joueur :
 *
 *   - opponent + isHome + score + outcome + scheduledAt
 *   - SPP gagnés ce match (ventilé en TD / CAS / COMP / MVP)
 *
 * On reutilise `attributeSpp` (pur) sur le replay decompresse
 * de chaque match. Coût borné par `limit` (default 5, max 20).
 *
 * Pas de table dediee `ProMatchPlayerStat` :
 *
 *   - Bornage à 5 matchs ⇒ 5 round-trips DB max + 5 attributeSpp.
 *   - Pas de migration / backfill de l'historique existant.
 *   - Évite la divergence avec `attributeSpp` (single source of truth).
 *
 * Si le besoin grossit (graphique d'évolution sur 30 matchs, leaderboard
 * SPP-by-period, etc.), créer un cache dédié devient pertinent.
 */

import { prisma } from "../prisma";
import { decompressEvents } from "@bb/sim-engine";

import { attributeSpp } from "./pro-roster-spp";

export class PlayerHistoryNotFoundError extends Error {
  constructor(playerId: string) {
    super(`ProTeamRoster id='${playerId}' introuvable`);
    this.name = "PlayerHistoryNotFoundError";
  }
}

export interface PlayerMatchSppDelta {
  readonly tdCount: number;
  readonly casCount: number;
  readonly compCount: number;
  readonly mvpCount: number;
  readonly totalSpp: number;
}

export interface PlayerMatchHistoryEntry {
  readonly matchId: string;
  readonly roundNumber: number;
  readonly scheduledAt: string;
  readonly status: string;
  readonly isHome: boolean;
  readonly opponent: {
    readonly slug: string;
    readonly name: string;
    readonly city: string;
    readonly primaryColor: string | null;
  };
  readonly scoreHome: number | null;
  readonly scoreAway: number | null;
  readonly outcome: string | null;
  readonly spp: PlayerMatchSppDelta;
}

const ZERO_DELTA: PlayerMatchSppDelta = {
  tdCount: 0,
  casCount: 0,
  compCount: 0,
  mvpCount: 0,
  totalSpp: 0,
};

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

interface ReplayMineRow {
  payload: Buffer | null;
}

interface RawMatch {
  id: string;
  status: string;
  scheduledAt: Date | null;
  homeTeamId: string;
  awayTeamId: string;
  scoreHome: number | null;
  scoreAway: number | null;
  outcome: string | null;
  seed: bigint | number | null;
  round: { roundNumber: number } | null;
  homeTeam: {
    slug: string;
    name: string;
    city: string;
    primaryColor: string | null;
  };
  awayTeam: {
    slug: string;
    name: string;
    city: string;
    primaryColor: string | null;
  };
}

async function deltaForMatch(
  match: RawMatch,
  playerId: string,
  playerTeamId: string,
): Promise<PlayerMatchSppDelta> {
  if (match.status !== "completed" && match.status !== "ready") {
    return ZERO_DELTA;
  }
  const replay = (await prisma.replay.findUnique({
    where: { matchId: match.id },
    select: { payload: true },
  })) as ReplayMineRow | null;
  if (!replay || !replay.payload) return ZERO_DELTA;

  let events: readonly unknown[];
  try {
    events = await decompressEvents(replay.payload);
  } catch {
    return ZERO_DELTA;
  }

  // Casualties extraites depuis les events (le replay est la verite).
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

  // Pour le scoring MVP, attributeSpp a besoin des sets home/away.
  // On charge les rosters actifs des 2 teams.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const home = (await prisma.proTeamRoster.findMany({
    where: { teamId: match.homeTeamId, status: "active" },
    select: { id: true },
  })) as Array<{ id: string }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const away = (await prisma.proTeamRoster.findMany({
    where: { teamId: match.awayTeamId, status: "active" },
    select: { id: true },
  })) as Array<{ id: string }>;
  const homeIds = new Set(home.map((r) => r.id));
  const awayIds = new Set(away.map((r) => r.id));

  // Si le joueur a été retired/dead entre temps, il ne sera plus dans les
  // sets — on l'ajoute manuellement côté correct pour qu'attributeSpp
  // identifie les rewards le concernant.
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
  if (!own) return ZERO_DELTA;
  return {
    tdCount: own.tdCount,
    casCount: own.casCount,
    compCount: own.compCount,
    mvpCount: own.mvpCount,
    totalSpp: own.totalSpp,
  };
}

export async function getPlayerMatchHistory(
  playerId: string,
  limit = DEFAULT_LIMIT,
): Promise<readonly PlayerMatchHistoryEntry[]> {
  const cap = Math.min(Math.max(1, Math.floor(limit)), MAX_LIMIT);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const player = (await prisma.proTeamRoster.findUnique({
    where: { id: playerId },
    select: { teamId: true },
  })) as { teamId: string } | null;
  if (!player) {
    throw new PlayerHistoryNotFoundError(playerId);
  }

  // Derniers matchs joués par l'équipe du joueur, status completed/ready.
  const matchesRaw = (await prisma.proLeagueMatch.findMany({
    where: {
      OR: [{ homeTeamId: player.teamId }, { awayTeamId: player.teamId }],
      status: { in: ["completed", "ready"] },
    },
    orderBy: { scheduledAt: "desc" },
    take: cap,
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      homeTeamId: true,
      awayTeamId: true,
      scoreHome: true,
      scoreAway: true,
      outcome: true,
      seed: true,
      round: { select: { roundNumber: true } },
      homeTeam: {
        select: { slug: true, name: true, city: true, primaryColor: true },
      },
      awayTeam: {
        select: { slug: true, name: true, city: true, primaryColor: true },
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as any as RawMatch[];

  const out: PlayerMatchHistoryEntry[] = [];
  for (const match of matchesRaw) {
    const isHome = match.homeTeamId === player.teamId;
    const opponent = isHome ? match.awayTeam : match.homeTeam;
    const delta = await deltaForMatch(match, playerId, player.teamId);
    out.push({
      matchId: match.id,
      roundNumber: match.round?.roundNumber ?? 0,
      scheduledAt:
        match.scheduledAt instanceof Date
          ? match.scheduledAt.toISOString()
          : new Date(match.scheduledAt as unknown as string).toISOString(),
      status: match.status,
      isHome,
      opponent: {
        slug: opponent.slug,
        name: opponent.name,
        city: opponent.city,
        primaryColor: opponent.primaryColor,
      },
      scoreHome: match.scoreHome,
      scoreAway: match.scoreAway,
      outcome: match.outcome,
      spp: delta,
    });
  }
  return out;
}
