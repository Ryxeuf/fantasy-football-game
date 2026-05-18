/**
 * Pro League standings — sprint Pro League lot 1.C.5.
 *
 * Service dédié au classement détaillé d'une saison : 16 entrées
 * complètes (V/N/D, points, TD diff, casualties, forme 5 derniers,
 * place actuelle).
 *
 * Distinct du `pro-league-hub.ts` (qui ne renvoie que le top 8 +
 * d'autres données agrégées).
 */

import { prisma } from "../prisma";

import { OLD_WORLD_LEAGUE_SLUG } from "./pro-league-hub";

export interface ProLeagueStandingsTeam {
  readonly slug: string;
  readonly name: string;
  readonly city: string;
  readonly race: string;
  readonly primaryColor: string | null;
  readonly secondaryColor: string | null;
}

export interface ProLeagueStandingsRow {
  /** Place dans le classement (1-based). */
  readonly rank: number;
  readonly team: ProLeagueStandingsTeam;
  readonly played: number;
  readonly wins: number;
  readonly draws: number;
  readonly losses: number;
  readonly points: number;
  readonly tdFor: number;
  readonly tdAgainst: number;
  readonly tdDiff: number;
  readonly casualtiesFor: number;
  readonly casualtiesAgainst: number;
  readonly casualtiesDiff: number;
  /**
   * Lot I — Team Value courante en gold pieces. Somme des `tvCached`
   * des joueurs actifs (status='active') du roster. Permet aux coachs
   * de comparer la richesse roster au classement points.
   */
  readonly teamValue: number;
  /** Tableau des 5 derniers résultats (W/D/L), ordre du plus ancien
   *  au plus récent. Vide si aucun match joué. */
  readonly form: readonly ("W" | "D" | "L")[];
}

export interface ProLeagueStandingsSnapshot {
  readonly leagueSlug: string;
  readonly seasonId: string;
  readonly seasonYear: number;
  readonly seasonStatus: string;
  readonly rows: readonly ProLeagueStandingsRow[];
}

export class ProLeagueStandingsNotFoundError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "ProLeagueStandingsNotFoundError";
  }
}

function parseForm(raw: unknown): ("W" | "D" | "L")[] {
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (v): v is "W" | "D" | "L" =>
            v === "W" || v === "D" || v === "L",
        );
      }
    } catch {
      return [];
    }
  }
  if (Array.isArray(raw)) {
    return raw.filter(
      (v): v is "W" | "D" | "L" => v === "W" || v === "D" || v === "L",
    );
  }
  return [];
}

/**
 * Renvoie le classement complet de la saison courante. Le rang est
 * calculé depuis l'ordre Prisma (points desc, tdFor desc) — fiable
 * car la table `ProLeagueStandings` contient une seule entrée par
 * (seasonId, teamId).
 */
