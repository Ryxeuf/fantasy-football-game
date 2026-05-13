/**
 * Pro League Gazette daily recap aggregator — sprint Pro League lot
 * 1.E.3 (intermédiaire qui sera consommé par 1.E.1 LLM Gazette).
 *
 * Pour une date `at` donnée, agrège :
 *  - les matchs `completed` de la journée (= `completedAt` ∈ [at, at+24h])
 *  - les standings courants de la saison
 *  - les storylines détectés via `detectStorylines`
 *  - les `priorMatchups` (compte historique entre 2 équipes sur les
 *    30 derniers jours) pour détecter `rivalry_buildup`
 *
 * Le résultat est consommable par le LLM Claude Haiku (lot 1.E.1) pour
 * générer 1 article principal + 3 brèves + 1 édito.
 */

import { prisma } from "../prisma";

import {
  type MatchSnapshot,
  type StandingEntry,
  type Storyline,
  detectStorylines,
  matchupKey,
} from "./pro-storyline-detector";

const DAY_MS = 24 * 60 * 60 * 1000;
const RIVALRY_WINDOW_DAYS = 30;

export interface DailyRecap {
  /** Borne basse incluse (ISO). */
  readonly fromAt: string;
  /** Borne haute exclue (ISO). */
  readonly toAt: string;
  readonly matchesPlayed: number;
  readonly matches: readonly MatchSnapshot[];
  readonly standings: readonly StandingEntry[];
  readonly storylines: readonly Storyline[];
}

interface MatchRow {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  scoreHome: number | null;
  scoreAway: number | null;
  outcome: string | null;
  touchdownCount: number | null;
  casualtyCount: number | null;
  nuffleCount: number | null;
  completedAt: Date | null;
  homeTeam: { slug: string; name: string };
  awayTeam: { slug: string; name: string };
}

interface StandingRow {
  teamId: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  tdFor: number;
  team: { slug: string; name: string };
}

/**
 * Récupère le snapshot d'une journée Pro League prêt pour la Gazette.
 *
 * @param at Borne basse de la fenêtre (24h glissantes). Default = il y
 *   a 24h (i.e. on génère la Gazette du jour pour les matchs de J-1).
 */
