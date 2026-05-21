/**
 * Service d'ingestion NFL Fantasy — Phase 2.B (ESPN gameday + rosters).
 *
 * Complete `nfl-ingest.ts` (qui gere nflverse post-match) avec deux flux
 * ESPN hidden API :
 *
 *   1. `ingestEspnGameday(dateYmd)` — pull le scoreboard d'une date ET,
 *      upsert NflGame (status + scores live). Pattern Q.D.1 idempotent
 *      + audit NflIngestRun.
 *
 *   2. `ingestEspnRosters({ seasonId, teamCodes? })` — pull les rosters
 *      des 32 teams (ou un sous-ensemble), snapshot dans
 *      NflRosterSnapshot. Idempotent (chaque appel cree un snapshot date).
 *
 * Gotchas resolus (cf. POC scripts/nfl-poc/ + docs/nfl-fantasy/03-api-strategy.md) :
 *   - ESPN team code "WSH" -> nflverse "WAS"
 *   - Numerotation playoffs ESPN reset a 1 (Wildcard=1, Div=2, Conf=3,
 *     Pro Bowl=4 [skip], SB=5) vs nflverse 19-22. Mapping applique.
 *   - season.type fige a "Regular Season" cote leagues[0], lire au niveau
 *     event.season.slug.
 *
 * Limites V1 documentees :
 *   - ESPN athlete IDs (numeriques) ≠ nflverse gsis_id ("00-...").
 *     Pas de backfill jersey number / position dans NflPlayer en V1 ;
 *     les snapshots restent en JSON pour exploitation ulterieure.
 */

import {
  getAllTeams,
  type NflTeamCode,
} from "@bb/nfl-mapper";

import { prisma } from "../prisma";
import { NflIngestError } from "./nfl-ingest";
import { serverLog } from "../utils/server-log";

// ────────────────────────────────────────────────────────────────────
// Types ESPN (shape minimal utilise)
// ────────────────────────────────────────────────────────────────────

export interface EspnCompetitor {
  readonly homeAway?: "home" | "away";
  readonly team?: { readonly abbreviation?: string };
  readonly score?: string;
  readonly winner?: boolean;
}

export interface EspnEvent {
  readonly id: string;
  readonly date: string;
  readonly status?: {
    readonly type?: {
      readonly name?: string;
      readonly state?: string;
      readonly completed?: boolean;
      readonly description?: string;
    };
  };
  readonly competitions?: ReadonlyArray<{
    readonly competitors?: readonly EspnCompetitor[];
  }>;
  readonly season?: {
    readonly year?: number;
    readonly type?: number;
    readonly slug?: string;
  };
  readonly week?: { readonly number?: number };
}

export interface EspnScoreboard {
  readonly events?: readonly EspnEvent[];
}

export interface EspnAthlete {
  readonly id: string;
  readonly displayName?: string;
  readonly fullName?: string;
  readonly jersey?: string;
  readonly position?: { readonly abbreviation?: string };
  readonly active?: boolean;
  readonly status?: { readonly type?: string; readonly name?: string };
}

export interface EspnRosterGroup {
  readonly position?: string;
  readonly items?: readonly EspnAthlete[];
}

export interface EspnRosterResponse {
  readonly team?: { readonly abbreviation?: string };
  readonly athletes?: readonly EspnRosterGroup[];
}

// ────────────────────────────────────────────────────────────────────
// Helpers purs
// ────────────────────────────────────────────────────────────────────

const ESPN_TO_NFLVERSE_TEAM: Readonly<Record<string, string>> = {
  WSH: "WAS",
};

const NFLVERSE_TO_ESPN_TEAM: Readonly<Record<string, string>> = {
  WAS: "WSH",
};

/**
 * Normalise un code equipe ESPN vers le code interne (aligne nflverse +
 * @bb/nfl-mapper). Retourne null si inconnu.
 */
export function normalizeEspnTeamCode(raw: string): NflTeamCode | null {
  const upper = raw.trim().toUpperCase();
  if (!upper) return null;
  const candidate = ESPN_TO_NFLVERSE_TEAM[upper] ?? upper;
  const valid = getAllTeams().some((t) => t.code === candidate);
  return valid ? (candidate as NflTeamCode) : null;
}

