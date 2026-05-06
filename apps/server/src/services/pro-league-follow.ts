/**
 * Pro League fan follow — sprint Pro League lot 1.C.4.
 *
 * Service qui gère :
 *  - `followProTeam(userId, slug)` : crée un follow idempotent.
 *  - `unfollowProTeam(userId, slug)` : supprime le follow si présent.
 *  - `listMyFollows(userId)` : liste des équipes suivies par l'user.
 *  - `getMyFeed(userId)` : newsfeed (matchs récents + à venir des
 *    équipes suivies, avec un ordre cohérent).
 *
 * Toutes les opérations sont auth-required côté route — ce service ne
 * fait pas de check d'auth, c'est le caller qui doit fournir un userId
 * validé.
 */

import { prisma } from "../prisma";

const FEED_UPCOMING_PER_TEAM = 1;
const FEED_RECENT_PER_TEAM = 1;
const FEED_MAX_TOTAL = 30;

export interface ProTeamFollowSummary {
  readonly proTeamId: string;
  readonly slug: string;
  readonly name: string;
  readonly city: string;
  readonly race: string;
  readonly primaryColor: string | null;
  readonly secondaryColor: string | null;
  readonly since: string;
}

export interface FeedTeam {
  readonly slug: string;
  readonly name: string;
  readonly city: string;
  readonly primaryColor: string | null;
}

export interface FeedEntry {
  readonly matchId: string;
  readonly status: string;
  readonly scheduledAt: string;
  readonly roundNumber: number;
  readonly seasonYear: number;
  /** Équipe suivie qui motive cette entrée (= follow). */
  readonly followedTeam: FeedTeam;
  /** Adversaire dans le match. */
  readonly opponent: FeedTeam;
  /** True si la team suivie joue à domicile dans ce match. */
  readonly isHome: boolean;
  readonly scoreHome: number | null;
  readonly scoreAway: number | null;
  /** "home" | "away" | "draw" | null */
  readonly outcome: string | null;
  /** Catégorie pour l'UI : "upcoming" (à venir) ou "recent" (joué). */
  readonly category: "upcoming" | "recent";
}

export class ProTeamFollowError extends Error {
  constructor(
    readonly code: "team_not_found" | "user_not_found",
    message: string,
  ) {
    super(message);
    this.name = "ProTeamFollowError";
  }
}

export async function followProTeam(
  userId: string,
  slug: string,
): Promise<ProTeamFollowSummary> {
  const team = await prisma.proTeam.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      city: true,
      race: true,
      primaryColor: true,
      secondaryColor: true,
    },
  });
  if (!team) {
    throw new ProTeamFollowError(
      "team_not_found",
      `ProTeam slug='${slug}' introuvable`,
    );
  }

  const created = await prisma.proSpectatorFollow.upsert({
    where: {
      userId_proTeamId: {
        userId,
        proTeamId: team.id as string,
      },
    },
    create: {
      userId,
      proTeamId: team.id as string,
    },
    update: {},
    select: { since: true },
  });

  return {
    proTeamId: team.id as string,
    slug: team.slug as string,
    name: team.name as string,
    city: team.city as string,
    race: team.race as string,
    primaryColor: (team.primaryColor as string | null) ?? null,
    secondaryColor: (team.secondaryColor as string | null) ?? null,
    since: (created.since as Date).toISOString(),
  };
}

/** Renvoie true si un follow a été supprimé, false si rien à supprimer. */
export async function unfollowProTeam(
  userId: string,
  slug: string,
): Promise<boolean> {
  const team = await prisma.proTeam.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!team) {
    throw new ProTeamFollowError(
      "team_not_found",
      `ProTeam slug='${slug}' introuvable`,
    );
  }
  const result = await prisma.proSpectatorFollow.deleteMany({
    where: { userId, proTeamId: team.id as string },
  });
  return ((result.count as number) ?? 0) > 0;
}