export async function getProLeagueCurrentStandings(
  leagueSlug: string = OLD_WORLD_LEAGUE_SLUG,
): Promise<ProLeagueStandingsSnapshot> {
  const league = await prisma.proLeague.findUnique({
    where: { slug: leagueSlug },
    select: { slug: true },
  });
  if (!league) {
    throw new ProLeagueStandingsNotFoundError(
      `ProLeague slug='${leagueSlug}' introuvable`,
    );
  }

  // Saison courante : in_progress > completed (la plus récente).
  // `isTest: false` exclut les test seasons admin.
  const inProgress = await prisma.proLeagueSeason.findFirst({
    where: {
      league: { slug: leagueSlug },
      status: "in_progress",
      isTest: false,
    },
    orderBy: { year: "asc" },
    select: { id: true, year: true, status: true },
  });
  const season =
    inProgress ??
    (await prisma.proLeagueSeason.findFirst({
      where: { league: { slug: leagueSlug }, isTest: false },
      orderBy: { year: "desc" },
      select: { id: true, year: true, status: true },
    }));

  if (!season) {
    throw new ProLeagueStandingsNotFoundError(
      "Aucune saison disponible pour cette ligue",
    );
  }

  // BUG fix audit round 5 (HIGH) : avant, l'orderBy etait
  // `[points desc, tdFor desc]` — utilise tdFor brut comme tiebreaker
  // au lieu de la difference de TD. Une equipe avec 30 TD pour / 50
  // contre se classait devant une equipe avec 25 pour / 5 contre,
  // malgre une difference de TD largement meilleure pour la seconde.
  // Standard BB / football : points → diff TD → TD pour.
  // Prisma ne supporte pas l'orderBy sur une colonne computee ; on
  // recupere tous les rows et on trie cote JS (les ligues sont
  // bornees a 16 equipes par saison, sort trivial).
  const rowsRaw = await prisma.proLeagueStandings.findMany({
    where: { seasonId: season.id as string },
    select: {
      played: true,
      wins: true,
      draws: true,
      losses: true,
      points: true,
      tdFor: true,
      tdAgainst: true,
      casualtiesFor: true,
      casualtiesAgainst: true,
      form: true,
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

  // Audit round 5 : sort cote JS car Prisma ne supporte pas
  // l'orderBy sur une expression. Ordre : points desc → diff TD desc
  // → TD pour desc.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rowsRaw.sort((a: any, b: any) => {
    const pA = (a.points as number) ?? 0;
    const pB = (b.points as number) ?? 0;
    if (pB !== pA) return pB - pA;
    const diffA = ((a.tdFor as number) ?? 0) - ((a.tdAgainst as number) ?? 0);
    const diffB = ((b.tdFor as number) ?? 0) - ((b.tdAgainst as number) ?? 0);
    if (diffB !== diffA) return diffB - diffA;
    return ((b.tdFor as number) ?? 0) - ((a.tdFor as number) ?? 0);
  });

  // Lot I — TV par équipe : somme(tvCached) des joueurs status='active'.
  // groupBy sert à éviter N+1 requêtes (1 par équipe). Bornée à 16
  // équipes par ligue donc le tableau reste petit.
  const teamIds = rowsRaw
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((s: any) => s.team.id as string)
    .filter((id: string): id is string => typeof id === "string");
  const tvAggregates = await prisma.proTeamRoster.groupBy({
    by: ["teamId"],
    where: {
      teamId: { in: teamIds },
      status: "active",
    },
    _sum: { tvCached: true },
  });
  const tvByTeamId = new Map<string, number>();
  for (const a of tvAggregates as Array<{
    teamId: string;
    _sum: { tvCached: number | null };
  }>) {
    tvByTeamId.set(a.teamId, a._sum.tvCached ?? 0);
  }

  return {
    leagueSlug: league.slug as string,
    seasonId: season.id as string,
    seasonYear: season.year as number,
    seasonStatus: season.status as string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rows: rowsRaw.map((s: any, index: number) => {
      const tdFor = (s.tdFor as number) ?? 0;
      const tdAgainst = (s.tdAgainst as number) ?? 0;
      const casFor = (s.casualtiesFor as number) ?? 0;
      const casAgainst = (s.casualtiesAgainst as number) ?? 0;
      return {
        rank: index + 1,
        team: {
          slug: s.team.slug as string,
          name: s.team.name as string,
          city: s.team.city as string,
          race: s.team.race as string,
          primaryColor: (s.team.primaryColor as string | null) ?? null,
          secondaryColor: (s.team.secondaryColor as string | null) ?? null,
        },
        played: (s.played as number) ?? 0,
        wins: (s.wins as number) ?? 0,
        draws: (s.draws as number) ?? 0,
        losses: (s.losses as number) ?? 0,
        points: (s.points as number) ?? 0,
        tdFor,
        tdAgainst,
        tdDiff: tdFor - tdAgainst,
        casualtiesFor: casFor,
        casualtiesAgainst: casAgainst,
        casualtiesDiff: casFor - casAgainst,
        teamValue: tvByTeamId.get(s.team.id as string) ?? 0,
        form: parseForm(s.form),
      };
    }),
  };
}