/**
 * Convertit un code interne (nflverse-aligne) vers le code ESPN
 * accepte par les endpoints /teams/{code}/roster.
 */
export function toEspnTeamCode(code: NflTeamCode): string {
  return NFLVERSE_TO_ESPN_TEAM[code] ?? code;
}

/**
 * Mappe le `status.type.name` ESPN vers le statut interne NflGame.
 *
 * Valeurs ESPN observees : STATUS_SCHEDULED, STATUS_IN_PROGRESS,
 * STATUS_HALFTIME, STATUS_END_PERIOD, STATUS_FINAL, STATUS_POSTPONED, ...
 */
export function mapEspnStatusToNflGameStatus(
  statusName: string | undefined,
): "scheduled" | "in_progress" | "final" {
  if (!statusName) return "scheduled";
  if (statusName === "STATUS_FINAL") return "final";
  if (statusName === "STATUS_SCHEDULED" || statusName === "STATUS_POSTPONED") {
    return "scheduled";
  }
  return "in_progress";
}

/**
 * Convertit la numerotation ESPN en numerotation nflverse interne.
 *
 *   - Regular season : weekNumber passe tel quel (1-18).
 *   - Post-season ESPN (slug=="post-season") :
 *       1 (Wildcard)        -> 19
 *       2 (Divisional)      -> 20
 *       3 (Conference)      -> 21
 *       4 (Pro Bowl)        -> -1 (skip, pas de NflWeek associee)
 *       5 (Super Bowl)      -> 22
 *
 * Retourne -1 pour les valeurs sans equivalent (Pro Bowl, week
 * inconnue).
 */
export function mapEspnWeekToNflverseWeek(
  seasonSlug: string | undefined,
  weekNumber: number,
): number {
  if (seasonSlug !== "post-season") return weekNumber;
  switch (weekNumber) {
    case 1:
      return 19;
    case 2:
      return 20;
    case 3:
      return 21;
    case 5:
      return 22;
    default:
      return -1;
  }
}

export interface ParsedEspnGame {
  readonly nflverseGameId: string;
  readonly espnEventId: string;
  readonly seasonId: string;
  readonly weekId: string;
  readonly weekNumber: number;
  readonly homeTeam: NflTeamCode;
  readonly awayTeam: NflTeamCode;
  readonly homeScore: number | null;
  readonly awayScore: number | null;
  readonly kickoffAt: Date;
  readonly status: "scheduled" | "in_progress" | "final";
}

