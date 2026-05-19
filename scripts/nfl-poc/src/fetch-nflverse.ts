import { parse } from "csv-parse/sync";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "..", "fixtures");

const NFLVERSE_RELEASE = "stats_player";

function buildUrl(year: number): string {
  return `https://github.com/nflverse/nflverse-data/releases/download/${NFLVERSE_RELEASE}/stats_player_week_${year}.csv`;
}

function buildCachePath(year: number): string {
  return join(FIXTURES_DIR, `nflverse-stats-player-week-${year}.csv`);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function fetchAndCache(year: number): Promise<string> {
  const url = buildUrl(year);
  const cachePath = buildCachePath(year);

  if (await fileExists(cachePath)) {
    console.log(`[nflverse] cache hit: ${cachePath}`);
    return readFile(cachePath, "utf8");
  }

  console.log(`[nflverse] GET ${url}`);
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`[nflverse] fetch failed ${res.status} ${res.statusText} — url=${url}`);
  }
  const csv = await res.text();
  await mkdir(FIXTURES_DIR, { recursive: true });
  await writeFile(cachePath, csv, "utf8");
  console.log(`[nflverse] cached ${(csv.length / 1024).toFixed(1)} KB to ${cachePath}`);
  return csv;
}

export type NflverseRow = Record<string, string>;

export interface NflverseWeekData {
  readonly year: number;
  readonly week: number;
  readonly rows: readonly NflverseRow[];
  readonly columns: readonly string[];
}

function parseCsv(csv: string): { rows: NflverseRow[]; columns: string[] } {
  const records = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as NflverseRow[];
  const columns = records.length > 0 ? Object.keys(records[0]!) : [];
  return { rows: records, columns };
}

function filterToWeek(rows: readonly NflverseRow[], week: number): NflverseRow[] {
  return rows.filter((r) => Number(r.week) === week);
}

export async function pullNflverseWeek(year: number, week: number): Promise<NflverseWeekData> {
  const csv = await fetchAndCache(year);
  const { rows, columns } = parseCsv(csv);
  const filtered = filterToWeek(rows, week);
  console.log(`[nflverse] ${rows.length} total rows, ${filtered.length} rows for week ${week}`);

  const summary = {
    year,
    week,
    totalRowCount: rows.length,
    weekRowCount: filtered.length,
    columnCount: columns.length,
    columns,
    sampleRow: filtered[0] ?? null,
    positionGroups: countByKey(filtered, "position_group"),
    positions: countByKey(filtered, "position"),
  };
  await mkdir(FIXTURES_DIR, { recursive: true });
  await writeFile(
    join(FIXTURES_DIR, `nflverse-week-${year}-w${week}-summary.json`),
    JSON.stringify(summary, null, 2),
    "utf8"
  );

  return { year, week, rows: filtered, columns };
}

function countByKey(rows: readonly NflverseRow[], key: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of rows) {
    const v = r[key] ?? "(empty)";
    counts[v] = (counts[v] ?? 0) + 1;
  }
  return counts;
}

export async function runNflversePoc(year: number, week: number): Promise<void> {
  console.log(`[nflverse] === pull saison ${year} week ${week} ===`);
  const data = await pullNflverseWeek(year, week);

  console.log(`\n[nflverse] top 10 rows preview:`);
  for (const row of data.rows.slice(0, 10)) {
    const name = row.player_display_name ?? row.player_name ?? row.player_id ?? "?";
    const pos = row.position ?? "?";
    const team = row.team ?? "?";
    console.log(`  - ${name.padEnd(28)} ${pos.padEnd(4)} ${team}`);
  }
  console.log(`\n[nflverse] summary saved to fixtures/nflverse-week-${year}-w${week}-summary.json`);
}
