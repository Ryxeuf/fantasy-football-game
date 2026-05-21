/**
 * Ingest rosters nflverse (Phase 5.A).
 *
 * Source : `https://github.com/nflverse/nflverse-data/releases/download/rosters/roster_{year}.csv`.
 * Un snapshot par saison (mis a jour ~hebdomadaire pendant la saison
 * NFL). Contient pour chaque joueur :
 *   - jersey_number (manque dans stats_player_week)
 *   - full_name, height ("6-2"), weight, college, birth_date
 *   - headshot_url (CDN GitHub stable)
 *   - draft_club, draft_round, draft_number (= overall pick),
 *     entry_year, rookie_year, years_exp
 *
 * Le service upsert `NflPlayer` en ne touchant que les bio fields +
 * jerseyNumber. Idempotent : re-running ne change rien si la donnee
 * est identique. Le pseudonym est regenere avec le vrai jersey pour
 * remplacer le "#0" placeholder.
 *
 * Pour les joueurs non encore dans NflPlayer (jamais joue), le
 * service les CREE quand meme avec status="active" et bbPosition
 * derive (race via NflTeam).
 */

import { parse } from "csv-parse/sync";

import {
  generatePseudonym,
  getBbPosition,
  getTeamMeta,
  type BbRace,
  type NflTeamCode,
} from "@bb/nfl-mapper";

import { prisma } from "../prisma";
import { NflIngestError, normalizeNflverseTeamCode } from "./nfl-ingest";
import { serverLog } from "../utils/server-log";

// ────────────────────────────────────────────────────────────────────
// URL + fetch
// ────────────────────────────────────────────────────────────────────

const NFLVERSE_ROSTERS_BASE =
  "https://github.com/nflverse/nflverse-data/releases/download/rosters";

export function buildNflverseRostersUrl(year: number): string {
  return `${NFLVERSE_ROSTERS_BASE}/roster_${year}.csv`;
}

async function fetchNflverseRostersCsv(year: number): Promise<string> {
  const url = buildNflverseRostersUrl(year);
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new NflIngestError(
      "FETCH_FAILED",
      `nflverse rosters fetch failed ${res.status} ${res.statusText} - ${url}`,
    );
  }
  return res.text();
}

// ────────────────────────────────────────────────────────────────────
// Parsing pur
// ────────────────────────────────────────────────────────────────────

type RawRosterRow = Record<string, string>;

export interface ParsedRoster {
  readonly playerId: string;
  readonly fullName: string;
  readonly teamCode: NflTeamCode | null;
  readonly nflPosition: string;
  readonly jerseyNumber: number | null;
  readonly heightInches: number | null;
  readonly weightLbs: number | null;
  readonly birthDate: Date | null;
  readonly college: string | null;
  readonly headshotUrl: string | null;
  readonly draftYear: number | null;
  readonly draftRound: number | null;
  readonly draftPick: number | null;
  readonly draftClub: string | null;
  readonly rookieYear: number | null;
  readonly yearsExp: number | null;
  readonly status: string;
}

export function parseRostersCsv(csv: string): readonly RawRosterRow[] {
  try {
    return parse(csv, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }) as RawRosterRow[];
  } catch (e) {
    throw new NflIngestError(
      "PARSE_FAILED",
      `Rosters CSV parse failed: ${(e as Error).message}`,
    );
  }
}

/**
 * Parse "6-2" (feet-inches) → 74 inches. Tolere "6'2", "6 2", "6-02".
 * Retourne null si format inconnu ou champ vide.
 */
export function parseHeightToInches(raw: string | undefined): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Match "6-2" / "6'2" / "6 2"
  const m = trimmed.match(/^(\d+)[\s'\-](\d{1,2})$/);
  if (!m) {
    // Peut aussi etre un nombre direct en inches (rare nflverse).
    const n = Number(trimmed);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  }
  const feet = Number(m[1]);
  const inches = Number(m[2]);
  if (!Number.isFinite(feet) || !Number.isFinite(inches)) return null;
  if (feet < 4 || feet > 8 || inches < 0 || inches > 11) return null;
  return feet * 12 + inches;
}

function parseIntOrNull(raw: string | undefined): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && Number.isInteger(n) ? n : null;
}

