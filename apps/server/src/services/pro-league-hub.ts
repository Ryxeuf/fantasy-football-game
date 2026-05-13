/**
 * Pro League hub service — sprint Pro League lot 1.C.1.
 *
 * Agrège les données nécessaires à la page d'accueil
 * `/pro-league` : league + saison courante + round courant + prochains
 * matchs + classement top 8.
 *
 * "Saison courante" = première saison `in_progress` (ordre d'année
 * croissant), ou à défaut la dernière saison `completed`. Si aucune
 * saison n'existe pour la ligue, renvoie `season: null`.
 *
 * "Round courant" = premier round `in_progress` ou `pending` (ordre
 * `roundNumber` croissant). À défaut, le dernier round `completed`.
 *
 * "Prochains matchs" = 8 prochains matchs `scheduled` ou `ready`
 * triés par `scheduledAt` croissant. Inclut les infos minimales
 * d'équipe (slug, name, city, primaryColor) pour l'affichage du card.
 *
 * "Classement" = top 8 par points (desc), tdFor (desc).
 *
 * Pas d'auth — la Pro League est publique au MVP.
 */

import { prisma } from "../prisma";

export const OLD_WORLD_LEAGUE_SLUG = "old-world-league";
const STANDINGS_LIMIT = 8;
const NEXT_MATCHES_LIMIT = 8;

export interface ProLeagueHubLeague {
  readonly slug: string;
  readonly name: string;
  readonly description: string | null;
  readonly branding: unknown;
}

export interface ProLeagueHubSeason {
  readonly id: string;
  readonly year: number;
  readonly status: string;
  readonly engineVer: string;
  readonly startsAt: string | null;
  readonly endsAt: string | null;
}

export interface ProLeagueHubRound {
  readonly id: string;
  readonly roundNumber: number;
  readonly status: string;
  readonly scheduledAt: string | null;
}

export interface ProLeagueHubTeam {
  readonly slug: string;
  readonly name: string;
  readonly city: string;
  readonly primaryColor: string | null;
  readonly secondaryColor: string | null;
}

export interface ProLeagueHubMatch {
  readonly id: string;
  readonly roundNumber: number;
  readonly status: string;
  readonly scheduledAt: string;
  readonly homeTeam: ProLeagueHubTeam;
  readonly awayTeam: ProLeagueHubTeam;
  readonly scoreHome: number | null;
  readonly scoreAway: number | null;
  readonly outcome: string | null;
}

export interface ProLeagueHubStandingsEntry {
  readonly teamSlug: string;
  readonly teamName: string;
  readonly teamCity: string;
  readonly played: number;
  readonly wins: number;
  readonly draws: number;
  readonly losses: number;
  readonly points: number;
  readonly tdFor: number;
  readonly tdAgainst: number;
}

export interface ProLeagueHubData {
  readonly league: ProLeagueHubLeague;
  readonly season: ProLeagueHubSeason | null;
  readonly currentRound: ProLeagueHubRound | null;
  readonly nextMatches: readonly ProLeagueHubMatch[];
  readonly standings: readonly ProLeagueHubStandingsEntry[];
}

export class ProLeagueNotFoundError extends Error {
  constructor(slug: string) {
    super(`ProLeague slug='${slug}' introuvable`);
    this.name = "ProLeagueNotFoundError";
  }
}

/**
 * Retourne le snapshot agrégé pour le hub.
 *
 * @param leagueSlug défaut: `old-world-league` (singleton MVP).
 */
