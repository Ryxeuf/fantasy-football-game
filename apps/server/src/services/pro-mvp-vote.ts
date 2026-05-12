/**
 * Sprint Q lot Q.B.1 — Service vote MVP (Player of the Match).
 *
 * Mecaniques :
 *  - getMvpCandidates(matchId) : retourne les top SPP du match (5 max)
 *    en parsant le replay via attributeSpp (deja utilise par
 *    pro-player-match-history). Public.
 *  - submitVote({ userId, matchId, votedRosterId }) : valide :
 *    - match completed
 *    - dans la fenetre 24h depuis completedAt
 *    - votedRosterId est dans les candidates
 *    Upsert : si un vote existe deja pour (user, match), il est
 *    remplace (le user peut changer d'avis dans la window).
 *  - getVoteTally(matchId) : tally par votedRosterId, ordonne par
 *    count desc.
 *  - getWeeklyMvpLeaderboard() : top voted players sur les 7 derniers
 *    jours.
 *
 * Voir CASUALTY events + attributeSpp pour la logique candidates.
 */

import { prisma } from "../prisma";
import { decompressEvents } from "@bb/sim-engine";

import { attributeSpp } from "./pro-roster-spp";

/** Window de vote post-match, en millisecondes. */
export const VOTE_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Nombre max de candidats par match. */
export const MAX_CANDIDATES = 5;
/** Window weekly leaderboard. */
export const WEEKLY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type MvpErrorCode =
  | "MATCH_NOT_FOUND"
  | "MATCH_NOT_COMPLETED"
  | "VOTE_WINDOW_CLOSED"
  | "INVALID_CANDIDATE"
  | "NO_CANDIDATES";

export class MvpError extends Error {
  constructor(
    public readonly code: MvpErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "MvpError";
  }
}

export interface MvpCandidate {
  readonly rosterId: string;
  readonly name: string;
  readonly position: string;
  readonly teamSlug: string;
  readonly teamName: string;
  readonly sppGained: number;
  readonly tdCount: number;
  readonly casCount: number;
  readonly mvpCount: number;
}

interface MatchRow {
  id: string;
  status: string;
  completedAt: Date | null;
  homeTeamId: string;
  awayTeamId: string;
  seed: bigint | number | null;
}

/**
 * Retourne les top SPP candidates pour un match completed. Renvoie
 * jusqu'a 5 joueurs (decroissant par totalSpp).
 */
export async function getMvpCandidates(
  matchId: string,
): Promise<readonly MvpCandidate[]> {
  const match = (await prisma.proLeagueMatch.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      status: true,
      completedAt: true,
      homeTeamId: true,
      awayTeamId: true,
      seed: true,
    },
  })) as MatchRow | null;

  if (!match) throw new MvpError("MATCH_NOT_FOUND", "Match introuvable");
  if (match.status !== "completed") return [];

  const replay = (await prisma.replay.findUnique({
    where: { matchId },
    select: { payload: true },
  })) as { payload: Buffer | null } | null;
  if (!replay || !replay.payload) return [];

  let events: readonly unknown[];
  try {
    events = await decompressEvents(replay.payload);
  } catch {
    return [];
  }

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

  // Garde uniquement les rewards positifs (totalSpp > 0), trie desc
  // par totalSpp, prend top 5.
  const top = rewards
    .filter((r) => r.totalSpp > 0)
    .sort((a, b) => b.totalSpp - a.totalSpp)
    .slice(0, MAX_CANDIDATES);

  if (top.length === 0) return [];

  // Hydrate les details depuis ProTeamRoster.
  const rosterIds = top.map((r) => r.rosterId);
  const rosters = (await prisma.proTeamRoster.findMany({
    where: { id: { in: rosterIds } },
    select: {
      id: true,
      name: true,
      position: true,
      team: { select: { slug: true, name: true } },
    },
  })) as Array<{
    id: string;
    name: string;
    position: string;
    team: { slug: string; name: string };
  }>;
  const byId = new Map(rosters.map((r) => [r.id, r]));

  const candidates: MvpCandidate[] = [];
  for (const r of top) {
    const info = byId.get(r.rosterId);
    if (!info) continue;
    candidates.push({
      rosterId: r.rosterId,
      name: info.name,
      position: info.position,
      teamSlug: info.team.slug,
      teamName: info.team.name,
      sppGained: r.totalSpp,
      tdCount: r.tdCount,
      casCount: r.casCount,
      mvpCount: r.mvpCount,
    });
  }

  return candidates;
}

export interface SubmitVoteInput {
  readonly userId: string;
  readonly matchId: string;
  readonly votedRosterId: string;
}

export interface SubmitVoteResult {
  readonly voteId: string;
  readonly matchId: string;
  readonly votedRosterId: string;
  readonly isUpdate: boolean;
}

/**
 * Submit ou update un vote MVP pour un match.
 */