function parseDateOrNull(raw: string | undefined): Date | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t) return null;
  // nflverse format ISO: "1988-12-19".
  const d = new Date(t);
  return Number.isFinite(d.getTime()) ? d : null;
}

function nonEmpty(raw: string | undefined): string | null {
  if (raw === undefined || raw === null) return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

/**
 * Map une row CSV vers un ParsedRoster. Retourne null si playerId
 * manquant (gsis_id vide). Tolerance sur teamCode invalide (laisse
 * null = FA).
 *
 * Pure : pas d'I/O, deterministe sur la row.
 */
export function parseRosterRow(row: RawRosterRow): ParsedRoster | null {
  const playerId = (row.gsis_id ?? row.player_id ?? "").trim();
  if (!playerId) return null;

  const teamCode = normalizeNflverseTeamCode(row.team ?? "");

  const status = (row.status ?? "ACT").trim().toUpperCase();
  // nflverse status codes : ACT (active), INA (inactive), CUT, PUP,
  // RES (injured reserve), SUS, RET. On normalise sur notre vocabulaire.
  let normalizedStatus = "active";
  if (status === "RES" || status === "PUP") normalizedStatus = "ir";
  else if (status === "RET") normalizedStatus = "retired";
  else if (status === "SUS") normalizedStatus = "suspended";

  return {
    playerId,
    fullName:
      nonEmpty(row.full_name) ??
      nonEmpty(`${row.first_name ?? ""} ${row.last_name ?? ""}`) ??
      playerId,
    teamCode,
    nflPosition: (row.position ?? "").trim().toUpperCase(),
    jerseyNumber: parseIntOrNull(row.jersey_number),
    heightInches: parseHeightToInches(row.height),
    weightLbs: parseIntOrNull(row.weight),
    birthDate: parseDateOrNull(row.birth_date),
    college: nonEmpty(row.college),
    headshotUrl: nonEmpty(row.headshot_url),
    draftYear: parseIntOrNull(row.draft_year ?? row.entry_year),
    draftRound: parseIntOrNull(row.draft_round),
    draftPick: parseIntOrNull(row.draft_number ?? row.draft_pick),
    draftClub: nonEmpty(row.draft_club),
    rookieYear: parseIntOrNull(row.rookie_year),
    yearsExp: parseIntOrNull(row.years_exp),
    status: normalizedStatus,
  };
}

// ────────────────────────────────────────────────────────────────────
// Ingest
// ────────────────────────────────────────────────────────────────────

export interface IngestRostersOpts {
  readonly seasonId: string;
  /** Override fetch (tests). */
  readonly fetchCsv?: (year: number) => Promise<string>;
  /** Callback de progression toutes les N rows (default = jamais). */
  readonly onProgress?: (processed: number, total: number) => void;
}

export interface IngestRostersResult {
  readonly seasonId: string;
  readonly rowsTotal: number;
  readonly playersUpdated: number;
  readonly playersCreated: number;
  readonly playersSkipped: number;
  readonly errors: ReadonlyArray<{ playerId: string; error: string }>;
}

/**
 * Ingest le roster nflverse pour une saison. Upsert NflPlayer en
 * preservant la logique bbPosition/bbStats existante. Met a jour :
 *   - bio (height, weight, birthDate, college, headshotUrl, draft*)
 *   - jerseyNumber (cle essentielle, manquante en stats_player_week)
 *   - status (active/ir/retired/suspended)
 *   - pseudonym regenere avec le vrai jersey
 *
 * Pour les joueurs jamais vus, cree l'entree avec bbPosition derive
 * via getBbPosition(nflPosition, teamRace). Si pas de teamCode, skip.
 *
 * Idempotent : re-running upsert tous, change rien si donnee identique.
 */
export async function ingestNflverseRosters(
  opts: IngestRostersOpts,
): Promise<IngestRostersResult> {
  const year = Number(opts.seasonId);
  if (!Number.isInteger(year)) {
    throw new NflIngestError(
      "PARSE_FAILED",
      `seasonId invalide : ${opts.seasonId}`,
    );
  }

  const csv = await (opts.fetchCsv ?? fetchNflverseRostersCsv)(year);
  const rows = parseRostersCsv(csv);

  let playersUpdated = 0;
  let playersCreated = 0;
  let playersSkipped = 0;
  const errors: Array<{ playerId: string; error: string }> = [];

  // Pre-charge les races par teamCode pour derive bbPosition rapide.
  const teamsCache = new Map<string, BbRace>();
  function getRace(code: string): BbRace {
    const cached = teamsCache.get(code);
    if (cached) return cached;
    const meta = getTeamMeta(code as NflTeamCode);
    teamsCache.set(code, meta.race as BbRace);
    return meta.race as BbRace;
  }

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i]!;
    try {
      const parsed = parseRosterRow(raw);
      if (!parsed) {
        playersSkipped++;
        continue;
      }

      const existing = (await prisma.nflPlayer.findUnique({
        where: { id: parsed.playerId },
        select: { id: true, teamCode: true, bbPosition: true },
      })) as { id: string; teamCode: string | null; bbPosition: string } | null;

      const effectiveTeamCode = parsed.teamCode ?? existing?.teamCode ?? null;
      const bbPosition =
        effectiveTeamCode && parsed.nflPosition
          ? getBbPosition(parsed.nflPosition, getRace(effectiveTeamCode))
          : (existing?.bbPosition ?? "Lineman");

      const cityTag = effectiveTeamCode
        ? getTeamMeta(effectiveTeamCode as NflTeamCode).city
        : "FA";
      const pseudonym = generatePseudonym({
        playerId: parsed.playerId,
        cityTag,
        bbPosition,
        jerseyNumber: parsed.jerseyNumber ?? 0,
      });

      const data = {
        realName: parsed.fullName,
        pseudonym,
        teamCode: parsed.teamCode,
        jerseyNumber: parsed.jerseyNumber,
        nflPosition: parsed.nflPosition,
        bbPosition,
        status: parsed.status,
        heightInches: parsed.heightInches,
        weightLbs: parsed.weightLbs,
        birthDate: parsed.birthDate,
        college: parsed.college,
        headshotUrl: parsed.headshotUrl,
        draftYear: parsed.draftYear,
        draftRound: parsed.draftRound,
        draftPick: parsed.draftPick,
        draftClub: parsed.draftClub,
        rookieYear: parsed.rookieYear,
        yearsExp: parsed.yearsExp,
      };

      if (existing) {
        await prisma.nflPlayer.update({
          where: { id: parsed.playerId },
          data,
        });
        playersUpdated++;
      } else {
        await prisma.nflPlayer.create({
          data: {
            id: parsed.playerId,
            ...data,
            bbStats: {},
            bbSkills: [],
          },
        });
        playersCreated++;
      }
    } catch (e) {
      const playerId = raw.gsis_id ?? raw.player_id ?? "(unknown)";
      const message = (e as Error).message;
      errors.push({ playerId, error: message });
      serverLog.error(
        `[nfl-rosters] upsert failed for ${playerId}: ${message}`,
      );
    }

    if (opts.onProgress && (i + 1) % 100 === 0) {
      opts.onProgress(i + 1, rows.length);
    }
  }

  return {
    seasonId: opts.seasonId,
    rowsTotal: rows.length,
    playersUpdated,
    playersCreated,
    playersSkipped,
    errors,
  };
}
