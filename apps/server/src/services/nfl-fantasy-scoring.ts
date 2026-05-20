/**
 * Service NFL Fantasy Scoring — Phase 2.E.
 *
 * Deux responsabilites :
 *
 *   1. `generateMatchups({ leagueId, weekId })` — pair les entries
 *      d'une league pour une semaine donnee (round-robin "circle
 *      method" deterministe). Idempotent : si des matchups existent
 *      deja pour (leagueId, weekId), on retourne sans rien creer.
 *
 *   2. `settleNflFantasyWeek({ leagueId, weekId })` — pour chaque
 *      matchup non-settle, calcule les SPP de chaque starter via
 *      NflGameStat (computedSpp ingere en Phase 2.A), applique les
 *      multipliers captain (Q3 ×1.5) / vice (Q3 ×1.2), persiste
 *      starter.rawSpp + finalSpp + sppBreakdown, lineup.totalSpp,
 *      matchup.homeScore/awayScore + winnerId + settledAt.
 *      Idempotent (pattern Q.D.1 — skip si settledAt set).
 *
 * Hors scope V1 :
 *   - Rerolls / inducements / prayers (Phase 2.F applique des bonus
 *     additionnels sur finalSpp).
 *   - Standings agregees / playoffs.
 */

import type { NflFantasyMatchup } from "@prisma/client";

import { prisma } from "../prisma";
import {
  CAPTAIN_MULTIPLIER,
  VICE_CAPTAIN_MULTIPLIER,
} from "./nfl-fantasy-lineup";

// ────────────────────────────────────────────────────────────────────
// Erreur typee
// ────────────────────────────────────────────────────────────────────

export type NflFantasyScoringErrorCode =
  | "LEAGUE_NOT_FOUND"
  | "WEEK_NOT_FOUND"
  | "ODD_ENTRIES"
  | "NO_MATCHUPS";

export class NflFantasyScoringError extends Error {
  constructor(
    public readonly code: NflFantasyScoringErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "NflFantasyScoringError";
  }
}

// ────────────────────────────────────────────────────────────────────
// Helpers purs
// ────────────────────────────────────────────────────────────────────

export interface PairingResult {
  readonly homeEntryId: string;
  readonly awayEntryId: string;
}

/**
 * Round-robin "circle method" : fixe le 1er entry, fait tourner les
 * autres d'une position par semaine. Sur N entries pairs, donne N-1
 * weeks distinctes avant repetition.
 *
 * Pur, deterministe. Tri prealable des entries pour stabilite.
 *
 * @param entryIds Liste stable (deja triee).
 * @param weekNumber 1-indexed.
 * @throws ODD_ENTRIES si nombre impair (les byes seront geres en V2).
 */
export function pairEntriesForWeek(
  entryIds: ReadonlyArray<string>,
  weekNumber: number,
): readonly PairingResult[] {
  const n = entryIds.length;
  if (n < 2) return [];
  if (n % 2 !== 0) {
    throw new NflFantasyScoringError(
      "ODD_ENTRIES",
      `Nombre d'entries impair (${n}) — byes non geres en V1`,
    );
  }

  const fixed = entryIds[0]!;
  const rotating = entryIds.slice(1);
  const rotateBy = ((weekNumber - 1) % rotating.length + rotating.length) %
    rotating.length;
  const rotated = [...rotating.slice(rotateBy), ...rotating.slice(0, rotateBy)];
  const teams = [fixed, ...rotated];

  const out: PairingResult[] = [];
  for (let i = 0; i < n / 2; i++) {
    out.push({
      homeEntryId: teams[i]!,
      awayEntryId: teams[n - 1 - i]!,
    });
  }
  return out;
}

/**
 * Applique les multipliers captain/vice a un raw SPP. Truncate vers
 * 0 (pas d'arrondi banker) pour rester reproductible.
 *
 * Pur.
 */
export function applyCaptainMultiplier(opts: {
  rawSpp: number;
  isCaptain: boolean;
  isViceCaptain: boolean;
}): number {
  if (opts.isCaptain) return Math.trunc(opts.rawSpp * CAPTAIN_MULTIPLIER);
  if (opts.isViceCaptain) {
    return Math.trunc(opts.rawSpp * VICE_CAPTAIN_MULTIPLIER);
  }
  return opts.rawSpp;
}

/**
 * Determine le gagnant d'un matchup. null si tie ou scores non settles.
 * Pur.
 */