export async function getProLeagueHubSnapshot(
  leagueSlug: string = OLD_WORLD_LEAGUE_SLUG,
): Promise<ProLeagueHubData> {
  const league = await prisma.proLeague.findUnique({
    where: { slug: leagueSlug },
    select: {
      slug: true,
      name: true,
      description: true,
      branding: true,
    },
  });
  if (!league) {
    throw new ProLeagueNotFoundError(leagueSlug);
  }

  // Saison courante : in_progress > completed (la plus récente).
  // `isTest: false` exclut les test seasons (Sprint test-leagues) —
  // visibles uniquement cote admin.
  const inProgress = await prisma.proLeagueSeason.findFirst({
    where: {
      league: { slug: leagueSlug },
      status: "in_progress",
      isTest: false,
    },
    orderBy: { year: "asc" },
    select: {
      id: true,
      year: true,
      status: true,
      engineVer: true,
      startsAt: true,
      endsAt: true,
    },
  });
  const season =
    inProgress ??
    (await prisma.proLeagueSeason.findFirst({
      where: { league: { slug: leagueSlug }, isTest: false },
      orderBy: [{ year: "desc" }],
      select: {
        id: true,
        year: true,
        status: true,
        engineVer: true,
        startsAt: true,
        endsAt: true,
      },
    }));

  if (!season) {
    return {
      league: {
        slug: league.slug as string,
        name: league.name as string,
        description: (league.description as string | null) ?? null,
        branding: league.branding,
      },
      season: null,
      currentRound: null,
      nextMatches: [],
      standings: [],
    };
  }

  const seasonId = season.id as string;

  // Round courant : pending/in_progress avec le plus petit roundNumber ;
  // sinon, le dernier completed.
  const currentRound =
    (await prisma.proLeagueRound.findFirst({
      where: { seasonId, status: { in: ["pending", "in_progress"] } },
      orderBy: { roundNumber: "asc" },
      select: {
        id: true,
        roundNumber: true,
        status: true,
        scheduledAt: true,
      },
    })) ??
    (await prisma.proLeagueRound.findFirst({
      where: { seasonId, status: "completed" },
      orderBy: { roundNumber: "desc" },
      select: {
        id: true,
        roundNumber: true,
        status: true,
        scheduledAt: true,
      },
    })) ??
    null;

  // Prochains matchs (scheduled / ready), 8 max.
  const nextMatchesRaw = await prisma.proLeagueMatch.findMany({
    where: {
      seasonId,
      status: { in: ["scheduled", "ready"] },
      // Lot 2.C.3 — exclure les sandbox matchs du hub public.
      isTest: false,
    },
    orderBy: [{ scheduledAt: "asc" }],
    take: NEXT_MATCHES_LIMIT,
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      scoreHome: true,
      scoreAway: true,
      outcome: true,
      round: { select: { roundNumber: true } },
      homeTeam: {
        select: {
          slug: true,
          name: true,
          city: true,
          primaryColor: true,
          secondaryColor: true,
        },
      },
      awayTeam: {
        select: {
          slug: true,
          name: true,
          city: true,
          primaryColor: true,
          secondaryColor: true,
        },
      },
    },
  });

  // Standings top N.
  const standingsRaw = await prisma.proLeagueStandings.findMany({
    where: { seasonId },
    orderBy: [
      { points: "desc" },
      { tdFor: "desc" },
    ],
    take: STANDINGS_LIMIT,
    select: {
      played: true,
      wins: true,
      draws: true,
      losses: true,
      points: true,
      tdFor: true,
      tdAgainst: true,
      team: {
        select: {
          slug: true,
          name: true,
          city: true,
        },
      },
    },
  });

  return {
    league: {
      slug: league.slug as string,
      name: league.name as string,
      description: (league.description as string | null) ?? null,
      branding: league.branding,
    },
    season: {
      id: season.id as string,
      year: season.year as number,
      status: season.status as string,
      engineVer: season.engineVer as string,
      startsAt:
        (season.startsAt as Date | null)?.toISOString() ?? null,
      endsAt: (season.endsAt as Date | null)?.toISOString() ?? null,
    },
    currentRound: currentRound
      ? {
          id: currentRound.id as string,
          roundNumber: currentRound.roundNumber as number,
          status: currentRound.status as string,
          scheduledAt:
            (currentRound.scheduledAt as Date | null)?.toISOString() ?? null,
        }
      : null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    nextMatches: nextMatchesRaw.map((m: any) => ({
      id: m.id as string,
      roundNumber: m.round.roundNumber as number,
      status: m.status as string,
      scheduledAt: (m.scheduledAt as Date).toISOString(),
      scoreHome: (m.scoreHome as number | null) ?? null,
      scoreAway: (m.scoreAway as number | null) ?? null,
      outcome: (m.outcome as string | null) ?? null,
      homeTeam: {
        slug: m.homeTeam.slug as string,
        name: m.homeTeam.name as string,
        city: m.homeTeam.city as string,
        primaryColor: (m.homeTeam.primaryColor as string | null) ?? null,
        secondaryColor: (m.homeTeam.secondaryColor as string | null) ?? null,
      },
      awayTeam: {
        slug: m.awayTeam.slug as string,
        name: m.awayTeam.name as string,
        city: m.awayTeam.city as string,
        primaryColor: (m.awayTeam.primaryColor as string | null) ?? null,
        secondaryColor: (m.awayTeam.secondaryColor as string | null) ?? null,
      },
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    standings: standingsRaw.map((s: any) => ({
      teamSlug: s.team.slug as string,
      teamName: s.team.name as string,
      teamCity: s.team.city as string,
      played: s.played as number,
      wins: s.wins as number,
      draws: s.draws as number,
      losses: s.losses as number,
      points: s.points as number,
      tdFor: s.tdFor as number,
      tdAgainst: s.tdAgainst as number,
    })),
  };
}
