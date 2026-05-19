/**
 * Sprint Q lot Q.A.3 — Service rivalry head-to-head pour Pro League.
 *
 * Calcule les statistiques de rivalite entre 2 teams (W-D-L bilan,
 * total TDs, dernier match) et les top rivaux d'une team (les N teams
 * les plus affrontees en matches completed, avec leur bilan).
 *
 * Logique 100% derived de `ProLeagueMatch` : aucune table dediee, on
 * agrege les matchs `completed` avec `outcome != null`.
 */

import { prisma } from "../prisma";

export class TeamNotFoundError extends Error {
  constructor(teamRef: string) {
    super(`ProTeam '${teamRef}' introuvable`);
    this.name = "TeamNotFoundError";
  }
}

export interface TeamBrief {
  readonly id: string;
  readonly slug: string;
  readonly city: string;
  readonly name: string;
  readonly race: string;
  readonly primaryColor: string | null;
  readonly secondaryColor: string | null;
}

export interface RivalryRecord {
  /** Nb total de matches completed entre les deux teams. */
  readonly totalMatches: number;
  /** Victoires de teamA. */
  readonly winsA: number;
  /** Victoires de teamB. */
  readonly winsB: number;
  /** Nuls. */
  readonly draws: number;
  /** Total TDs marques par teamA (au cumul des head-to-head). */
  readonly totalTdA: number;
  /** Total TDs marques par teamB. */
  readonly totalTdB: number;
}

export interface MatchBrief {
  readonly matchId: string;
  readonly seasonYear: number | null;
  readonly scheduledAt: string | null;
  readonly homeTeamId: string;
  readonly awayTeamId: string;
  readonly scoreHome: number | null;
  readonly scoreAway: number | null;
  readonly outcome: "home" | "away" | "draw" | null;
}

export interface RivalrySummary {
  readonly teamA: TeamBrief;
  readonly teamB: TeamBrief;
  readonly record: RivalryRecord;
  /** Match le plus recent (ordonne par scheduledAt desc). */
  readonly lastMatch: MatchBrief | null;
  /** Streak de teamA en cours (depuis le match le plus recent). */
  readonly streakA: {
    readonly kind: "win" | "loss" | "draw" | "none";
    readonly length: number;
  };
  /** Liste des matchs head-to-head (newest first, cap 20). */
  readonly recentMatches: readonly MatchBrief[];
}

export interface TopRivalEntry {
  readonly team: TeamBrief;
  readonly totalMatches: number;
  readonly winsFor: number;
  readonly winsAgainst: number;
  readonly draws: number;
  readonly lastMatch: MatchBrief | null;
}

const HEAD_TO_HEAD_LIMIT = 20;
// Audit round 10 (HIGH/perf) : avant, `getHeadToHead` et `getTopRivals`
// faisaient un findMany sans `take` sur ProLeagueMatch.
// Pour une equipe pro qui joue chaque semaine pendant plusieurs saisons,
// le result set grandit indefiniment. Cap a 200 matches recents :
// au-dela, les matches plus anciens n'influencent ni le top rival ni
// la `recentMatches` slice (HEAD_TO_HEAD_LIMIT = 20).
const RIVALRY_MATCH_SCAN_CAP = 200;

interface MatchRow {
  id: string;
  seasonId: string;
  scheduledAt: Date | null;
  homeTeamId: string;
  awayTeamId: string;
  scoreHome: number | null;
  scoreAway: number | null;
  outcome: string | null;
  season: { year: number } | null;
}

function toMatchBrief(m: MatchRow): MatchBrief {
  const outcomeRaw = m.outcome;
  const outcome: "home" | "away" | "draw" | null =
    outcomeRaw === "home" || outcomeRaw === "away" || outcomeRaw === "draw"
      ? outcomeRaw
      : null;
  return {
    matchId: m.id,
    seasonYear: m.season?.year ?? null,
    scheduledAt:
      m.scheduledAt instanceof Date
        ? m.scheduledAt.toISOString()
        : null,
    homeTeamId: m.homeTeamId,
    awayTeamId: m.awayTeamId,
    scoreHome: m.scoreHome,
    scoreAway: m.scoreAway,
    outcome,
  };
}

