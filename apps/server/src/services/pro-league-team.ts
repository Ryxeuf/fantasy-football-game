/**
 * Pro League team detail — sprint Pro League lot 1.C.2.
 *
 * Service qui agrège les données nécessaires à la page
 * `/pro-league/teams/:slug` :
 *  - team meta (city, name, race, NFL flavor, palette, baseTv)
 *  - standings entry pour la saison courante (V/N/D/points + form)
 *  - roster (joueurs actifs avec stats + status + form)
 *  - calendar : 5 prochains matchs + 5 derniers matchs joués
 *
 * Note : Hall of Fame et fan count seront branchés en 1.E.5 / 1.C.4.
 */

import { prisma } from "../prisma";

import { OLD_WORLD_LEAGUE_SLUG } from "./pro-league-hub";
import {
  SPP_LEVEL_THRESHOLDS,
  levelForSpp,
} from "./pro-roster-level-up";

const UPCOMING_LIMIT = 5;
const RECENT_LIMIT = 5;

export interface ProTeamDetailOpponent {
  readonly slug: string;
  readonly name: string;
  readonly city: string;
  readonly primaryColor: string | null;
}

export interface ProTeamDetailMatch {
  readonly id: string;
  readonly roundNumber: number;
  readonly status: string;
  readonly scheduledAt: string;
  readonly homeTeamSlug: string;
  readonly awayTeamSlug: string;
  readonly opponent: ProTeamDetailOpponent;
  readonly isHome: boolean;
  readonly scoreHome: number | null;
  readonly scoreAway: number | null;
  readonly outcome: string | null;
}

export interface ProTeamRosterStatBonuses {
  readonly ma: number;
  readonly st: number;
  readonly ag: number;
  readonly pa: number;
  readonly av: number;
}

export interface ProTeamRosterCareer {
  readonly tdCount: number;
  readonly casCount: number;
  readonly compCount: number;
  readonly mvpCount: number;
}

export interface ProTeamRosterProgression {
  /** Niveau (1..7) calculé à partir du SPP via la table BB. */
  readonly level: number;
  /** SPP cumulés. */
  readonly spp: number;
  /** Prochain seuil SPP (null si déjà legend, level 7). */
  readonly nextLevelSpp: number | null;
  /**
   * Lot K — true si le joueur a accumulé assez de SPP pour franchir le
   * prochain palier mais que l'applier (`sweepLevelUps`, tick 30 min)
   * n'a pas encore tourné. Calculé via `levelForSpp(spp) > rawDbLevel`.
   *
   * NB: l'API expose `level = max(rawDbLevel, levelForSpp(spp))` pour
   * cacher le lag de l'applier dans l'affichage du level. Mais on a
   * besoin du flag brut côté UI pour signaler "advancement en attente".
   */
  readonly readyToLevelUp: boolean;
  /** TV individuelle (gp), recomputée par le level-up applier (Lot 3.C.5+). */
  readonly tv: number;
}

export interface ProTeamRosterEntry {
  readonly id: string;
  readonly name: string;
  readonly position: string;
  readonly ma: number;
  readonly st: number;
  readonly ag: number;
  readonly pa: number | null;
  readonly av: number;
  readonly skills: readonly string[];
  readonly status: string;
  readonly form: number;
  readonly niggling: number;
  /** Lot E — affichage fiche coach. */
  readonly progression: ProTeamRosterProgression;
  readonly statBonuses: ProTeamRosterStatBonuses;
  readonly career: ProTeamRosterCareer;
}

export interface ProTeamDetailRecord {
  readonly played: number;
  readonly wins: number;
  readonly draws: number;
  readonly losses: number;
  readonly points: number;
  readonly tdFor: number;
  readonly tdAgainst: number;
  readonly form: readonly ("W" | "D" | "L")[];
}

/**
 * Lot M — entrée résumée pour le widget "Top earners" sur la page
 * équipe. Sous-set de `ProTeamRosterEntry` cible le rendu compact
 * (image carte + chiffre TV + level).
 */
export interface ProTeamTopEarner {
  readonly id: string;
  readonly name: string;
  readonly position: string;
  readonly level: number;
  readonly tv: number;
  readonly status: string;
}

export interface ProTeamDetail {
  readonly slug: string;
  readonly city: string;
  readonly name: string;
  readonly race: string;
  readonly nflFlavor: string | null;
  readonly primaryColor: string | null;
  readonly secondaryColor: string | null;
  readonly baseTv: number;
  readonly motto: string | null;
  readonly seasonId: string | null;
  readonly seasonYear: number | null;
  readonly record: ProTeamDetailRecord | null;
  readonly roster: readonly ProTeamRosterEntry[];
  /**
   * Lot M — Top 5 joueurs actifs par TV (desc), pour mettre en avant
   * les "stars" du roster sur la page équipe sans scroller la table
   * complète.
   */
  readonly topEarners: readonly ProTeamTopEarner[];
  readonly totalRosterTv: number;
  readonly upcomingMatches: readonly ProTeamDetailMatch[];
  readonly recentMatches: readonly ProTeamDetailMatch[];
}