export function determineWinner(opts: {
  homeEntryId: string;
  awayEntryId: string;
  homeScore: number | null;
  awayScore: number | null;
}): string | null {
  if (opts.homeScore == null || opts.awayScore == null) return null;
  if (opts.homeScore === opts.awayScore) return null;
  return opts.homeScore > opts.awayScore
    ? opts.homeEntryId
    : opts.awayEntryId;
}

// ────────────────────────────────────────────────────────────────────
// generateMatchups
// ────────────────────────────────────────────────────────────────────

export interface GenerateMatchupsOpts {
  readonly leagueId: string;
  readonly weekId: string;
}

export interface GenerateMatchupsResult {
  readonly matchupsCreated: number;
  readonly matchupsExisting: number;
  readonly weekNumber: number;
}

function parseWeekNumber(weekId: string): number {
  // weekId format "YYYY:W{n}"
  const m = weekId.match(/^.+:W(\d+)$/);
  return m ? Number(m[1]) : 1;
}

/**
 * Genere les matchups d'une (league, week). Idempotent : si des
 * matchups existent deja pour ce couple, retourne 0 cree + le compte
 * existant. Tri des entries par joinedAt asc pour pairing stable.
 */
export async function generateMatchups(
  opts: GenerateMatchupsOpts,
): Promise<GenerateMatchupsResult> {
  const league = await prisma.nflFantasyLeague.findUnique({
    where: { id: opts.leagueId },
    include: { entries: { orderBy: { joinedAt: "asc" } } },
  });
  if (!league) {
    throw new NflFantasyScoringError(
      "LEAGUE_NOT_FOUND",
      `League ${opts.leagueId} introuvable`,
    );
  }

  const week = await prisma.nflWeek.findUnique({ where: { id: opts.weekId } });
  if (!week) {
    throw new NflFantasyScoringError(
      "WEEK_NOT_FOUND",
      `NflWeek ${opts.weekId} introuvable`,
    );
  }

  const existing = await prisma.nflFantasyMatchup.findMany({
    where: { leagueId: opts.leagueId, weekId: opts.weekId },
    select: { id: true },
  });
  if (existing.length > 0) {
    return {
      matchupsCreated: 0,
      matchupsExisting: existing.length,
      weekNumber: week.weekNumber,
    };
  }

  const entryIds = league.entries.map((e) => e.id);
  const pairings = pairEntriesForWeek(entryIds, week.weekNumber);

  if (pairings.length === 0) {
    return { matchupsCreated: 0, matchupsExisting: 0, weekNumber: week.weekNumber };
  }

  await prisma.nflFantasyMatchup.createMany({
    data: pairings.map((p) => ({
      leagueId: opts.leagueId,
      weekId: opts.weekId,
      homeEntryId: p.homeEntryId,
      awayEntryId: p.awayEntryId,
    })),
  });

  return {
    matchupsCreated: pairings.length,
    matchupsExisting: 0,
    weekNumber: week.weekNumber,
  };
}

// ────────────────────────────────────────────────────────────────────
// settleNflFantasyWeek
// ────────────────────────────────────────────────────────────────────

export interface SettleWeekOpts {
  readonly leagueId: string;
  readonly weekId: string;
}

export interface SettleWeekResult {
  readonly matchupsSettled: number;
  readonly matchupsSkipped: number;
  readonly startersScored: number;
}

interface StarterRow {
  readonly id: string;
  readonly playerId: string;
  readonly isCaptain: boolean;
  readonly isViceCaptain: boolean;
  readonly lineupId: string;
}

/**
 * Settle tous les matchups non-settles d'une (league, week).
 *
 * Pour chaque matchup :
 *   - Charge le lineup home + away et leurs starters
 *   - Pour chaque starter, recupere computedSpp depuis NflGameStat de
 *     la semaine (si le joueur a un stat sur l'un des NflGame du week,
 *     sinon rawSpp = 0)
 *   - Applique captain/vice multipliers => finalSpp
 *   - Persiste starter.rawSpp / finalSpp / sppBreakdown
 *   - Persiste lineup.totalSpp (sum des finalSpp)
 *   - Persiste matchup.homeScore / awayScore / winnerId / settledAt
 *
 * Idempotent : skip les matchups deja settles (settledAt non null).
 * Le caller peut repasser sans risque.
 */