/** Compte W-D-L pour teamA sur une liste de matchs head-to-head. */
export function computeRecord(
  teamAId: string,
  matches: ReadonlyArray<MatchBrief>,
): RivalryRecord {
  let winsA = 0;
  let winsB = 0;
  let draws = 0;
  let totalTdA = 0;
  let totalTdB = 0;
  for (const m of matches) {
    if (m.outcome === null) continue;
    const aIsHome = m.homeTeamId === teamAId;
    if (m.outcome === "draw") draws += 1;
    else if (m.outcome === "home") {
      if (aIsHome) winsA += 1;
      else winsB += 1;
    } else {
      // outcome === "away"
      if (aIsHome) winsB += 1;
      else winsA += 1;
    }
    const scoreHome = m.scoreHome ?? 0;
    const scoreAway = m.scoreAway ?? 0;
    if (aIsHome) {
      totalTdA += scoreHome;
      totalTdB += scoreAway;
    } else {
      totalTdA += scoreAway;
      totalTdB += scoreHome;
    }
  }
  return {
    totalMatches: matches.filter((m) => m.outcome !== null).length,
    winsA,
    winsB,
    draws,
    totalTdA,
    totalTdB,
  };
}

/** Calcule le streak en cours de teamA depuis les matches ordonnes
 *  newest first. Voir aussi `computeCurrentStreak` dans pro-player-career-stats. */
export function computeRivalryStreak(
  teamAId: string,
  matchesNewestFirst: ReadonlyArray<MatchBrief>,
): { kind: "win" | "loss" | "draw" | "none"; length: number } {
  const settled = matchesNewestFirst.filter((m) => m.outcome !== null);
  if (settled.length === 0) return { kind: "none", length: 0 };

  function teamAOutcome(m: MatchBrief): "win" | "loss" | "draw" {
    if (m.outcome === "draw") return "draw";
    const aIsHome = m.homeTeamId === teamAId;
    if (m.outcome === "home") return aIsHome ? "win" : "loss";
    return aIsHome ? "loss" : "win";
  }

  const first = teamAOutcome(settled[0]);
  let length = 1;
  for (let i = 1; i < settled.length; i += 1) {
    if (teamAOutcome(settled[i]) !== first) break;
    length += 1;
  }
  return { kind: first, length };
}

async function loadTeamBriefById(teamId: string): Promise<TeamBrief> {
  const team = (await prisma.proTeam.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      slug: true,
      city: true,
      name: true,
      race: true,
      primaryColor: true,
      secondaryColor: true,
    },
  })) as TeamBrief | null;
  if (!team) {
    throw new TeamNotFoundError(teamId);
  }
  return team;
}

async function loadTeamBriefBySlug(slug: string): Promise<TeamBrief> {
  const team = (await prisma.proTeam.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      city: true,
      name: true,
      race: true,
      primaryColor: true,
      secondaryColor: true,
    },
  })) as TeamBrief | null;
  if (!team) {
    throw new TeamNotFoundError(slug);
  }
  return team;
}

/**
 * Charge l'historique complet head-to-head entre deux teams.
 *
 * Retourne tous les matchs `completed` ordonnes newest first. Le cap
 * HEAD_TO_HEAD_LIMIT cap les "recentMatches" exposes en sortie ; le
 * bilan W-D-L est calcule sur l'ensemble.
 */
