/**
 * Service d'ingestion NFL Fantasy — Phase 2.A.
 *
 * Charge les donnees nflverse dans les tables `NflPlayer`,
 * `NflGameStat`, `NflGame` decrites dans
 * `docs/nfl-fantasy/10-architecture.md`.
 *
 * Pipeline :
 *
 *   1. `seedNflTeams()` (idempotent) - 32 NflTeam depuis @bb/nfl-mapper
 *   2. `seedNflSeason(seasonId)` - cree la saison + 18+4 NflWeek
 *   3. `ingestNflverseWeek(seasonId, weekNumber)` - pull CSV nflverse,
 *      parse, upsert NflGame + NflPlayer + NflGameStat + computedSpp
 *
 * Pattern Q.D.1 : idempotent. Re-run sur la meme semaine ne duplique
 * pas, met juste a jour les rows si la source a change.
 *
 * Pattern Q.A.2 : audit log NflIngestRun pour tracer chaque pull.
 *
 * Source URL nflverse (cf. POC scripts/nfl-poc/ findings v1.4) :
 *   https://github.com/nflverse/nflverse-data/releases/download/
 *   stats_player/stats_player_week_{year}.csv
 */

import { parse } from "csv-parse/sync";
import {
  BB_RACES,
  computeSpp,
  getAllTeams,
  getBbPosition,
  getTeamMeta,
  generatePseudonym,
  type BbRace,
  type NflPlayerStatLine,
  type NflTeamCode,
  type TeamMeta,
} from "@bb/nfl-mapper";

import { prisma } from "../prisma";
import { seedDefaultCyclesForSeason } from "./nfl-fantasy-season-cycle";

// ────────────────────────────────────────────────────────────────────
// Erreurs typees
// ────────────────────────────────────────────────────────────────────

export class NflIngestError extends Error {
  constructor(
    public readonly code:
      | "FETCH_FAILED"
      | "PARSE_FAILED"
      | "SEASON_NOT_FOUND"
      | "WEEK_NOT_FOUND"
      | "INVALID_WEEK_NUMBER",
    message: string,
  ) {
    super(message);
    this.name = "NflIngestError";
  }
}

// ────────────────────────────────────────────────────────────────────
// Types publics
// ────────────────────────────────────────────────────────────────────

export interface IngestResult {
  readonly source: "nflverse" | "espn";
  readonly seasonId: string;
  readonly weekNumber: number;
  readonly playersUpdated: number;
  readonly statsUpdated: number;
  readonly gamesUpdated: number;
  readonly errors: ReadonlyArray<{ context: string; error: string }>;
  readonly ingestRunId: string;
}

export interface SeedResult {
  readonly teamsCreated: number;
  readonly teamsUpdated: number;
}

// ────────────────────────────────────────────────────────────────────
// nflverse — pull + parse (helpers purs)
// ────────────────────────────────────────────────────────────────────

const NFLVERSE_BASE =
  "https://github.com/nflverse/nflverse-data/releases/download/stats_player";

export function buildNflverseUrl(year: number): string {
  return `${NFLVERSE_BASE}/stats_player_week_${year}.csv`;
}

const NFLVERSE_SCHEDULES_URL =
  "https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv";

export function buildNflverseSchedulesUrl(): string {
  return NFLVERSE_SCHEDULES_URL;
}

/**
 * Une row du CSV nflverse games.csv (autoritative pour home/away +
 * scores + kickoff). Utile en fallback quand `game_id` est absent
 * du CSV player stats (le cas pour la saison 2024 — cf. POC).
 */
export interface ScheduleRow {
  readonly gameId: string;
  readonly season: number;
  readonly week: number;
  readonly seasonType: string;
  readonly homeTeam: string;
  readonly awayTeam: string;
  readonly homeScore: number | null;
  readonly awayScore: number | null;
  readonly kickoffAt: Date | null;
}

/**
 * Decalage UTC de l'heure de New York pour une date "YYYY-MM-DD" :
 * "-04:00" en heure d'ete (2e dimanche de mars -> 1er dimanche de
 * novembre, regle US depuis 2007), "-05:00" sinon. Aucun match NFL ne se
 * joue a 2h du matin, la bascule horaire du jour J est donc sans effet.
 *
 * Pur.
 */
export function easternUtcOffset(gameday: string): "-04:00" | "-05:00" {
  const [y, m, d] = gameday.split("-").map(Number) as [number, number, number];
  const nthSunday = (month: number, n: number): number => {
    const firstDow = new Date(Date.UTC(y, month - 1, 1)).getUTCDay();
    return 1 + ((7 - firstDow) % 7) + (n - 1) * 7;
  };
  const dstStart = nthSunday(3, 2); // jour de mars
  const dstEnd = nthSunday(11, 1); // jour de novembre
  const inDst =
    (m > 3 && m < 11) || (m === 3 && d >= dstStart) || (m === 11 && d < dstEnd);
  return inDst ? "-04:00" : "-05:00";
}