export async function getDailyRecap(
  at: Date = new Date(Date.now() - DAY_MS),
): Promise<DailyRecap> {
  const fromAt = new Date(at.getTime());
  const toAt = new Date(at.getTime() + DAY_MS);

  const matchRows = (await prisma.proLeagueMatch.findMany({
    where: {
      status: "completed",
      completedAt: { gte: fromAt, lt: toAt },
      // Lot 2.C.3 — la Nuffle Gazette ne couvre pas les matchs sandbox.
      isTest: false,
    },
    orderBy: { completedAt: "asc" },
    select: {
      id: true,
      homeTeamId: true,
      awayTeamId: true,
      scoreHome: true,
      scoreAway: true,
      outcome: true,
      touchdownCount: true,
      casualtyCount: true,
      nuffleCount: true,
      completedAt: true,
      homeTeam: { select: { slug: true, name: true } },
      awayTeam: { select: { slug: true, name: true } },
    },
  })) as MatchRow[];

  // Matchs filtrés : on jette ceux qui n'ont pas tous les champs
  // requis (ex: failed). Le storyline detector exige des nombres.
  const matches: MatchSnapshot[] = matchRows
    .filter(
      (m) =>
        m.scoreHome !== null &&
        m.scoreAway !== null &&
        m.outcome !== null &&
        m.completedAt !== null,
    )
    .map((m) => ({
      id: m.id,
      homeTeamSlug: m.homeTeam.slug,
      homeTeamName: m.homeTeam.name,
      awayTeamSlug: m.awayTeam.slug,
      awayTeamName: m.awayTeam.name,
      scoreHome: m.scoreHome ?? 0,
      scoreAway: m.scoreAway ?? 0,
      outcome: m.outcome as "home" | "away" | "draw",
      touchdownCount: m.touchdownCount ?? 0,
      casualtyCount: m.casualtyCount ?? 0,
      nuffleCount: m.nuffleCount ?? 0,
      playedAt: (m.completedAt as Date).toISOString(),
    }));

  // Standings courants : on prend la saison `in_progress` (fallback
  // la plus récente). `isTest: false` exclut les test seasons admin.
  const inProgress = await prisma.proLeagueSeason.findFirst({
    where: { status: "in_progress", isTest: false },
    orderBy: { year: "asc" },
    select: { id: true },
  });
  const season =
    inProgress ??
    (await prisma.proLeagueSeason.findFirst({
      where: { isTest: false },
      orderBy: { year: "desc" },
      select: { id: true },
    }));

  let standings: StandingEntry[] = [];
  if (season) {
    const standingRows = (await prisma.proLeagueStandings.findMany({
      where: { seasonId: season.id as string },
      orderBy: [
        { points: "desc" },
        { tdFor: "desc" },
      ],
      select: {
        teamId: true,
        played: true,
        wins: true,
        draws: true,
        losses: true,
        points: true,
        tdFor: true,
        team: { select: { slug: true, name: true } },
      },
    })) as StandingRow[];
    standings = standingRows.map((s, i) => ({
      teamSlug: s.team.slug,
      teamName: s.team.name,
      played: s.played,
      wins: s.wins,
      draws: s.draws,
      losses: s.losses,
      points: s.points,
      rank: i + 1,
    }));
  }

  // Compte les matchups passés sur les 30 derniers jours pour les
  // pairings de la journée. Q.A.4 — enrichit avec W-D-L + streak
  // (perspective home du match courant).
  const rivalryFromAt = new Date(at.getTime() - RIVALRY_WINDOW_DAYS * DAY_MS);
  const priorMatchups = new Map<
    string,
    {
      count: number;
      firstAt: string;
      winsHome: number;
      winsAway: number;
      draws: number;
      streakKind: "win" | "loss" | "draw" | "none";
      streakLength: number;
    }
  >();
  for (const m of matches) {
    const key = matchupKey(m.homeTeamSlug, m.awayTeamSlug);
    if (priorMatchups.has(key)) continue; // déjà calculé
    const past = (await prisma.proLeagueMatch.findMany({
      where: {
        status: "completed",
        completedAt: { gte: rivalryFromAt, lte: toAt },
        isTest: false,
        OR: [
          {
            homeTeam: { slug: m.homeTeamSlug },
            awayTeam: { slug: m.awayTeamSlug },
          },
          {
            homeTeam: { slug: m.awayTeamSlug },
            awayTeam: { slug: m.homeTeamSlug },
          },
        ],
      },
      orderBy: { completedAt: "desc" },
      select: {
        completedAt: true,
        homeTeam: { select: { slug: true } },
        awayTeam: { select: { slug: true } },
        outcome: true,
      },
    })) as Array<{
      completedAt: Date | null;
      homeTeam: { slug: string };
      awayTeam: { slug: string };
      outcome: string | null;
    }>;
    if (past.length > 0) {
      // Compte W-D-L perspective home du match courant.
      let winsHome = 0;
      let winsAway = 0;
      let draws = 0;
      function pastResultForCurrentHome(
        rec: typeof past[number],
      ): "win" | "loss" | "draw" | null {
        if (rec.outcome === null) return null;
        const curHomeWasHome = rec.homeTeam.slug === m.homeTeamSlug;
        if (rec.outcome === "draw") return "draw";
        if (rec.outcome === "home") return curHomeWasHome ? "win" : "loss";
        return curHomeWasHome ? "loss" : "win";
      }
      for (const rec of past) {
        const r = pastResultForCurrentHome(rec);
        if (r === "win") winsHome += 1;
        else if (r === "loss") winsAway += 1;
        else if (r === "draw") draws += 1;
      }
      // Streak depuis le plus recent.
      let streakKind: "win" | "loss" | "draw" | "none" = "none";
      let streakLength = 0;
      for (const rec of past) {
        const r = pastResultForCurrentHome(rec);
        if (r === null) continue;
        if (streakLength === 0) {
          streakKind = r;
          streakLength = 1;
        } else if (r === streakKind) {
          streakLength += 1;
        } else {
          break;
        }
      }
      // `past` est order desc → firstAt = dernier element.
      const firstAt = past[past.length - 1].completedAt as Date;
      priorMatchups.set(key, {
        count: past.length,
        firstAt: firstAt.toISOString(),
        winsHome,
        winsAway,
        draws,
        streakKind,
        streakLength,
      });
    }
  }

  const storylines = detectStorylines({
    matches,
    standings,
    priorMatchups,
  });

  return {
    fromAt: fromAt.toISOString(),
    toAt: toAt.toISOString(),
    matchesPlayed: matches.length,
    matches,
    standings,
    storylines,
  };
}
