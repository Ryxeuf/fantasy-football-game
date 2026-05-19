import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { NflverseRow, NflverseWeekData } from "./fetch-nflverse.js";
import { pullNflverseWeek } from "./fetch-nflverse.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "..", "fixtures");

export interface StatLineCommon {
  readonly playerId: string;
  readonly playerName: string;
  readonly team: string;
  readonly opponent: string;
  readonly position: string;
  readonly positionGroup: string;
  readonly season: number;
  readonly week: number;
}

export interface PassingStats {
  readonly completions: number;
  readonly attempts: number;
  readonly passingYards: number;
  readonly passingTds: number;
  readonly interceptions: number;
  readonly sacksSuffered: number;
}

export interface RushingStats {
  readonly carries: number;
  readonly rushingYards: number;
  readonly rushingTds: number;
  readonly rushingFumblesLost: number;
}

export interface ReceivingStats {
  readonly targets: number;
  readonly receptions: number;
  readonly receivingYards: number;
  readonly receivingTds: number;
  readonly receivingFumblesLost: number;
}

export interface DefensiveStats {
  readonly tacklesSolo: number;
  readonly tackleAssists: number;
  readonly tacklesForLoss: number;
  readonly sacks: number;
  readonly qbHits: number;
  readonly interceptions: number;
  readonly passDefended: number;
  readonly fumblesForced: number;
  readonly defTds: number;
}

export interface NormalizedStatLine extends StatLineCommon {
  readonly passing?: PassingStats;
  readonly rushing?: RushingStats;
  readonly receiving?: ReceivingStats;
  readonly defense?: DefensiveStats;
}

function n(raw: string | undefined): number {
  if (raw === undefined || raw === "" || raw === "NA") return 0;
  const v = Number(raw);
  return Number.isFinite(v) ? v : 0;
}

function s(raw: string | undefined): string {
  return raw ?? "";
}

export function normalizeRow(row: NflverseRow): NormalizedStatLine {
  const positionGroup = s(row.position_group);
  const position = s(row.position);

  const hasPassing = n(row.attempts) > 0 || n(row.passing_yards) > 0;
  const hasRushing = n(row.carries) > 0 || n(row.rushing_yards) > 0;
  const hasReceiving = n(row.targets) > 0 || n(row.receptions) > 0;
  const hasDefense =
    n(row.def_tackles_solo) > 0 ||
    n(row.def_sacks) > 0 ||
    n(row.def_interceptions) > 0 ||
    n(row.def_pass_defended) > 0;

  return {
    playerId: s(row.player_id),
    playerName: s(row.player_display_name) || s(row.player_name),
    team: s(row.team),
    opponent: s(row.opponent_team),
    position,
    positionGroup,
    season: n(row.season),
    week: n(row.week),
    passing: hasPassing
      ? {
          completions: n(row.completions),
          attempts: n(row.attempts),
          passingYards: n(row.passing_yards),
          passingTds: n(row.passing_tds),
          interceptions: n(row.passing_interceptions),
          sacksSuffered: n(row.sacks_suffered),
        }
      : undefined,
    rushing: hasRushing
      ? {
          carries: n(row.carries),
          rushingYards: n(row.rushing_yards),
          rushingTds: n(row.rushing_tds),
          rushingFumblesLost: n(row.rushing_fumbles_lost),
        }
      : undefined,
    receiving: hasReceiving
      ? {
          targets: n(row.targets),
          receptions: n(row.receptions),
          receivingYards: n(row.receiving_yards),
          receivingTds: n(row.receiving_tds),
          receivingFumblesLost: n(row.receiving_fumbles_lost),
        }
      : undefined,
    defense: hasDefense
      ? {
          tacklesSolo: n(row.def_tackles_solo),
          tackleAssists: n(row.def_tackle_assists),
          tacklesForLoss: n(row.def_tackles_for_loss),
          sacks: n(row.def_sacks),
          qbHits: n(row.def_qb_hits),
          interceptions: n(row.def_interceptions),
          passDefended: n(row.def_pass_defended),
          fumblesForced: n(row.def_fumbles_forced),
          defTds: n(row.def_tds),
        }
      : undefined,
  };
}

interface PickSpec {
  readonly position: string;
  readonly sortBy: (row: NflverseRow) => number;
  readonly label: string;
}

const PICK_SPECS: readonly PickSpec[] = [
  { position: "QB", sortBy: (r) => Number(r.passing_yards) || 0, label: "QB (top passing yards)" },
  { position: "WR", sortBy: (r) => Number(r.receiving_yards) || 0, label: "WR (top receiving yards)" },
  { position: "RB", sortBy: (r) => Number(r.rushing_yards) || 0, label: "RB (top rushing yards)" },
  { position: "DE", sortBy: (r) => Number(r.def_sacks) || 0, label: "DE (top sacks)" },
  { position: "LB", sortBy: (r) => Number(r.def_tackles_solo) || 0, label: "LB (top solo tackles)" },
];

interface PickResult {
  readonly label: string;
  readonly statLine: NormalizedStatLine;
}

export function pickRepresentatives(data: NflverseWeekData): readonly PickResult[] {
  const results: PickResult[] = [];
  for (const spec of PICK_SPECS) {
    const candidates = data.rows.filter((r) => r.position === spec.position);
    if (candidates.length === 0) continue;
    const sorted = [...candidates].sort((a, b) => spec.sortBy(b) - spec.sortBy(a));
    const top = sorted[0];
    if (!top) continue;
    results.push({ label: spec.label, statLine: normalizeRow(top) });
  }
  return results;
}

function formatStatLine(line: NormalizedStatLine): string {
  const parts: string[] = [];
  if (line.passing) {
    parts.push(
      `passing ${line.passing.completions}/${line.passing.attempts} ${line.passing.passingYards}yd ${line.passing.passingTds}td ${line.passing.interceptions}int`
    );
  }
  if (line.rushing) {
    parts.push(
      `rushing ${line.rushing.carries}car ${line.rushing.rushingYards}yd ${line.rushing.rushingTds}td`
    );
  }
  if (line.receiving) {
    parts.push(
      `receiving ${line.receiving.receptions}/${line.receiving.targets} ${line.receiving.receivingYards}yd ${line.receiving.receivingTds}td`
    );
  }
  if (line.defense) {
    parts.push(
      `defense ${line.defense.tacklesSolo}solo ${line.defense.sacks}sk ${line.defense.qbHits}qbhit ${line.defense.interceptions}int`
    );
  }
  return parts.join(" | ");
}

export async function runNormalizePoc(year: number, week: number): Promise<void> {
  console.log(`[normalize] === pick 5 representatives + normalize for ${year} W${week} ===`);
  const data = await pullNflverseWeek(year, week);
  const picks = pickRepresentatives(data);

  for (const pick of picks) {
    const line = pick.statLine;
    console.log(`\n[normalize] ${pick.label}:`);
    console.log(`  ${line.playerName.padEnd(28)} (${line.position}, ${line.team} vs ${line.opponent})`);
    console.log(`  ${formatStatLine(line)}`);
  }

  await mkdir(FIXTURES_DIR, { recursive: true });
  const outPath = join(FIXTURES_DIR, `normalized-statlines-${year}-w${week}.json`);
  await writeFile(
    outPath,
    JSON.stringify(
      picks.map((p) => ({ label: p.label, statLine: p.statLine })),
      null,
      2
    ),
    "utf8"
  );
  console.log(`\n[normalize] saved ${picks.length} normalized stat lines → ${outPath}`);
}