export class ProTeamNotFoundError extends Error {
  constructor(slug: string) {
    super(`ProTeam slug='${slug}' introuvable`);
    this.name = "ProTeamNotFoundError";
  }
}

/**
 * Lot E — prochain seuil SPP pour passer au level suivant. `null` si
 * le joueur est déjà legend (level 7 = au-dessus de 176 SPP).
 */
export function nextLevelSpp(spp: number): number | null {
  for (const threshold of SPP_LEVEL_THRESHOLDS) {
    if (spp < threshold) return threshold;
  }
  return null;
}

function parseSkills(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((s): s is string => typeof s === "string");
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((s): s is string => typeof s === "string");
      }
    } catch {
      return [];
    }
  }
  return [];
}

function parseForm(raw: unknown): ("W" | "D" | "L")[] {
  if (Array.isArray(raw)) {
    return raw.filter(
      (v): v is "W" | "D" | "L" => v === "W" || v === "D" || v === "L",
    );
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (v): v is "W" | "D" | "L" => v === "W" || v === "D" || v === "L",
        );
      }
    } catch {
      return [];
    }
  }
  return [];
}

export async function getProTeamDetail(
  slug: string,
  leagueSlug: string = OLD_WORLD_LEAGUE_SLUG,
): Promise<ProTeamDetail> {
  const team = await prisma.proTeam.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      city: true,
      name: true,
      race: true,
      nflFlavor: true,
      primaryColor: true,
      secondaryColor: true,
      baseTv: true,
      meta: true,
      leagueId: true,
      league: { select: { slug: true, branding: true } },
    },
  });
  if (!team || (team.league?.slug as string) !== leagueSlug) {
    throw new ProTeamNotFoundError(slug);
  }

  // Saison courante (in_progress > completed la plus récente).
  const inProgress = await prisma.proLeagueSeason.findFirst({
    where: { leagueId: team.leagueId as string, status: "in_progress" },
    orderBy: { year: "asc" },
    select: { id: true, year: true },
  });
  const season =
    inProgress ??
    (await prisma.proLeagueSeason.findFirst({
      where: { leagueId: team.leagueId as string },
      orderBy: { year: "desc" },
      select: { id: true, year: true },
    }));

  let record: ProTeamDetailRecord | null = null;
  let upcomingMatches: ProTeamDetailMatch[] = [];
  let recentMatches: ProTeamDetailMatch[] = [];

  if (season) {
    const seasonId = season.id as string;
    const standings = await prisma.proLeagueStandings.findUnique({
      where: { seasonId_teamId: { seasonId, teamId: team.id as string } },
      select: {
        played: true,
        wins: true,
        draws: true,
        losses: true,
        points: true,
        tdFor: true,
        tdAgainst: true,
        form: true,
      },
    });
    if (standings) {
      record = {
        played: (standings.played as number) ?? 0,
        wins: (standings.wins as number) ?? 0,
        draws: (standings.draws as number) ?? 0,
        losses: (standings.losses as number) ?? 0,
        points: (standings.points as number) ?? 0,
        tdFor: (standings.tdFor as number) ?? 0,
        tdAgainst: (standings.tdAgainst as number) ?? 0,
        form: parseForm(standings.form),
      };
    }

    // Calendrier : matchs de la saison où l'équipe est home OU away.
    const teamId = team.id as string;
    const upcoming = await prisma.proLeagueMatch.findMany({
      where: {
        seasonId,
        OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
        status: { in: ["scheduled", "ready"] },
        // Lot 2.C.3 — sandbox matchs ne doivent pas apparaître dans
        // le calendrier public d'une équipe.
        isTest: false,
      },
      orderBy: { scheduledAt: "asc" },
      take: UPCOMING_LIMIT,
      select: matchSelect(),
    });
    const recent = await prisma.proLeagueMatch.findMany({
      where: {
        seasonId,
        OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
        status: "completed",
        isTest: false,
      },
      orderBy: { scheduledAt: "desc" },
      take: RECENT_LIMIT,
      select: matchSelect(),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    upcomingMatches = upcoming.map((m: any) => toDetailMatch(m, teamId));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recentMatches = recent.map((m: any) => toDetailMatch(m, teamId));
  }

  // Roster (filter status='active' par défaut, on garde tous les statuts
  // pour permettre à l'UI de filtrer côté client).
  const rosterRaw = await prisma.proTeamRoster.findMany({
    where: { teamId: team.id as string },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      position: true,
      ma: true,
      st: true,
      ag: true,
      pa: true,
      av: true,
      skills: true,
      status: true,
      form: true,
      niggling: true,
      spp: true,
      level: true,
      tvCached: true,
      tdCount: true,
      casCount: true,
      compCount: true,
      mvpCount: true,
      maBonus: true,
      stBonus: true,
      agBonus: true,
      paBonus: true,
      avBonus: true,
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roster: ProTeamRosterEntry[] = rosterRaw.map((r: any) => {
    const spp = (r.spp as number | null) ?? 0;
    const rawDbLevel = (r.level as number | null) ?? 1;
    // Toujours prendre le level recompute pour rester cohérent même si
    // la colonne `level` n'a pas été migrée (rosters legacy avant 3.C.4).
    const computedLevel = levelForSpp(spp);
    const level = Math.max(rawDbLevel, computedLevel);
    // Lot K — readyToLevelUp = applier en retard (advancement en attente).
    // Comparaison sur rawDbLevel pour ignorer le recompute UI.
    const readyToLevelUp = computedLevel > rawDbLevel;
    return {
      id: r.id as string,
      name: r.name as string,
      position: r.position as string,
      ma: r.ma as number,
      st: r.st as number,
      ag: r.ag as number,
      pa: (r.pa as number | null) ?? null,
      av: r.av as number,
      skills: parseSkills(r.skills),
      status: (r.status as string) ?? "active",
      form: (r.form as number) ?? 50,
      niggling: (r.niggling as number) ?? 0,
      progression: {
        level,
        spp,
        nextLevelSpp: nextLevelSpp(spp),
        readyToLevelUp,
        tv: (r.tvCached as number | null) ?? 50000,
      },
      statBonuses: {
        ma: (r.maBonus as number | null) ?? 0,
        st: (r.stBonus as number | null) ?? 0,
        ag: (r.agBonus as number | null) ?? 0,
        pa: (r.paBonus as number | null) ?? 0,
        av: (r.avBonus as number | null) ?? 0,
      },
      career: {
        tdCount: (r.tdCount as number | null) ?? 0,
        casCount: (r.casCount as number | null) ?? 0,
        compCount: (r.compCount as number | null) ?? 0,
        mvpCount: (r.mvpCount as number | null) ?? 0,
      },
    };
  });

  const meta = (team.meta as { motto?: string } | null | undefined) ?? null;

  // Lot M — top 5 joueurs actifs par TV desc, sans appel DB additionnel.
  const activeRoster = roster.filter((p) => p.status === "active");
  const topEarners: ProTeamTopEarner[] = [...activeRoster]
    .sort((a, b) => b.progression.tv - a.progression.tv)
    .slice(0, 5)
    .map((p) => ({
      id: p.id,
      name: p.name,
      position: p.position,
      level: p.progression.level,
      tv: p.progression.tv,
      status: p.status,
    }));
  const totalRosterTv = activeRoster.reduce(
    (acc, p) => acc + p.progression.tv,
    0,
  );

  return {
    slug: team.slug as string,
    city: team.city as string,
    name: team.name as string,
    race: team.race as string,
    nflFlavor: (team.nflFlavor as string | null) ?? null,
    primaryColor: (team.primaryColor as string | null) ?? null,
    secondaryColor: (team.secondaryColor as string | null) ?? null,
    baseTv: (team.baseTv as number) ?? 1000,
    motto: meta?.motto ?? null,
    seasonId: season ? (season.id as string) : null,
    seasonYear: season ? (season.year as number) : null,
    record,
    roster,
    topEarners,
    totalRosterTv,
    upcomingMatches,
    recentMatches,
  };
}

function matchSelect() {
  return {
    id: true,
    status: true,
    scheduledAt: true,
    scoreHome: true,
    scoreAway: true,
    outcome: true,
    homeTeamId: true,
    awayTeamId: true,
    round: { select: { roundNumber: true } },
    homeTeam: {
      select: { slug: true, name: true, city: true, primaryColor: true },
    },
    awayTeam: {
      select: { slug: true, name: true, city: true, primaryColor: true },
    },
  } as const;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDetailMatch(m: any, teamId: string): ProTeamDetailMatch {
  const isHome = (m.homeTeamId as string) === teamId;
  const opp = isHome ? m.awayTeam : m.homeTeam;
  return {
    id: m.id as string,
    roundNumber: m.round.roundNumber as number,
    status: m.status as string,
    scheduledAt: (m.scheduledAt as Date).toISOString(),
    homeTeamSlug: m.homeTeam.slug as string,
    awayTeamSlug: m.awayTeam.slug as string,
    isHome,
    opponent: {
      slug: opp.slug as string,
      name: opp.name as string,
      city: opp.city as string,
      primaryColor: (opp.primaryColor as string | null) ?? null,
    },
    scoreHome: (m.scoreHome as number | null) ?? null,
    scoreAway: (m.scoreAway as number | null) ?? null,
    outcome: (m.outcome as string | null) ?? null,
  };
}