function parseScore(raw: string | undefined): number | null {
  if (raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse un event ESPN vers la structure prete-pour-upsert.
 * Retourne null si :
 *   - week / season manquant
 *   - Pro Bowl (mapEspnWeek -> -1)
 *   - team codes invalides
 *   - competitors absents
 *
 * Pur (pas d'I/O).
 */
export function parseEspnEvent(event: EspnEvent): ParsedEspnGame | null {
  const year = event.season?.year;
  const espnWeekNumber = event.week?.number;
  if (!year || !espnWeekNumber) return null;

  const nflverseWeekNumber = mapEspnWeekToNflverseWeek(
    event.season?.slug,
    espnWeekNumber,
  );
  if (nflverseWeekNumber === -1) return null;

  const competitors = event.competitions?.[0]?.competitors ?? [];
  const home = competitors.find((c) => c.homeAway === "home");
  const away = competitors.find((c) => c.homeAway === "away");
  if (!home || !away) return null;

  const homeTeam = normalizeEspnTeamCode(home.team?.abbreviation ?? "");
  const awayTeam = normalizeEspnTeamCode(away.team?.abbreviation ?? "");
  if (!homeTeam || !awayTeam) return null;

  const seasonId = String(year);
  const weekId = `${seasonId}:W${nflverseWeekNumber}`;
  const nflverseGameId = `${seasonId}_${String(nflverseWeekNumber).padStart(2, "0")}_${awayTeam}_${homeTeam}`;

  return {
    nflverseGameId,
    espnEventId: event.id,
    seasonId,
    weekId,
    weekNumber: nflverseWeekNumber,
    homeTeam,
    awayTeam,
    homeScore: parseScore(home.score),
    awayScore: parseScore(away.score),
    kickoffAt: new Date(event.date),
    status: mapEspnStatusToNflGameStatus(event.status?.type?.name),
  };
}

export interface RosterAthlete {
  readonly espnId: string;
  readonly fullName: string;
  readonly jersey: number | null;
  readonly position: string;
  readonly active: boolean;
}

/**
 * Aplatit une reponse ESPN /teams/{x}/roster en liste de RosterAthlete.
 * Pur.
 */
export function parseEspnRoster(resp: EspnRosterResponse): readonly RosterAthlete[] {
  const groups = resp.athletes ?? [];
  const out: RosterAthlete[] = [];
  for (const g of groups) {
    const items = g.items ?? [];
    for (const a of items) {
      const jerseyRaw = a.jersey;
      const jersey =
        jerseyRaw && jerseyRaw !== "" ? Number(jerseyRaw) : null;
      out.push({
        espnId: a.id,
        fullName: a.displayName ?? a.fullName ?? "",
        jersey: jersey !== null && Number.isFinite(jersey) ? jersey : null,
        position: a.position?.abbreviation ?? "",
        active: a.active !== false,
      });
    }
  }
  return out;
}

// ────────────────────────────────────────────────────────────────────
// Fetch wrappers (overridables pour tests)
// ────────────────────────────────────────────────────────────────────

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";

async function fetchEspnScoreboardLive(dateYmd: string): Promise<EspnScoreboard> {
  // ESPN accepte YYYYMMDD (sans tirets). On normalise.
  const compact = dateYmd.replace(/-/g, "");
  const url = `${ESPN_BASE}/scoreboard?dates=${compact}`;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new NflIngestError(
      "FETCH_FAILED",
      `ESPN scoreboard fetch failed ${res.status} ${res.statusText} - ${url}`,
    );
  }
  return (await res.json()) as EspnScoreboard;
}

/**
 * Fetch un scoreboard ESPN par saison/week au lieu d'une date precise.
 * Utile pour rattraper une semaine entiere (~14-16 games sur 3 jours).
 *
 * weekNumber 1-18 = regular season, 19-22 = postseason (mapping inverse
 * de mapEspnWeekToNflverseWeek).
 */
async function fetchEspnScoreboardByWeekLive(
  seasonYear: number,
  weekNumber: number,
): Promise<EspnScoreboard> {
  let seasonType: number;
  let espnWeek: number;
  if (weekNumber <= 18) {
    seasonType = 2;
    espnWeek = weekNumber;
  } else {
    seasonType = 3;
    // nflverse W19=Wildcard, W20=Div, W21=Conf, W22=SB (skip Pro Bowl=4)
    const map: Record<number, number> = { 19: 1, 20: 2, 21: 3, 22: 5 };
    espnWeek = map[weekNumber] ?? 1;
  }
  const url = `${ESPN_BASE}/scoreboard?year=${seasonYear}&seasontype=${seasonType}&week=${espnWeek}`;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new NflIngestError(
      "FETCH_FAILED",
      `ESPN scoreboard fetch failed ${res.status} ${res.statusText} - ${url}`,
    );
  }
  return (await res.json()) as EspnScoreboard;
}

async function fetchEspnRosterLive(teamCode: string): Promise<EspnRosterResponse> {
  const url = `${ESPN_BASE}/teams/${teamCode}/roster`;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new NflIngestError(
      "FETCH_FAILED",
      `ESPN roster fetch failed ${res.status} ${res.statusText} - ${url}`,
    );
  }
  return (await res.json()) as EspnRosterResponse;
}

// ────────────────────────────────────────────────────────────────────
// Ingestion gameday
// ────────────────────────────────────────────────────────────────────