export async function getHeadToHead(
  teamASlug: string,
  teamBSlug: string,
): Promise<RivalrySummary> {
  const [teamA, teamB] = await Promise.all([
    loadTeamBriefBySlug(teamASlug),
    loadTeamBriefBySlug(teamBSlug),
  ]);

  const matchesRaw = (await prisma.proLeagueMatch.findMany({
    where: {
      status: "completed",
      OR: [
        { homeTeamId: teamA.id, awayTeamId: teamB.id },
        { homeTeamId: teamB.id, awayTeamId: teamA.id },
      ],
    },
    orderBy: { scheduledAt: "desc" },
    take: RIVALRY_MATCH_SCAN_CAP,
    select: {
      id: true,
      seasonId: true,
      scheduledAt: true,
      homeTeamId: true,
      awayTeamId: true,
      scoreHome: true,
      scoreAway: true,
      outcome: true,
      season: { select: { year: true } },
    },
  })) as MatchRow[];

  const matchesBrief = matchesRaw.map(toMatchBrief);
  const record = computeRecord(teamA.id, matchesBrief);
  const streakA = computeRivalryStreak(teamA.id, matchesBrief);
  const lastMatch = matchesBrief.find((m) => m.outcome !== null) ?? null;

  return {
    teamA,
    teamB,
    record,
    lastMatch,
    streakA,
    recentMatches: matchesBrief.slice(0, HEAD_TO_HEAD_LIMIT),
  };
}

/**
 * Top N teams les plus affrontees par `teamSlug` en matches completed.
 * Pour chaque rival : bilan W-D-L + lastMatch.
 *
 * Ordre : par totalMatches desc, puis par slug asc (tie-break).
 */
export async function getTopRivals(
  teamSlug: string,
  limit: number = 3,
): Promise<readonly TopRivalEntry[]> {
  if (limit < 1) return [];
  const team = await loadTeamBriefBySlug(teamSlug);

  const matchesRaw = (await prisma.proLeagueMatch.findMany({
    where: {
      status: "completed",
      OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }],
    },
    orderBy: { scheduledAt: "desc" },
    take: RIVALRY_MATCH_SCAN_CAP,
    select: {
      id: true,
      seasonId: true,
      scheduledAt: true,
      homeTeamId: true,
      awayTeamId: true,
      scoreHome: true,
      scoreAway: true,
      outcome: true,
      season: { select: { year: true } },
    },
  })) as MatchRow[];

  // Regroupe par opponent teamId.
  const byOpponent = new Map<string, MatchBrief[]>();
  for (const m of matchesRaw) {
    if (m.outcome === null) continue;
    const opponentId =
      m.homeTeamId === team.id ? m.awayTeamId : m.homeTeamId;
    if (!byOpponent.has(opponentId)) byOpponent.set(opponentId, []);
    byOpponent.get(opponentId)!.push(toMatchBrief(m));
  }

  if (byOpponent.size === 0) return [];

  // Charge les briefs des opponents.
  const opponentIds = Array.from(byOpponent.keys());
  const opponentTeams = (await prisma.proTeam.findMany({
    where: { id: { in: opponentIds } },
    select: {
      id: true,
      slug: true,
      city: true,
      name: true,
      race: true,
      primaryColor: true,
      secondaryColor: true,
    },
  })) as TeamBrief[];
  const opponentBriefById = new Map<string, TeamBrief>();
  for (const o of opponentTeams) {
    opponentBriefById.set(o.id, o);
  }

  const entries: TopRivalEntry[] = [];
  for (const [opponentId, matches] of byOpponent) {
    const opp = opponentBriefById.get(opponentId);
    if (!opp) continue; // safety, deleted team
    const record = computeRecord(team.id, matches);
    entries.push({
      team: opp,
      totalMatches: record.totalMatches,
      winsFor: record.winsA,
      winsAgainst: record.winsB,
      draws: record.draws,
      lastMatch: matches[0] ?? null,
    });
  }

  entries.sort((a, b) => {
    if (b.totalMatches !== a.totalMatches) {
      return b.totalMatches - a.totalMatches;
    }
    return a.team.slug.localeCompare(b.team.slug);
  });

  return entries.slice(0, limit);
}

// Marqueur exporte pour les tests / consumers qui veulent expliciter
// le cap d'expose recentMatches.
export const HEAD_TO_HEAD_RECENT_CAP = HEAD_TO_HEAD_LIMIT;
