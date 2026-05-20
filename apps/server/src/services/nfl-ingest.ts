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

function buildStatLine(
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
 */
export function parseRow(row: NflverseRow): ParsedPlayerRow | null {
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

  const gameId = row.game_id?.trim() ?? "";

  return {
    playerId,
    playerName: row.player_display_name?.trim() || row.player_name?.trim() || playerId,
    teamCode,
    opponentCode,
    gameId,
    nflPosition: row.position ?? "",
    jerseyNumber,
    statLine: buildStatLine(row, bbPosition),
    rawStats: row,
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

/**
 * Cree (idempotent) une NflSeason et ses 22 NflWeek (1-18 REG + 19-22 POST).
 *
 * @param seasonId Format "{yearStart}" ex: "2025" pour la saison 2025-26.
 */
export async function seedNflSeason(seasonId: string): Promise<void> {
  const year = Number(seasonId);
  if (!Number.isInteger(year) || year < 2000) {
    throw new NflIngestError("SEASON_NOT_FOUND", `seasonId invalide: ${seasonId}`);
  }

  // Approximations dates (kickoff regulier 1er jeudi de septembre).
  // Phase 2 — affinage via ingestion ESPN schedules a venir.
  const startDate = new Date(Date.UTC(year, 8, 5)); // 5 septembre
  const endDate = new Date(Date.UTC(year + 1, 1, 15)); // 15 fevrier (post-SB)

  await prisma.nflSeason.upsert({
    where: { id: seasonId },
    update: { startDate, endDate, status: "in_progress" },
    create: { id: seasonId, startDate, endDate, status: "in_progress" },
  });

  for (let w = 1; w <= 22; w++) {
    const weekId = `${seasonId}:W${w}`;
    const isPlayoffs = w >= 19;
    await prisma.nflWeek.upsert({
      where: { id: weekId },
      update: { weekNumber: w, isPlayoffs },
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

interface IngestNflverseOpts {
  readonly seasonId: string;
  readonly weekNumber: number;
  /** Override fetch pour les tests. */
  readonly fetchCsv?: (year: number) => Promise<string>;
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

    for (const row of weekRows) {
      const parsed = parseRow(row);
      if (!parsed) {
        errors.push({ context: row.player_id ?? "(no id)", error: "row invalide" });
        continue;
      }

      try {
        // 1. Upsert le NflGame (idempotent)
        if (!seenGames.has(parsed.gameId) && parsed.gameId && parsed.opponentCode) {
          const isHomeGame = inferHomeAway(row);
          await prisma.nflGame.upsert({
            where: { id: parsed.gameId },
            update: { status: "final" },
            create: {
              id: parsed.gameId,
              seasonId: opts.seasonId,
              weekId,
              homeTeam: isHomeGame ? parsed.teamCode : parsed.opponentCode,
              awayTeam: isHomeGame ? parsed.opponentCode : parsed.teamCode,
              kickoffAt: week.startDate,
              status: "final",
            },
          });
          seenGames.add(parsed.gameId);
        }

        // 2. Upsert NflPlayer (idempotent, pseudo deterministe)
        const team = getTeamMeta(parsed.teamCode);
        const pseudonym = generatePseudonym({
          cityTag: team.city,
          bbPosition: parsed.statLine.bbPosition,
          jerseyNumber: parsed.jerseyNumber ?? 0,
        });
        await prisma.nflPlayer.upsert({
          where: { id: parsed.playerId },
          update: {
            realName: parsed.playerName,
            pseudonym,
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
  const homeCode = parts[parts.length - 1];
  const team = row.team?.trim() ?? "";
  return homeCode === team;
}

// Re-export pour debug/visibilite des constantes utilisees par le service
export const KNOWN_RACES: readonly BbRace[] = BB_RACES;
export type { TeamMeta };