export interface IngestEspnGamedayOpts {
  /** Date au format YYYYMMDD (ESPN filtre en ET local). */
  readonly dateYmd: string;
  /** Override fetch pour les tests. */
  readonly fetchScoreboard?: (dateYmd: string) => Promise<EspnScoreboard>;
}

export interface IngestEspnGamedayResult {
  readonly source: "espn";
  readonly dateYmd: string;
  readonly gamesUpdated: number;
  readonly gamesSkipped: number;
  readonly errors: ReadonlyArray<{ context: string; error: string }>;
  readonly ingestRunId: string;
}

/**
 * Pull le scoreboard ESPN pour une date, upsert NflGame en DB.
 *
 * Idempotent : re-run sur meme date met a jour les scores/status sans
 * dupliquer. Si la NflWeek associee n'existe pas (saison non seedee),
 * l'event est skip avec un warning dans `errors`.
 *
 * @throws NflIngestError sur fetch failure
 */
export async function ingestEspnGameday(
  opts: IngestEspnGamedayOpts,
): Promise<IngestEspnGamedayResult> {
  const ingestRun = await prisma.nflIngestRun.create({
    data: {
      source: "espn",
      weekId: null,
      status: "in_progress",
      result: { dateYmd: opts.dateYmd },
    },
  });

  const errors: Array<{ context: string; error: string }> = [];
  let gamesUpdated = 0;
  let gamesSkipped = 0;

  try {
    const scoreboard = await (opts.fetchScoreboard ?? fetchEspnScoreboardLive)(
      opts.dateYmd,
    );
    const events = scoreboard.events ?? [];

    for (const ev of events) {
      try {
        const parsed = parseEspnEvent(ev);
        if (!parsed) {
          gamesSkipped++;
          continue;
        }

        const week = await prisma.nflWeek.findUnique({
          where: { id: parsed.weekId },
        });
        if (!week) {
          gamesSkipped++;
          errors.push({
            context: ev.id,
            error: `NflWeek ${parsed.weekId} absent (seed la saison d'abord)`,
          });
          continue;
        }

        await prisma.nflGame.upsert({
          where: { id: parsed.nflverseGameId },
          update: {
            homeScore: parsed.homeScore,
            awayScore: parsed.awayScore,
            status: parsed.status,
            kickoffAt: parsed.kickoffAt,
          },
          create: {
            id: parsed.nflverseGameId,
            seasonId: parsed.seasonId,
            weekId: parsed.weekId,
            homeTeam: parsed.homeTeam,
            awayTeam: parsed.awayTeam,
            homeScore: parsed.homeScore,
            awayScore: parsed.awayScore,
            kickoffAt: parsed.kickoffAt,
            status: parsed.status,
          },
        });
        gamesUpdated++;
      } catch (e) {
        errors.push({ context: ev.id, error: (e as Error).message });
      }
    }

    await prisma.nflIngestRun.update({
      where: { id: ingestRun.id },
      data: {
        completedAt: new Date(),
        status: errors.length === 0 ? "success" : "partial",
        result: { dateYmd: opts.dateYmd, gamesUpdated, gamesSkipped, errors },
      },
    });

    return {
      source: "espn",
      dateYmd: opts.dateYmd,
      gamesUpdated,
      gamesSkipped,
      errors,
      ingestRunId: ingestRun.id,
    };
  } catch (e) {
    await prisma.nflIngestRun.update({
      where: { id: ingestRun.id },
      data: {
        completedAt: new Date(),
        status: "failed",
        result: {
          dateYmd: opts.dateYmd,
          error: (e as Error).message,
          gamesUpdated,
          gamesSkipped,
        },
      },
    });
    throw e;
  }
}

// ────────────────────────────────────────────────────────────────────
// Backfill scores manquants (Phase 5.B)
// ────────────────────────────────────────────────────────────────────

export interface BackfillScoresOpts {
  /** Restreint la recherche a une saison (default = toutes). */
  readonly seasonId?: string;
  /** Override fetch par week (tests). */
  readonly fetchScoreboardByWeek?: (
    seasonYear: number,
    weekNumber: number,
  ) => Promise<EspnScoreboard>;
}