export async function submitVote(
  input: SubmitVoteInput,
): Promise<SubmitVoteResult> {
  const match = (await prisma.proLeagueMatch.findUnique({
    where: { id: input.matchId },
    select: { id: true, status: true, completedAt: true },
  })) as {
    id: string;
    status: string;
    completedAt: Date | null;
  } | null;

  if (!match) {
    throw new MvpError("MATCH_NOT_FOUND", "Match introuvable");
  }
  if (match.status !== "completed" || !match.completedAt) {
    throw new MvpError(
      "MATCH_NOT_COMPLETED",
      "Vote possible uniquement sur un match completed",
    );
  }

  const elapsed = Date.now() - match.completedAt.getTime();
  if (elapsed > VOTE_WINDOW_MS) {
    throw new MvpError(
      "VOTE_WINDOW_CLOSED",
      "Fenetre de vote fermee (24h post-match)",
    );
  }

  const candidates = await getMvpCandidates(input.matchId);
  if (candidates.length === 0) {
    throw new MvpError(
      "NO_CANDIDATES",
      "Aucun candidat MVP pour ce match",
    );
  }
  if (!candidates.some((c) => c.rosterId === input.votedRosterId)) {
    throw new MvpError(
      "INVALID_CANDIDATE",
      "Ce joueur n'est pas dans les candidats MVP",
    );
  }

  const existing = (await prisma.proPlayerOfMatchVote.findUnique({
    where: {
      userId_matchId: {
        userId: input.userId,
        matchId: input.matchId,
      },
    },
    select: { id: true },
  })) as { id: string } | null;

  const upserted = (await prisma.proPlayerOfMatchVote.upsert({
    where: {
      userId_matchId: {
        userId: input.userId,
        matchId: input.matchId,
      },
    },
    update: { votedRosterId: input.votedRosterId },
    create: {
      userId: input.userId,
      matchId: input.matchId,
      votedRosterId: input.votedRosterId,
    },
    select: { id: true, votedRosterId: true },
  })) as { id: string; votedRosterId: string };

  return {
    voteId: upserted.id,
    matchId: input.matchId,
    votedRosterId: upserted.votedRosterId,
    isUpdate: existing !== null,
  };
}

export interface TallyEntry {
  readonly rosterId: string;
  readonly count: number;
}

export interface VoteTally {
  readonly matchId: string;
  readonly totalVotes: number;
  readonly entries: readonly TallyEntry[];
  /** Le winner (rosterId avec le plus de votes) ou null si 0 votes /
   *  egalite parfaite a 0. En cas d'egalite a >0, retourne le 1er par
   *  ordre alpha (deterministe, pas de jackpot a coin flip). */
  readonly winnerRosterId: string | null;
  readonly windowClosesAt: string | null;
}

/** Tally tous les votes du match. */
export async function getVoteTally(matchId: string): Promise<VoteTally> {
  const match = (await prisma.proLeagueMatch.findUnique({
    where: { id: matchId },
    select: { id: true, completedAt: true },
  })) as { id: string; completedAt: Date | null } | null;

  if (!match) {
    throw new MvpError("MATCH_NOT_FOUND", "Match introuvable");
  }

  const grouped = (await prisma.proPlayerOfMatchVote.groupBy({
    by: ["votedRosterId"],
    where: { matchId },
    _count: { _all: true },
  })) as Array<{ votedRosterId: string; _count: { _all: number } }>;

  const entries: TallyEntry[] = grouped
    .map((g) => ({ rosterId: g.votedRosterId, count: g._count._all }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.rosterId.localeCompare(b.rosterId);
    });

  const totalVotes = entries.reduce((sum, e) => sum + e.count, 0);
  const winnerRosterId =
    entries.length > 0 && entries[0].count > 0 ? entries[0].rosterId : null;
  const windowClosesAt = match.completedAt
    ? new Date(match.completedAt.getTime() + VOTE_WINDOW_MS).toISOString()
    : null;

  return {
    matchId,
    totalVotes,
    entries,
    winnerRosterId,
    windowClosesAt,
  };
}

export interface WeeklyMvpEntry {
  readonly rosterId: string;
  readonly name: string;
  readonly position: string;
  readonly teamSlug: string;
  readonly teamName: string;
  readonly voteCount: number;
}

/**
 * Top voted players sur les 7 derniers jours. Trie par voteCount desc.
 */
export async function getWeeklyMvpLeaderboard(
  limit: number = 10,
): Promise<readonly WeeklyMvpEntry[]> {
  const sinceAt = new Date(Date.now() - WEEKLY_WINDOW_MS);
  const grouped = (await prisma.proPlayerOfMatchVote.groupBy({
    by: ["votedRosterId"],
    where: { createdAt: { gte: sinceAt } },
    _count: { _all: true },
  })) as Array<{ votedRosterId: string; _count: { _all: number } }>;

  if (grouped.length === 0) return [];

  const sorted = grouped
    .map((g) => ({ rosterId: g.votedRosterId, voteCount: g._count._all }))
    .sort((a, b) => {
      if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
      return a.rosterId.localeCompare(b.rosterId);
    })
    .slice(0, Math.max(1, limit));

  const rosterIds = sorted.map((s) => s.rosterId);
  const rosters = (await prisma.proTeamRoster.findMany({
    where: { id: { in: rosterIds } },
    select: {
      id: true,
      name: true,
      position: true,
      team: { select: { slug: true, name: true } },
    },
  })) as Array<{
    id: string;
    name: string;
    position: string;
    team: { slug: string; name: string };
  }>;
  const byId = new Map(rosters.map((r) => [r.id, r]));

  const result: WeeklyMvpEntry[] = [];
  for (const s of sorted) {
    const info = byId.get(s.rosterId);
    if (!info) continue;
    result.push({
      rosterId: s.rosterId,
      name: info.name,
      position: info.position,
      teamSlug: info.team.slug,
      teamName: info.team.name,
      voteCount: s.voteCount,
    });
  }
  return result;
}