export async function settleNflFantasyWeek(
  opts: SettleWeekOpts,
): Promise<SettleWeekResult> {
  // 1. Charger les matchups non-settles
  const matchups = await prisma.nflFantasyMatchup.findMany({
    where: {
      leagueId: opts.leagueId,
      weekId: opts.weekId,
      settledAt: null,
    },
  });

  const allMatchups = await prisma.nflFantasyMatchup.count({
    where: { leagueId: opts.leagueId, weekId: opts.weekId },
  });

  if (matchups.length === 0) {
    return {
      matchupsSettled: 0,
      matchupsSkipped: allMatchups,
      startersScored: 0,
    };
  }

  // 2. Charger les games de la semaine + leurs stats (1 query batch)
  const weekGames = await prisma.nflGame.findMany({
    where: { weekId: opts.weekId },
    select: { id: true },
  });
  const gameIds = weekGames.map((g) => g.id);

  // 3. Collecter tous les entryIds impliques pour fetch lineups
  const entryIds = Array.from(
    new Set(matchups.flatMap((m) => [m.homeEntryId, m.awayEntryId])),
  );

  const lineups = await prisma.nflFantasyLineup.findMany({
    where: { entryId: { in: entryIds }, weekId: opts.weekId },
    include: { starters: true },
  });
  const lineupByEntry = new Map<string, (typeof lineups)[number]>();
  for (const l of lineups) lineupByEntry.set(l.entryId, l);

  // 4. Charger tous les NflGameStat pertinents (1 query batch)
  const allStarterIds = lineups.flatMap((l) =>
    l.starters.map((s) => s.playerId),
  );
  const stats =
    gameIds.length === 0 || allStarterIds.length === 0
      ? []
      : await prisma.nflGameStat.findMany({
          where: { gameId: { in: gameIds }, playerId: { in: allStarterIds } },
          select: {
            playerId: true,
            computedSpp: true,
            sppBreakdown: true,
          },
        });
  const sppByPlayer = new Map(stats.map((s) => [s.playerId, s]));

  let matchupsSettled = 0;
  let startersScored = 0;

  // 5. Pour chaque matchup, settle dans une transaction par matchup
  for (const m of matchups) {
    const home = lineupByEntry.get(m.homeEntryId);
    const away = lineupByEntry.get(m.awayEntryId);

    const homeStarters: StarterRow[] = home?.starters ?? [];
    const awayStarters: StarterRow[] = away?.starters ?? [];

    let homeTotal = 0;
    let awayTotal = 0;
    const starterUpdates: Array<{
      id: string;
      rawSpp: number;
      finalSpp: number;
      sppBreakdown: unknown;
    }> = [];

    for (const s of homeStarters) {
      const stat = sppByPlayer.get(s.playerId);
      const rawSpp = stat?.computedSpp ?? 0;
      const finalSpp = applyCaptainMultiplier({
        rawSpp,
        isCaptain: s.isCaptain,
        isViceCaptain: s.isViceCaptain,
      });
      homeTotal += finalSpp;
      starterUpdates.push({
        id: s.id,
        rawSpp,
        finalSpp,
        sppBreakdown: stat?.sppBreakdown ?? null,
      });
      startersScored++;
    }
    for (const s of awayStarters) {
      const stat = sppByPlayer.get(s.playerId);
      const rawSpp = stat?.computedSpp ?? 0;
      const finalSpp = applyCaptainMultiplier({
        rawSpp,
        isCaptain: s.isCaptain,
        isViceCaptain: s.isViceCaptain,
      });
      awayTotal += finalSpp;
      starterUpdates.push({
        id: s.id,
        rawSpp,
        finalSpp,
        sppBreakdown: stat?.sppBreakdown ?? null,
      });
      startersScored++;
    }

    const winnerId = determineWinner({
      homeEntryId: m.homeEntryId,
      awayEntryId: m.awayEntryId,
      homeScore: homeTotal,
      awayScore: awayTotal,
    });

    await prisma.$transaction([
      ...starterUpdates.map((u) =>
        prisma.nflFantasyLineupStarter.update({
          where: { id: u.id },
          data: {
            rawSpp: u.rawSpp,
            finalSpp: u.finalSpp,
            sppBreakdown: u.sppBreakdown as never,
          },
        }),
      ),
      ...(home
        ? [
            prisma.nflFantasyLineup.update({
              where: { id: home.id },
              data: { totalSpp: homeTotal },
            }),
          ]
        : []),
      ...(away
        ? [
            prisma.nflFantasyLineup.update({
              where: { id: away.id },
              data: { totalSpp: awayTotal },
            }),
          ]
        : []),
      prisma.nflFantasyMatchup.update({
        where: { id: m.id },
        data: {
          homeScore: homeTotal,
          awayScore: awayTotal,
          winnerId,
          settledAt: new Date(),
        },
      }),
    ]);
    matchupsSettled++;
  }

  return {
    matchupsSettled,
    matchupsSkipped: allMatchups - matchupsSettled,
    startersScored,
  };
}