export interface BackfillScoresResult {
  readonly weeksProcessed: number;
  readonly gamesFound: number;
  readonly gamesUpdated: number;
  readonly gamesStillMissing: number;
  readonly weeks: ReadonlyArray<{
    readonly weekId: string;
    readonly gamesUpdated: number;
    readonly gamesSkipped: number;
    readonly errors: number;
  }>;
}

/**
 * Parse `2025:W11` -> `{ seasonYear: 2025, weekNumber: 11 }`.
 * Retourne null si format invalide.
 */
function parseWeekId(weekId: string): {
  seasonYear: number;
  weekNumber: number;
} | null {
  const m = weekId.match(/^(\d{4}):W(\d{1,2})$/);
  if (!m) return null;
  return { seasonYear: Number(m[1]), weekNumber: Number(m[2]) };
}

/**
 * Identifie les games sans score, regroupe par `weekId` et fetch le
 * scoreboard ESPN par semaine (plus fiable que par date — l'ancien
 * ingest nflverse fixe `kickoffAt = week.startDate` ce qui rend le
 * group-by-date inutilisable).
 *
 * Pour chaque week, fetch `scoreboard?year=Y&seasontype=T&week=N` puis
 * reuse la logique parse + upsert de `ingestEspnGameday` via override
 * `fetchScoreboard`.
 *
 * Idempotent : un game qui a deja un score est juste re-update avec
 * le meme.
 */
export async function backfillMissingScores(
  opts: BackfillScoresOpts = {},
): Promise<BackfillScoresResult> {
  type GameRow = { id: string; weekId: string; seasonId: string };
  const missing = (await prisma.nflGame.findMany({
    where: {
      OR: [{ homeScore: null }, { awayScore: null }],
      ...(opts.seasonId ? { seasonId: opts.seasonId } : {}),
    },
    select: { id: true, weekId: true, seasonId: true },
    orderBy: { weekId: "asc" },
  })) as GameRow[];

  if (missing.length === 0) {
    return {
      weeksProcessed: 0,
      gamesFound: 0,
      gamesUpdated: 0,
      gamesStillMissing: 0,
      weeks: [],
    };
  }

  const weekIds = Array.from(new Set(missing.map((g) => g.weekId))).sort();
  const fetcher = opts.fetchScoreboardByWeek ?? fetchEspnScoreboardByWeekLive;

  const weeks: Array<{
    weekId: string;
    gamesUpdated: number;
    gamesSkipped: number;
    errors: number;
  }> = [];
  let totalGamesUpdated = 0;

  for (const weekId of weekIds) {
    const parsed = parseWeekId(weekId);
    if (!parsed) {
      weeks.push({ weekId, gamesUpdated: 0, gamesSkipped: 0, errors: 1 });
      serverLog.error(`[backfill-scores] weekId invalide: ${weekId}`);
      continue;
    }
    try {
      // Reuse de la logique upsert de ingestEspnGameday via override
      // fetchScoreboard qui retourne notre fetch par-week.
      const r = await ingestEspnGameday({
        dateYmd: weekId, // informational only — logged dans NflIngestRun
        fetchScoreboard: async () =>
          fetcher(parsed.seasonYear, parsed.weekNumber),
      });
      weeks.push({
        weekId,
        gamesUpdated: r.gamesUpdated,
        gamesSkipped: r.gamesSkipped,
        errors: r.errors.length,
      });
      totalGamesUpdated += r.gamesUpdated;
    } catch (e) {
      weeks.push({ weekId, gamesUpdated: 0, gamesSkipped: 0, errors: 1 });
      serverLog.error(
        `[backfill-scores] ${weekId} failed: ${(e as Error).message}`,
      );
    }
  }

  const stillMissing = (await prisma.nflGame.count({
    where: {
      OR: [{ homeScore: null }, { awayScore: null }],
      ...(opts.seasonId ? { seasonId: opts.seasonId } : {}),
    },
  })) as number;

  return {
    weeksProcessed: weeks.length,
    gamesFound: missing.length,
    gamesUpdated: totalGamesUpdated,
    gamesStillMissing: stillMissing,
    weeks,
  };
}

