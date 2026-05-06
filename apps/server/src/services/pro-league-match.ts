/**
 * Pro League match detail — sprint Pro League lot 1.C.3.
 *
 * Service qui agrège les données nécessaires à la page
 * `/pro-league/matches/:id` :
 *  - meta (status, scheduledAt, simulatedAt, completedAt, engineVer)
 *  - équipes home/away (slug, name, city, race, palette)
 *  - score + outcome + counters (TD/cas/turnover/nuffle)
 *  - highlights pré-extraits depuis Replay (TD/CAS/NUFFLE)
 *
 * Les replays sont stockés CBOR + gzip (lot 1.A.2). On NE renvoie PAS
 * le payload brut sur cet endpoint — pour streamer les events, utiliser
 * `/pro-league/matches/:id/stream` (lot 1.B.2).
 *
 * Hors scope MVP : odds, lineups, hype meter, MVP, chat fans (lots 1.D
 * + 1.E).
 */

import { prisma } from "../prisma";

export interface ProMatchDetailTeam {
  readonly slug: string;
  readonly name: string;
  readonly city: string;
  readonly race: string;
  readonly nflFlavor: string | null;
  readonly primaryColor: string | null;
  readonly secondaryColor: string | null;
  readonly baseTv: number;
}

export interface ProMatchHighlight {
  readonly type: "TD" | "CASUALTY" | "NUFFLE";
  readonly atMs: number;
  readonly meta: Record<string, unknown>;
}

export interface ProMatchDetail {
  readonly id: string;
  readonly seasonId: string;
  readonly seasonYear: number;
  readonly roundNumber: number;
  /** "scheduled" | "ready" | "in_progress" | "completed" | "failed" */
  readonly status: string;
  readonly scheduledAt: string;
  readonly simulatedAt: string | null;
  readonly completedAt: string | null;
  readonly engineVer: string | null;
  readonly homeTeam: ProMatchDetailTeam;
  readonly awayTeam: ProMatchDetailTeam;
  readonly scoreHome: number | null;
  readonly scoreAway: number | null;
  /** "home" | "away" | "draw" | null */
  readonly outcome: string | null;
  readonly touchdownCount: number | null;
  readonly casualtyCount: number | null;
  readonly turnoverCount: number | null;
  readonly nuffleCount: number | null;
  /** Disponible quand le replay existe (status >= ready). */
  readonly replay: {
    readonly durationMs: number;
    readonly highlights: readonly ProMatchHighlight[];
  } | null;
}

export class ProMatchNotFoundError extends Error {
  constructor(id: string) {
    super(`ProLeagueMatch '${id}' introuvable`);
    this.name = "ProMatchNotFoundError";
  }
}

function teamMeta(t: {
  slug: unknown;
  name: unknown;
  city: unknown;
  race: unknown;
  nflFlavor?: unknown;
  primaryColor?: unknown;
  secondaryColor?: unknown;
  baseTv?: unknown;
}): ProMatchDetailTeam {
  return {
    slug: t.slug as string,
    name: t.name as string,
    city: t.city as string,
    race: t.race as string,
    nflFlavor: (t.nflFlavor as string | null) ?? null,
    primaryColor: (t.primaryColor as string | null) ?? null,
    secondaryColor: (t.secondaryColor as string | null) ?? null,
    baseTv: (t.baseTv as number) ?? 1000,
  };
}

function parseHighlights(raw: unknown): ProMatchHighlight[] {
  let arr: unknown;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch {
      return [];
    }
  } else {
    arr = raw;
  }
  if (!Array.isArray(arr)) return [];
  const out: ProMatchHighlight[] = [];
  for (const h of arr) {
    if (h && typeof h === "object") {
      const obj = h as Record<string, unknown>;
      const type = obj.type;
      const atMs = obj.atMs;
      if (
        (type === "TD" || type === "CASUALTY" || type === "NUFFLE") &&
        typeof atMs === "number"
      ) {
        out.push({
          type,
          atMs,
          meta: (obj.meta as Record<string, unknown> | undefined) ?? {},
        });
      }
    }
  }
  return out;
}

export async function getProMatchDetail(id: string): Promise<ProMatchDetail> {
  const m = await prisma.proLeagueMatch.findUnique({
    where: { id },
    select: {
      id: true,
      seasonId: true,
      status: true,
      scheduledAt: true,
      simulatedAt: true,
      completedAt: true,
      engineVer: true,
      scoreHome: true,
      scoreAway: true,
      outcome: true,
      touchdownCount: true,
      casualtyCount: true,
      turnoverCount: true,
      nuffleCount: true,
      season: { select: { year: true } },
      round: { select: { roundNumber: true } },
      homeTeam: {
        select: {
          slug: true,
          name: true,
          city: true,
          race: true,
          nflFlavor: true,
          primaryColor: true,
          secondaryColor: true,
          baseTv: true,
        },
      },
      awayTeam: {
        select: {
          slug: true,
          name: true,
          city: true,
          race: true,
          nflFlavor: true,
          primaryColor: true,
          secondaryColor: true,
          baseTv: true,
        },
      },
    },
  });
  if (!m) {
    throw new ProMatchNotFoundError(id);
  }

  // Charge le Replay (highlights + durationMs) si disponible.
  let replay: ProMatchDetail["replay"] = null;
  const replayRow = await prisma.replay.findUnique({
    where: { matchId: id },
    select: { durationMs: true, highlights: true },
  });
  if (replayRow) {
    replay = {
      durationMs: (replayRow.durationMs as number) ?? 0,
      highlights: parseHighlights(replayRow.highlights),
    };
  }

  return {
    id: m.id as string,
    seasonId: m.seasonId as string,
    seasonYear: m.season.year as number,
    roundNumber: m.round.roundNumber as number,
    status: m.status as string,
    scheduledAt: (m.scheduledAt as Date).toISOString(),
    simulatedAt:
      (m.simulatedAt as Date | null)?.toISOString() ?? null,
    completedAt:
      (m.completedAt as Date | null)?.toISOString() ?? null,
    engineVer: (m.engineVer as string | null) ?? null,
    homeTeam: teamMeta(m.homeTeam),
    awayTeam: teamMeta(m.awayTeam),
    scoreHome: (m.scoreHome as number | null) ?? null,
    scoreAway: (m.scoreAway as number | null) ?? null,
    outcome: (m.outcome as string | null) ?? null,
    touchdownCount: (m.touchdownCount as number | null) ?? null,
    casualtyCount: (m.casualtyCount as number | null) ?? null,
    turnoverCount: (m.turnoverCount as number | null) ?? null,
    nuffleCount: (m.nuffleCount as number | null) ?? null,
    replay,
  };
}