/**
 * gameday "YYYY-MM-DD" + gametime "HH:MM" (heure de New York, parfois
 * vide) -> instant UTC. L'offset etait fige a -05:00 : en septembre-octobre
 * tous les coups d'envoi etaient decales d'une heure trop TARD, ce qui
 * aurait laisse une heure de match pendant laquelle un lineup restait
 * modifiable (verrouillage au coup d'envoi).
 *
 * Pur.
 */
export function parseScheduleDate(gameday: string, gametime: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(gameday)) return null;
  const time = /^\d{2}:\d{2}$/.test(gametime)
    ? gametime
    : /^\d:\d{2}$/.test(gametime)
      ? `0${gametime}`
      : "13:00";
  const d = new Date(`${gameday}T${time}:00${easternUtcOffset(gameday)}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Parse le CSV nflverse `games.csv` en lignes typees. Filtre sur
 * `seasonId` pour limiter la taille de la Map en aval (~270 games/an).
 *
 * Pure : pas d'I/O, deterministe.
 */
export function parseSchedulesCsv(
  csv: string,
  seasonId: string,
): readonly ScheduleRow[] {
  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as Array<Record<string, string>>;

  const out: ScheduleRow[] = [];
  for (const r of rows) {
    if ((r.season ?? "") !== seasonId) continue;
    const home = normalizeNflverseTeamCode(r.home_team ?? "");
    const away = normalizeNflverseTeamCode(r.away_team ?? "");
    if (!home || !away) continue;
    const week = Number(r.week);
    if (!Number.isInteger(week) || week < 1) continue;
    const homeScore = r.home_score === "" ? null : Number(r.home_score);
    const awayScore = r.away_score === "" ? null : Number(r.away_score);
    const gameType = r.game_type ?? "";
    const seasonType = gameType.startsWith("POST") || ["WC", "DIV", "CON", "SB"].includes(gameType) ? "POST" : "REG";
    out.push({
      gameId: r.game_id ?? "",
      season: Number(r.season),
      week,
      seasonType,
      homeTeam: home,
      awayTeam: away,
      homeScore: Number.isFinite(homeScore as number) ? (homeScore as number) : null,
      awayScore: Number.isFinite(awayScore as number) ? (awayScore as number) : null,
      kickoffAt: parseScheduleDate(r.gameday ?? "", r.gametime ?? ""),
    });
  }
  return out;
}

/**
 * Reconstruit un game_id deterministe au format nflverse
 * `YYYY_WW_AWAY_HOME` a partir d'une ScheduleRow.
 *
 * Equivaut au game_id natif quand il est present, sert de fallback
 * pour les CSV qui ne l'incluent pas (saison 2024).
 *
 * Pur.
 */
export function reconstructGameId(s: ScheduleRow): string {
  const ww = String(s.week).padStart(2, "0");
  return `${s.season}_${ww}_${s.awayTeam}_${s.homeTeam}`;
}

/**
 * Index Map<"{season}:{week}:{teamA}:{teamB}", ScheduleRow> ou (teamA,
 * teamB) est trie alphabetiquement pour gerer le lookup symetrique
 * (peu importe quel cote on regarde, on retrouve le meme match).
 *
 * Pur.
 */
export function buildScheduleLookup(
  rows: readonly ScheduleRow[],
): ReadonlyMap<string, ScheduleRow> {
  const map = new Map<string, ScheduleRow>();
  for (const s of rows) {
    const [a, b] = [s.homeTeam, s.awayTeam].sort();
    const key = `${s.season}:${s.week}:${a}:${b}`;
    map.set(key, s);
  }
  return map;
}

export function lookupSchedule(
  map: ReadonlyMap<string, ScheduleRow>,
  season: string | number,
  week: number,
  teamA: string,
  teamB: string,
): ScheduleRow | null {
  const [a, b] = [teamA, teamB].sort();
  return map.get(`${season}:${week}:${a}:${b}`) ?? null;
}

export type NflverseRow = Record<string, string>;

/**
 * Parse le CSV brut nflverse en rows. Le format est unifie (115 colonnes)
 * couvrant offense + defense + ST (cf. 03-api-strategy.md gotchas).
 *
 * Pure : pas d'I/O, deterministe.
 */
export function parseNflverseCsv(csv: string): readonly NflverseRow[] {
  try {
    return parse(csv, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }) as NflverseRow[];
  } catch (e) {
    throw new NflIngestError("PARSE_FAILED", `CSV parse failed: ${(e as Error).message}`);
  }
}

/**
 * Filtre les rows d'une semaine specifique. Filtre AUSSI sur season_type
 * pour eviter de melanger preseason/regular/post (gotcha POC).
 *
 * @param weekNumber 1-22 (1-18 REG, 19-22 POST)
 */
export function filterRowsForWeek(
  rows: readonly NflverseRow[],
  weekNumber: number,
): readonly NflverseRow[] {
  const expectedSeasonType = weekNumber >= 19 ? "POST" : "REG";
  return rows.filter(
    (r) => Number(r.week) === weekNumber && r.season_type === expectedSeasonType,
  );
}

/**
 * nflverse uses some team codes that don't match ESPN (ex: nflverse LA,
 * ESPN LAR). Cette fonction normalise vers le code utilise par
 * @bb/nfl-mapper (aligne sur nflverse).
 */
export function normalizeNflverseTeamCode(raw: string): NflTeamCode | null {
  const upper = raw.trim().toUpperCase();
  // Le mapping @bb/nfl-mapper accepte directement les codes nflverse.
  // On valide juste l'existence en consultant la table.
  const allCodes = new Set(getAllTeams().map((t) => t.code));
  if (allCodes.has(upper as NflTeamCode)) {
    return upper as NflTeamCode;
  }
  // Aliases connus :
  if (upper === "LA") return "LAR"; // nflverse legacy avant disambiguation
  return null;
}

/**
 * Normalise un game_id nflverse au format "YYYY_WW_AWAY_HOME" :
 * applique `normalizeNflverseTeamCode` aux deux codes equipe pour eviter
 * les divergences legacy (ex: "2025_10_LA_SF" -> "2025_10_LAR_SF").
 *
 * Important pour la coherence avec ESPN qui emet toujours "LAR".
 *
 * Pur. Retourne raw inchange si le format est inattendu.
 */
export function normalizeNflverseGameId(raw: string): string {
  const parts = raw.split("_");
  if (parts.length !== 4) return raw;
  const [year, week, away, home] = parts;
  if (!year || !week || !away || !home) return raw;
  const awayNorm = normalizeNflverseTeamCode(away) ?? away;
  const homeNorm = normalizeNflverseTeamCode(home) ?? home;
  return `${year}_${week}_${awayNorm}_${homeNorm}`;
}

interface ParsedPlayerRow {
  readonly playerId: string;
  readonly playerName: string;
  readonly teamCode: NflTeamCode;
  readonly opponentCode: NflTeamCode | null;
  readonly gameId: string;
  readonly nflPosition: string;
  readonly jerseyNumber: number | null;
  readonly statLine: NflPlayerStatLine;
  readonly rawStats: Record<string, string>;
}

function num(raw: string | undefined): number {
  if (raw === undefined || raw === "" || raw === "NA") return 0;
  const v = Number(raw);
  return Number.isFinite(v) ? v : 0;
}

/**
 * Construit une NflPlayerStatLine depuis une row CSV nflverse + une
 * bbPosition deja resolue. Pur, deterministe.
 *
 * Expose pour reutilisation par `recomputePlayerSpp` (Phase 3.C).
 */
export function buildStatLineFromRow(
  row: NflverseRow,
  bbPosition: ReturnType<typeof getBbPosition>,
): NflPlayerStatLine {
  return {
    position: row.position,
    bbPosition,
    passYards: num(row.passing_yards),
    passTd: num(row.passing_tds),
    passInt: num(row.passing_interceptions),
    passComp: num(row.completions),
    passAtt: num(row.attempts),
    rushYards: num(row.rushing_yards),
    rushTd: num(row.rushing_tds),
    rushAtt: num(row.carries),
    fumbleLost: num(row.rushing_fumbles_lost) + num(row.receiving_fumbles_lost),
    recYards: num(row.receiving_yards),
    receptions: num(row.receptions),
    recTd: num(row.receiving_tds),
    tackles: num(row.def_tackles_solo) + num(row.def_tackle_assists),
    sacks: num(row.def_sacks),
    tfl: num(row.def_tackles_for_loss),
    qbHits: num(row.def_qb_hits),
    defInt: num(row.def_interceptions),
    passDefended: num(row.def_pass_defended),
    forcedFumble: num(row.def_fumbles_forced),
    fumbleRecovery: num(row.fumble_recovery_own) + num(row.fumble_recovery_opp),
    defTd: num(row.def_tds),
  };
}

/**
 * Parse une row CSV nflverse vers la structure intermediaire prete pour
 * upsert. Skippe les rows invalides (pas de player_id, team inconnue,
 * position_group vide cf. gotcha POC) en retournant null.
 *
 * @param schedules Map optionnelle (cf. buildScheduleLookup) utilisee
 *   pour reconstruire `gameId` quand la row ne contient pas `game_id`
 *   (cas saison 2024 — nflverse a drop la colonne).
 */
export function parseRow(
  row: NflverseRow,
  schedules?: ReadonlyMap<string, ScheduleRow>,
): ParsedPlayerRow | null {
  const playerId = row.player_id?.trim();
  if (!playerId) return null;

  const teamCode = normalizeNflverseTeamCode(row.team ?? "");
  if (!teamCode) return null;

  const opponentCode = normalizeNflverseTeamCode(row.opponent_team ?? "");
  const team = getTeamMeta(teamCode);
  const bbPosition = getBbPosition(row.position ?? "", team.race);

  // jersey number : nflverse ne fournit pas ce champ dans stats_player_week.
  // On le remplira via ingestRosters separement. Pour V1, null.
  const jerseyNumber = null;

  let gameId = normalizeNflverseGameId(row.game_id?.trim() ?? "");
  if (!gameId && schedules && opponentCode) {
    const week = Number(row.week);
    if (Number.isInteger(week) && week > 0) {
      const sched = lookupSchedule(
        schedules,
        row.season ?? "",
        week,
        teamCode,
        opponentCode,
      );
      if (sched) gameId = reconstructGameId(sched);
    }
  }

  return {
    playerId,
    playerName: row.player_display_name?.trim() || row.player_name?.trim() || playerId,
    teamCode,
    opponentCode,
    gameId,
    nflPosition: row.position ?? "",
    jerseyNumber,
    statLine: buildStatLineFromRow(row, bbPosition),
    rawStats: row,
  };
}

// ────────────────────────────────────────────────────────────────────
// Backfill scores depuis nflverse schedules.csv (Phase 5.B+)
// ────────────────────────────────────────────────────────────────────

export interface BackfillSchedulesScoresOpts {
  readonly seasonId: string;
  /**
   * Cree aussi les matchs pas encore en base (statut "scheduled"), avec
   * leur vrai coup d'envoi. Sans ca, un match n'existe qu'une fois joue
   * (ingest nflverse le lendemain, ESPN le jour J) et le verrouillage des
   * lineups au coup d'envoi ne connait pas les matchs a venir.
   */
  readonly createMissing?: boolean;
  /** Override fetch pour les tests. */
  readonly fetchSchedulesCsv?: () => Promise<string>;
}

export interface BackfillSchedulesScoresResult {
  readonly seasonId: string;
  readonly schedulesRows: number;
  readonly scoresUpdated: number;
  readonly kickoffsUpdated: number;
  readonly notInDb: number;
  readonly gamesCreated: number;
}

/**
 * Backfill `homeScore`/`awayScore`/`kickoffAt` directement depuis
 * nflverse `games.csv`. Plus fiable que ESPN pour les saisons
 * historiques (ESPN ignore `?year=X` et retourne la saison courante).
 *
 * Met aussi a jour `kickoffAt` (l'ancien ingest fixait W startDate
 * pour tous les games sans vrai schedule lookup).
 *
 * Idempotent : update seulement si score/kickoff differe.
 */
export async function backfillScoresFromSchedules(
  opts: BackfillSchedulesScoresOpts,
): Promise<BackfillSchedulesScoresResult> {
  const csv = await (opts.fetchSchedulesCsv ?? fetchNflverseSchedulesCsv)();
  const rows = parseSchedulesCsv(csv, opts.seasonId);

  let scoresUpdated = 0;
  let kickoffsUpdated = 0;
  let notInDb = 0;
  let gamesCreated = 0;
  const knownWeekIds = opts.createMissing
    ? new Set(
        (
          (await prisma.nflWeek.findMany({
            where: { seasonId: opts.seasonId },
            select: { id: true },
          })) as Array<{ id: string }>
        ).map((w) => w.id),
      )
    : new Set<string>();

  for (const sched of rows) {
    if (!sched.gameId) continue;
    const gameId = normalizeNflverseGameId(sched.gameId);
    const existing = (await prisma.nflGame.findUnique({
      where: { id: gameId },
      select: { homeScore: true, awayScore: true, kickoffAt: true },
    })) as {
      homeScore: number | null;
      awayScore: number | null;
      kickoffAt: Date;
    } | null;

    if (!existing) {
      const weekId = `${opts.seasonId}:W${sched.week}`;
      if (opts.createMissing && sched.kickoffAt && knownWeekIds.has(weekId)) {
        const hasScore = sched.homeScore !== null && sched.awayScore !== null;
        await prisma.nflGame.create({
          data: {
            id: gameId,
            seasonId: opts.seasonId,
            weekId,
            homeTeam: sched.homeTeam,
            awayTeam: sched.awayTeam,
            homeScore: sched.homeScore,
            awayScore: sched.awayScore,
            kickoffAt: sched.kickoffAt,
            status: hasScore ? "final" : "scheduled",
          },
        });
        gamesCreated++;
      } else {
        notInDb++;
      }
      continue;
    }

    const wantScore =
      sched.homeScore !== null &&
      sched.awayScore !== null &&
      (existing.homeScore !== sched.homeScore ||
        existing.awayScore !== sched.awayScore);
    const wantKickoff =
      sched.kickoffAt !== null &&
      Math.abs(existing.kickoffAt.getTime() - sched.kickoffAt.getTime()) >
        60_000; // 1 min tolerance

    if (!wantScore && !wantKickoff) continue;

    const data: {
      homeScore?: number;
      awayScore?: number;
      kickoffAt?: Date;
    } = {};
    if (wantScore) {
      data.homeScore = sched.homeScore as number;
      data.awayScore = sched.awayScore as number;
    }
    if (wantKickoff) {
      data.kickoffAt = sched.kickoffAt as Date;
    }
    await prisma.nflGame.update({ where: { id: gameId }, data });
    if (wantScore) scoresUpdated++;
    if (wantKickoff) kickoffsUpdated++;
  }

  return {
    seasonId: opts.seasonId,
    schedulesRows: rows.length,
    scoresUpdated,
    kickoffsUpdated,
    notInDb,
    gamesCreated,
  };
}

// ────────────────────────────────────────────────────────────────────
// Seed referentiel
// ────────────────────────────────────────────────────────────────────

/**
 * Seed les 32 NflTeam depuis @bb/nfl-mapper. Idempotent (upsert).
 */
export async function seedNflTeams(): Promise<SeedResult> {
  let created = 0;
  let updated = 0;
  for (const team of getAllTeams()) {
    const existing = await prisma.nflTeam.findUnique({ where: { code: team.code } });
    await prisma.nflTeam.upsert({
      where: { code: team.code },
      update: {
        city: team.city,
        bbRace: team.race,
        raceLabel: team.raceLabel,
      },
      create: {
        code: team.code,
        city: team.city,
        bbRace: team.race,
        raceLabel: team.raceLabel,
      },
    });
    if (existing) updated++;
    else created++;
  }
  return { teamsCreated: created, teamsUpdated: updated };
}

const DAY_MS = 24 * 3600 * 1000;
const WEEK_MS = 7 * DAY_MS;

/**
 * Heure UTC de bascule d'une week a la suivante, le mardi. 10h UTC = 6h ET :
 * le Monday Night (coup d'envoi 00h15 UTC mardi) est termine, aucun match
 * du mardi n'a commence.
 */
const WEEK_ROLLOVER_HOUR_UTC = 10;

export interface NflWeekWindow {
  readonly weekNumber: number;
  readonly startDate: Date;
  readonly endDate: Date;
  readonly isPlayoffs: boolean;
}

export interface NflSeasonWindows {
  readonly seasonStart: Date;
  readonly seasonEnd: Date;
  readonly weeks: readonly NflWeekWindow[];
}

/**
 * Fenetres des 22 weeks d'une saison NFL (1-18 REG, 19-22 POST). Pur.
 *
 * La saison reguliere demarre toujours dans la foulee du Labor Day
 * (1er lundi de septembre) et chaque week court du jeudi au lundi : on
 * ancre donc la W1 au mardi qui suit le Labor Day et on enchaine des
 * fenetres mardi -> mardi. Verifie contre nflverse `games.csv` sur
 * 2021-2026 : seul le Super Bowl (deux semaines apres les finales de
 * conference) sort d'une fenetre de 7 jours, d'ou une W22 etiree jusqu'a
 * la fin de saison.
 *
 * Avant : ancrage fixe au 5 septembre, un samedi en 2026 => 247 matchs REG
 * sur 272 hors de leur fenetre, et le cron visait la mauvaise week.
 */
export function computeNflSeasonWindows(year: number): NflSeasonWindows {
  const laborDayOffset = (8 - new Date(Date.UTC(year, 8, 1)).getUTCDay()) % 7;
  const seasonStart = new Date(
    Date.UTC(year, 8, 1 + laborDayOffset + 1, WEEK_ROLLOVER_HOUR_UTC),
  );
  const seasonEnd = new Date(Date.UTC(year + 1, 1, 20)); // apres le Super Bowl

  const weeks: NflWeekWindow[] = [];
  for (let w = 1; w <= 22; w++) {
    const startDate = new Date(seasonStart.getTime() + (w - 1) * WEEK_MS);
    const endDate =
      w === 22 ? seasonEnd : new Date(startDate.getTime() + WEEK_MS);
    weeks.push({ weekNumber: w, startDate, endDate, isPlayoffs: w >= 19 });
  }
  return { seasonStart, seasonEnd, weeks };
}

/**
 * Cree (idempotent) une NflSeason et ses 22 NflWeek (1-18 REG + 19-22 POST).
 * Re-executer le seed reecrit les fenetres (cf. `computeNflSeasonWindows`).
 *
 * @param seasonId Format "{yearStart}" ex: "2025" pour la saison 2025-26.
 */
export async function seedNflSeason(seasonId: string): Promise<void> {
  const year = Number(seasonId);
  if (!Number.isInteger(year) || year < 2000) {
    throw new NflIngestError("SEASON_NOT_FOUND", `seasonId invalide: ${seasonId}`);
  }

  const { seasonStart, seasonEnd, weeks } = computeNflSeasonWindows(year);

  await prisma.nflSeason.upsert({
    where: { id: seasonId },
    update: { startDate: seasonStart, endDate: seasonEnd, status: "in_progress" },
    create: {
      id: seasonId,
      startDate: seasonStart,
      endDate: seasonEnd,
      status: "in_progress",
    },
  });

  // Fenetres contigues : necessaire pour que findWeekNumberAt (cycles
  // Nuffle Coach) et findCurrentNflWeek (cron) mappent une date a une
  // semaine sans ambiguite.
  for (const { weekNumber: w, startDate, endDate, isPlayoffs } of weeks) {
    const weekId = `${seasonId}:W${w}`;
    await prisma.nflWeek.upsert({
      where: { id: weekId },
      update: {
        weekNumber: w,
        isPlayoffs,
        startDate,
        endDate,
      },
      create: {
        id: weekId,
        seasonId,
        weekNumber: w,
        startDate,
        endDate,
        isPlayoffs,
      },
    });
  }

  // Cycles Nuffle Coach : 3 reguliers (6 sem) + 1 playoffs (4 sem).
  // Idempotent (upsert), donc safe a chaque re-execution du seed.
  await seedDefaultCyclesForSeason(seasonId);
}

// ────────────────────────────────────────────────────────────────────
// Ingestion principale nflverse
// ────────────────────────────────────────────────────────────────────

/**
 * Pull le CSV nflverse pour une saison (cache HTTP cote nflverse + GitHub).
 */
async function fetchNflverseSeasonCsv(year: number): Promise<string> {
  const url = buildNflverseUrl(year);
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new NflIngestError(
      "FETCH_FAILED",
      `nflverse fetch failed ${res.status} ${res.statusText} - ${url}`,
    );
  }
  return res.text();
}

/**
 * Pull le CSV nflverse games.csv (autoritative pour home/away + scores).
 * Utilise en fallback quand le CSV player stats ne contient pas
 * `game_id` (cas 2024).
 */
async function fetchNflverseSchedulesCsv(): Promise<string> {
  const url = buildNflverseSchedulesUrl();
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new NflIngestError(
      "FETCH_FAILED",
      `nflverse schedules fetch failed ${res.status} ${res.statusText} - ${url}`,
    );
  }
  return res.text();
}

interface IngestNflverseOpts {
  readonly seasonId: string;
  readonly weekNumber: number;
  /** Override fetch pour les tests. */
  readonly fetchCsv?: (year: number) => Promise<string>;
  /** Override fetch schedules pour les tests (CSV games.csv). */
  readonly fetchSchedulesCsv?: () => Promise<string>;
  /**
   * Pour le backfill bulk : passe une lookup deja construite pour
   * eviter de re-fetcher schedules.csv 22 fois.
   */
  readonly schedulesLookup?: ReadonlyMap<string, ScheduleRow>;
}

/**
 * Ingestion principale : pull une semaine nflverse, upsert NflGame +
 * NflPlayer + NflGameStat + computedSpp.
 *
 * Idempotent : re-run sur meme (seasonId, weekNumber) met a jour les rows
 * sans dupliquer.
 *
 * @throws NflIngestError sur fetch/parse/season errors
 */
export async function ingestNflverseWeek(
  opts: IngestNflverseOpts,
): Promise<IngestResult> {
  if (!Number.isInteger(opts.weekNumber) || opts.weekNumber < 1 || opts.weekNumber > 22) {
    throw new NflIngestError(
      "INVALID_WEEK_NUMBER",
      `weekNumber doit etre 1-22, recu ${opts.weekNumber}`,
    );
  }

  const ingestRun = await prisma.nflIngestRun.create({
    data: {
      source: "nflverse",
      weekId: `${opts.seasonId}:W${opts.weekNumber}`,
      status: "in_progress",
      result: {},
    },
  });

  const errors: Array<{ context: string; error: string }> = [];
  const year = Number(opts.seasonId);
  let playersUpdated = 0;
  let statsUpdated = 0;
  const seenGames = new Set<string>();

  try {
    const csv = await (opts.fetchCsv ?? fetchNflverseSeasonCsv)(year);
    const allRows = parseNflverseCsv(csv);
    const weekRows = filterRowsForWeek(allRows, opts.weekNumber);

    const weekId = `${opts.seasonId}:W${opts.weekNumber}`;
    const week = await prisma.nflWeek.findUnique({ where: { id: weekId } });
    if (!week) {
      throw new NflIngestError(
        "WEEK_NOT_FOUND",
        `NflWeek ${weekId} introuvable - lancer seedNflSeason d'abord`,
      );
    }

    // Schedules fallback : utilise pour reconstituer game_id quand
    // le CSV player stats ne le contient pas (cas 2024).
    let schedulesLookup: ReadonlyMap<string, ScheduleRow> | undefined =
      opts.schedulesLookup;
    if (!schedulesLookup) {
      const needsFallback = weekRows.some(
        (r) => !(r.game_id?.trim() ?? ""),
      );
      if (needsFallback) {
        const schedulesCsv = await (
          opts.fetchSchedulesCsv ?? fetchNflverseSchedulesCsv
        )();
        const schedules = parseSchedulesCsv(schedulesCsv, opts.seasonId);
        schedulesLookup = buildScheduleLookup(schedules);
      }
    }

    for (const row of weekRows) {
      const parsed = parseRow(row, schedulesLookup);
      if (!parsed) {
        errors.push({ context: row.player_id ?? "(no id)", error: "row invalide" });
        continue;
      }

      try {
        // 1. Upsert le NflGame (idempotent). Source de verite home/away :
        //    schedules.csv quand dispo (lookup), sinon parsing du
        //    game_id natif via inferHomeAway.
        if (!seenGames.has(parsed.gameId) && parsed.gameId && parsed.opponentCode) {
          const sched = schedulesLookup
            ? lookupSchedule(
                schedulesLookup,
                opts.seasonId,
                opts.weekNumber,
                parsed.teamCode,
                parsed.opponentCode,
              )
            : null;
          const isHomeGame = sched
            ? sched.homeTeam === parsed.teamCode
            : inferHomeAway(row);
          await prisma.nflGame.upsert({
            where: { id: parsed.gameId },
            update: { status: "final" },
            create: {
              id: parsed.gameId,
              seasonId: opts.seasonId,
              weekId,
              homeTeam: isHomeGame ? parsed.teamCode : parsed.opponentCode,
              awayTeam: isHomeGame ? parsed.opponentCode : parsed.teamCode,
              kickoffAt: sched?.kickoffAt ?? week.startDate,
              status: "final",
            },
          });
          seenGames.add(parsed.gameId);
        }

        // 2. Upsert NflPlayer (idempotent).
        //
        // ATTENTION : l'ingest stats N'A PAS le jersey (stats CSV
        // nflverse n'expose pas cette colonne). Si on regenere le
        // pseudonym ici avec jersey=0, on ECRASE celui calcule par
        // l'ingest rosters qui, lui, connait le bon jersey.
        // → Le pseudonym n'est ecrit qu'en `create` (avec jersey=null
        //   en fallback ; l'ingest rosters le corrigera au prochain
        //   passage). En `update`, on touche pas au pseudonym.
        const team = getTeamMeta(parsed.teamCode);
        const pseudonym = generatePseudonym({
          playerId: parsed.playerId,
          cityTag: team.city,
          bbPosition: parsed.statLine.bbPosition,
          jerseyNumber: parsed.jerseyNumber ?? 0,
        });
        await prisma.nflPlayer.upsert({
          where: { id: parsed.playerId },
          update: {
            realName: parsed.playerName,
            teamCode: parsed.teamCode,
            nflPosition: parsed.nflPosition,
            bbPosition: parsed.statLine.bbPosition,
          },
          create: {
            id: parsed.playerId,
            realName: parsed.playerName,
            pseudonym,
            teamCode: parsed.teamCode,
            jerseyNumber: parsed.jerseyNumber,
            nflPosition: parsed.nflPosition,
            bbPosition: parsed.statLine.bbPosition,
            bbStats: {},
            bbSkills: [],
            status: "active",
          },
        });
        playersUpdated++;

        // 3. Upsert NflGameStat avec computedSpp (idempotent via unique
        //    constraint gameId+playerId)
        if (parsed.gameId) {
          const breakdown = computeSpp(parsed.statLine);
          await prisma.nflGameStat.upsert({
            where: {
              gameId_playerId: { gameId: parsed.gameId, playerId: parsed.playerId },
            },
            update: {
              rawStats: parsed.rawStats,
              computedSpp: breakdown.totalSpp,
              sppBreakdown: { events: breakdown.events, totalSpp: breakdown.totalSpp },
              ingestSource: "nflverse",
            },
            create: {
              gameId: parsed.gameId,
              playerId: parsed.playerId,
              rawStats: parsed.rawStats,
              computedSpp: breakdown.totalSpp,
              sppBreakdown: { events: breakdown.events, totalSpp: breakdown.totalSpp },
              ingestSource: "nflverse",
            },
          });
          statsUpdated++;
        }
      } catch (e) {
        errors.push({ context: parsed.playerId, error: (e as Error).message });
      }
    }

    await prisma.nflIngestRun.update({
      where: { id: ingestRun.id },
      data: {
        completedAt: new Date(),
        status: errors.length === 0 ? "success" : "partial",
        result: {
          playersUpdated,
          statsUpdated,
          gamesUpdated: seenGames.size,
          errors,
        },
      },
    });

    return {
      source: "nflverse",
      seasonId: opts.seasonId,
      weekNumber: opts.weekNumber,
      playersUpdated,
      statsUpdated,
      gamesUpdated: seenGames.size,
      errors,
      ingestRunId: ingestRun.id,
    };
  } catch (e) {
    await prisma.nflIngestRun.update({
      where: { id: ingestRun.id },
      data: {
        completedAt: new Date(),
        status: "failed",
        result: { error: (e as Error).message, playersUpdated, statsUpdated },
      },
    });
    throw e;
  }
}