// ────────────────────────────────────────────────────────────────────
// Ingestion rosters
// ────────────────────────────────────────────────────────────────────

export interface IngestEspnRostersOpts {
  readonly seasonId: string;
  /** Sous-ensemble des 32 teams a snapshotter. Default : toutes. */
  readonly teamCodes?: ReadonlyArray<NflTeamCode>;
  /** Override fetch pour les tests. */
  readonly fetchRoster?: (teamCode: string) => Promise<EspnRosterResponse>;
}

export interface IngestEspnRostersResult {
  readonly source: "espn";
  readonly seasonId: string;
  readonly snapshotsCreated: number;
  readonly teamsCovered: number;
  readonly errors: ReadonlyArray<{ context: string; error: string }>;
  readonly ingestRunId: string;
}

/**
 * Pull les rosters ESPN pour `teamCodes` (default 32) et cree un
 * snapshot par equipe dans `NflRosterSnapshot`.
 *
 * Le snapshot est NON-idempotent (chaque appel ajoute une ligne datee),
 * c'est intentionnel : on garde l'historique pour reconstituer les
 * changements de roster semaine apres semaine.
 *
 * @throws NflIngestError si saison introuvable
 */
export async function ingestEspnRosters(
  opts: IngestEspnRostersOpts,
): Promise<IngestEspnRostersResult> {
  const ingestRun = await prisma.nflIngestRun.create({
    data: {
      source: "espn",
      weekId: null,
      status: "in_progress",
      result: { seasonId: opts.seasonId },
    },
  });

  try {
    const season = await prisma.nflSeason.findUnique({
      where: { id: opts.seasonId },
    });
    if (!season) {
      await prisma.nflIngestRun.update({
        where: { id: ingestRun.id },
        data: {
          completedAt: new Date(),
          status: "failed",
          result: {
            seasonId: opts.seasonId,
            error: `NflSeason ${opts.seasonId} introuvable`,
          },
        },
      });
      throw new NflIngestError(
        "SEASON_NOT_FOUND",
        `NflSeason ${opts.seasonId} introuvable - lancer seedNflSeason d'abord`,
      );
    }

    const teamCodes: ReadonlyArray<NflTeamCode> =
      opts.teamCodes ?? (getAllTeams().map((t) => t.code) as NflTeamCode[]);

    const errors: Array<{ context: string; error: string }> = [];
    let snapshotsCreated = 0;

    for (const code of teamCodes) {
      try {
        const espnCode = toEspnTeamCode(code);
        const resp = await (opts.fetchRoster ?? fetchEspnRosterLive)(espnCode);
        const athletes = parseEspnRoster(resp);

        await prisma.nflRosterSnapshot.create({
          data: {
            seasonId: opts.seasonId,
            teamCode: code,
            roster: athletes as unknown as object,
          },
        });
        snapshotsCreated++;
      } catch (e) {
        errors.push({ context: code, error: (e as Error).message });
      }
    }

    await prisma.nflIngestRun.update({
      where: { id: ingestRun.id },
      data: {
        completedAt: new Date(),
        status: errors.length === 0 ? "success" : "partial",
        result: {
          seasonId: opts.seasonId,
          snapshotsCreated,
          teamsCovered: teamCodes.length,
          errors,
        },
      },
    });

    return {
      source: "espn",
      seasonId: opts.seasonId,
      snapshotsCreated,
      teamsCovered: teamCodes.length,
      errors,
      ingestRunId: ingestRun.id,
    };
  } catch (e) {
    if (!(e instanceof NflIngestError) || e.code !== "SEASON_NOT_FOUND") {
      // SEASON_NOT_FOUND a deja update le run; les autres erreurs
      // (fetch fatal exterieur a la boucle per-team) tombent ici.
      await prisma.nflIngestRun.update({
        where: { id: ingestRun.id },
        data: {
          completedAt: new Date(),
          status: "failed",
          result: { seasonId: opts.seasonId, error: (e as Error).message },
        },
      });
    }
    throw e;
  }
}