// ────────────────────────────────────────────────────────────────────
// Helpers read-only
// ────────────────────────────────────────────────────────────────────

export async function listMatchupsForWeek(opts: {
  leagueId: string;
  weekId: string;
}): Promise<NflFantasyMatchup[]> {
  return prisma.nflFantasyMatchup.findMany({
    where: { leagueId: opts.leagueId, weekId: opts.weekId },
    orderBy: { createdAt: "asc" },
  });
}

// ────────────────────────────────────────────────────────────────────
// Standings (vue derivee, computed a la lecture)
// ────────────────────────────────────────────────────────────────────

export interface StandingsRow {
  readonly entryId: string;
  readonly teamName: string;
  readonly wins: number;
  readonly losses: number;
  readonly ties: number;
  readonly pointsFor: number;
  readonly pointsAgainst: number;
  readonly differential: number;
  readonly games: number;
}

/**
 * Compute pur des standings a partir d'une liste de matchups settles.
 * Pur, testable. Tri : wins desc, then differential desc, then pointsFor desc.
 *
 * Les matchups non-settles (settledAt null) sont ignores.
 */
export function computeStandings(opts: {
  entries: ReadonlyArray<{ id: string; teamName: string }>;
  matchups: ReadonlyArray<{
    homeEntryId: string;
    awayEntryId: string;
    homeScore: number | null;
    awayScore: number | null;
    winnerId: string | null;
    settledAt: Date | null;
  }>;
}): StandingsRow[] {
  const rows = new Map<string, {
    teamName: string;
    wins: number;
    losses: number;
    ties: number;
    pointsFor: number;
    pointsAgainst: number;
  }>();
  for (const e of opts.entries) {
    rows.set(e.id, {
      teamName: e.teamName,
      wins: 0,
      losses: 0,
      ties: 0,
      pointsFor: 0,
      pointsAgainst: 0,
    });
  }

  for (const m of opts.matchups) {
    if (m.settledAt == null || m.homeScore == null || m.awayScore == null) continue;
    const home = rows.get(m.homeEntryId);
    const away = rows.get(m.awayEntryId);
    if (!home || !away) continue;
    home.pointsFor += m.homeScore;
    home.pointsAgainst += m.awayScore;
    away.pointsFor += m.awayScore;
    away.pointsAgainst += m.homeScore;
    if (m.winnerId == null) {
      home.ties++;
      away.ties++;
    } else if (m.winnerId === m.homeEntryId) {
      home.wins++;
      away.losses++;
    } else if (m.winnerId === m.awayEntryId) {
      home.losses++;
      away.wins++;
    }
  }

  const out: StandingsRow[] = [];
  for (const [entryId, r] of rows) {
    out.push({
      entryId,
      teamName: r.teamName,
      wins: r.wins,
      losses: r.losses,
      ties: r.ties,
      pointsFor: r.pointsFor,
      pointsAgainst: r.pointsAgainst,
      differential: r.pointsFor - r.pointsAgainst,
      games: r.wins + r.losses + r.ties,
    });
  }
  out.sort((a, b) => {
    if (a.wins !== b.wins) return b.wins - a.wins;
    if (a.differential !== b.differential) return b.differential - a.differential;
    return b.pointsFor - a.pointsFor;
  });
  return out;
}

/**
 * Fetch + compute des standings d'une league. Read-only, suffisant V1.
 * V2 introduira une vue persistee + invalidation au settle.
 */
export async function getLeagueStandings(
  leagueId: string,
): Promise<StandingsRow[]> {
  const [entries, matchups] = await Promise.all([
    prisma.nflFantasyEntry.findMany({
      where: { leagueId },
      select: { id: true, teamName: true },
    }),
    prisma.nflFantasyMatchup.findMany({
      where: { leagueId, settledAt: { not: null } },
      select: {
        homeEntryId: true,
        awayEntryId: true,
        homeScore: true,
        awayScore: true,
        winnerId: true,
        settledAt: true,
      },
    }),
  ]);
  return computeStandings({ entries, matchups });
}