// ────────────────────────────────────────────────────────────────────
// Backfill saison complete (Phase 3.E)
// ────────────────────────────────────────────────────────────────────

export interface BackfillSeasonOpts {
  readonly seasonId: string;
  /** Default 1. */
  readonly fromWeek?: number;
  /** Default 22 (inclut playoffs W19-22). */
  readonly toWeek?: number;
  /** Si true (default), skip les weeks deja ingerees avec succes. */
  readonly skipExisting?: boolean;
  /** Callback de progression appele apres chaque week (succes ou skip). */
  readonly onProgress?: (
    weekNumber: number,
    status: "ingested" | "skipped" | "failed",
    result?: IngestResult,
    error?: string,
  ) => void;
  /** Override fetch player stats CSV (tests). */
  readonly fetchCsv?: (year: number) => Promise<string>;
  /** Override fetch schedules CSV (tests). */
  readonly fetchSchedulesCsv?: () => Promise<string>;
}

export interface BackfillSeasonResult {
  readonly seasonId: string;
  readonly weeksProcessed: number;
  readonly weeksSkipped: number;
  readonly weeksFailed: number;
  readonly totalPlayers: number;
  readonly totalStats: number;
  readonly totalGames: number;
  readonly errors: ReadonlyArray<{ weekNumber: number; error: string }>;
}