export async function listMyFollows(
  userId: string,
): Promise<ProTeamFollowSummary[]> {
  const rows = await prisma.proSpectatorFollow.findMany({
    where: { userId },
    orderBy: { since: "desc" },
    select: {
      since: true,
      team: {
        select: {
          id: true,
          slug: true,
          name: true,
          city: true,
          race: true,
          primaryColor: true,
          secondaryColor: true,
        },
      },
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return rows.map((r: any) => ({
    proTeamId: r.team.id as string,
    slug: r.team.slug as string,
    name: r.team.name as string,
    city: r.team.city as string,
    race: r.team.race as string,
    primaryColor: (r.team.primaryColor as string | null) ?? null,
    secondaryColor: (r.team.secondaryColor as string | null) ?? null,
    since: (r.since as Date).toISOString(),
  }));
}

export async function isFollowing(
  userId: string,
  slug: string,
): Promise<boolean> {
  const team = await prisma.proTeam.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!team) return false;
  const row = await prisma.proSpectatorFollow.findUnique({
    where: {
      userId_proTeamId: {
        userId,
        proTeamId: team.id as string,
      },
    },
    select: { id: true },
  });
  return row !== null;
}

interface FeedRawMatch {
  id: string;
  status: string;
  scheduledAt: Date;
  scoreHome: number | null;
  scoreAway: number | null;
  outcome: string | null;
  homeTeamId: string;
  awayTeamId: string;
  round: { roundNumber: number };
  season: { year: number };
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

function toFeedEntry(
  m: FeedRawMatch,
  followedTeamId: string,
  category: "upcoming" | "recent",
): FeedEntry {
  const isHome = m.homeTeamId === followedTeamId;
  const followed = isHome ? m.homeTeam : m.awayTeam;
  const opp = isHome ? m.awayTeam : m.homeTeam;
  return {
    matchId: m.id,
    status: m.status,
    scheduledAt: m.scheduledAt.toISOString(),
    roundNumber: m.round.roundNumber,
    seasonYear: m.season.year,
    followedTeam: {
      slug: followed.slug,
      name: followed.name,
      city: followed.city,
      primaryColor: followed.primaryColor ?? null,
    },
    opponent: {
      slug: opp.slug,
      name: opp.name,
      city: opp.city,
      primaryColor: opp.primaryColor ?? null,
    },
    isHome,
    scoreHome: m.scoreHome ?? null,
    scoreAway: m.scoreAway ?? null,
    outcome: m.outcome ?? null,
    category,
  };
}

const matchSelectForFeed = {
  id: true,
  status: true,
  scheduledAt: true,
  scoreHome: true,
  scoreAway: true,
  outcome: true,
  homeTeamId: true,
  awayTeamId: true,
  round: { select: { roundNumber: true } },
  season: { select: { year: true } },
  homeTeam: {
    select: { slug: true, name: true, city: true, primaryColor: true },
  },
  awayTeam: {
    select: { slug: true, name: true, city: true, primaryColor: true },
  },
} as const;

/**
 * Newsfeed perso de l'user. Pour chaque équipe suivie :
 *  - 1 match à venir (le plus proche)
 *  - 1 match récent (le plus récent joué)
 *
 * Toutes les entrées sont fusionnées + triées par `scheduledAt asc` pour
 * les upcoming et `scheduledAt desc` pour les recent ; le résultat
 * final est : recent (récents en haut) + upcoming (les plus proches
 * ensuite). Limité à 30 entrées max au total.
 */
export async function getMyFeed(userId: string): Promise<FeedEntry[]> {
  const follows = await prisma.proSpectatorFollow.findMany({
    where: { userId },
    select: { proTeamId: true },
  });
  if (follows.length === 0) return [];

  const teamIds = follows.map((f: { proTeamId: unknown }) => f.proTeamId as string);
  const upcoming: FeedEntry[] = [];
  const recent: FeedEntry[] = [];

  for (const teamId of teamIds) {
    const upcomingRows = (await prisma.proLeagueMatch.findMany({
      where: {
        OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
        status: { in: ["scheduled", "ready"] },
      },
      orderBy: { scheduledAt: "asc" },
      take: FEED_UPCOMING_PER_TEAM,
      select: matchSelectForFeed,
    })) as FeedRawMatch[];
    for (const m of upcomingRows) {
      upcoming.push(toFeedEntry(m, teamId, "upcoming"));
    }

    const recentRows = (await prisma.proLeagueMatch.findMany({
      where: {
        OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
        status: "completed",
      },
      orderBy: { scheduledAt: "desc" },
      take: FEED_RECENT_PER_TEAM,
      select: matchSelectForFeed,
    })) as FeedRawMatch[];
    for (const m of recentRows) {
      recent.push(toFeedEntry(m, teamId, "recent"));
    }
  }

  recent.sort(
    (a, b) =>
      new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime(),
  );
  upcoming.sort(
    (a, b) =>
      new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
  );

  return [...recent, ...upcoming].slice(0, FEED_MAX_TOTAL);
}