/**
 * Backfill complet d'une saison nflverse :
 *   1. seedNflSeason (idempotent)
 *   2. fetch CSV une seule fois (cache en memoire pour les N weeks)
 *   3. boucle fromWeek..toWeek en appelant ingestNflverseWeek avec
 *      fetchCsv injecte pour reutiliser le CSV mis en cache.
 *
 * Idempotent : si `skipExisting=true` (default) et qu'une
 * `NflIngestRun(source=nflverse, weekId=YYYY:Wn, status in [success, partial])`
 * existe deja, la week est skippee. "partial" est equivalent (les row-level
 * errors ne se corrigent pas en re-running).
 *
 * Utilise par `scripts/backfill-past-seasons.ts` pour seed les saisons
 * 2023+2024 avant la mise en ligne. Tests unitaires dans
 * `nfl-ingest.test.ts`. Phase 3.E.
 */
export async function backfillNflSeason(
  opts: BackfillSeasonOpts,
): Promise<BackfillSeasonResult> {
  const from = opts.fromWeek ?? 1;
  const to = opts.toWeek ?? 22;
  const skipExisting = opts.skipExisting ?? true;

  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to > 22 || from > to) {
    throw new NflIngestError(
      "INVALID_WEEK_NUMBER",
      `range invalide [${from}, ${to}], attendu 1..22 avec from <= to`,
    );
  }

  await seedNflSeason(opts.seasonId);

  const year = Number(opts.seasonId);
  const csvText = await (opts.fetchCsv ?? fetchNflverseSeasonCsv)(year);
  const cachedFetch = (): Promise<string> => Promise.resolve(csvText);

  // Schedules lookup pre-construit (1 seul fetch pour les N weeks).
  // Si la saison a `game_id` dans le CSV player stats (cas 2023/2025),
  // le lookup sert quand meme de source-of-truth home/away.
  const schedulesCsv = await (opts.fetchSchedulesCsv ?? fetchNflverseSchedulesCsv)();
  const schedules = parseSchedulesCsv(schedulesCsv, opts.seasonId);
  const schedulesLookup = buildScheduleLookup(schedules);

  let weeksProcessed = 0;
  let weeksSkipped = 0;
  let weeksFailed = 0;
  let totalPlayers = 0;
  let totalStats = 0;
  let totalGames = 0;
  const errors: Array<{ weekNumber: number; error: string }> = [];

  for (let w = from; w <= to; w++) {
    const weekId = `${opts.seasonId}:W${w}`;

    if (skipExisting) {
      // "partial" est aussi considere comme deja-ingere : les erreurs
      // sont des row-level invalid (header vide, position_group absent)
      // que re-run ne corrigera pas. Voir docs/nfl-fantasy/11.
      const prev = await prisma.nflIngestRun.findFirst({
        where: {
          source: "nflverse",
          weekId,
          status: { in: ["success", "partial"] },
        },
        orderBy: { startedAt: "desc" },
      });
      if (prev) {
        weeksSkipped++;
        opts.onProgress?.(w, "skipped");
        continue;
      }
    }

    try {
      const res = await ingestNflverseWeek({
        seasonId: opts.seasonId,
        weekNumber: w,
        fetchCsv: cachedFetch,
        schedulesLookup,
      });
      weeksProcessed++;
      totalPlayers += res.playersUpdated;
      totalStats += res.statsUpdated;
      totalGames += res.gamesUpdated;
      opts.onProgress?.(w, "ingested", res);
    } catch (e) {
      const msg = (e as Error).message;
      weeksFailed++;
      errors.push({ weekNumber: w, error: msg });
      opts.onProgress?.(w, "failed", undefined, msg);
    }
  }

  return {
    seasonId: opts.seasonId,
    weeksProcessed,
    weeksSkipped,
    weeksFailed,
    totalPlayers,
    totalStats,
    totalGames,
    errors,
  };
}

/**
 * Heuristique home/away depuis une row nflverse. La col `home_team` n'est
 * pas dans stats_player_week (qui est player-centric). Approche : on
 * compare `team` et `opponent_team` au game_id qui contient les codes.
 *
 * Format game_id nflverse : "{YYYY}_{WW}_{AWAY}_{HOME}" (ex: "2025_10_ATL_IND").
 */
function inferHomeAway(row: NflverseRow): boolean {
  const gameId = row.game_id?.trim() ?? "";
  const parts = gameId.split("_");
  if (parts.length < 4) return true; // fallback raisonnable
  const homeCode = normalizeNflverseTeamCode(parts[parts.length - 1] ?? "");
  const team = normalizeNflverseTeamCode(row.team?.trim() ?? "");
  return homeCode !== null && homeCode === team;
}

// Re-export pour debug/visibilite des constantes utilisees par le service
export const KNOWN_RACES: readonly BbRace[] = BB_RACES;
export type { TeamMeta };
