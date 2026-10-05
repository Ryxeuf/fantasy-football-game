/**
 * Bootstrap NFL Fantasy en prod (Phase 5.E).
 *
 * Script idempotent qui populate une DB Postgres vide (ou existante)
 * avec tout ce qu'il faut pour que le module fonctionne :
 *   1. seedNflTeams (32 NflTeam)
 *   2. seedNflSeason x N (NflWeek 1-22 par saison)
 *   3. ingestNflverseRosters x N (jersey + bio + headshot ~3000
 *      joueurs par saison)
 *   4. backfillNflSeason x N (stats players W1-W22, ~19000 stats
 *      par saison)
 *   5. backfillScoresFromSchedules x N (scores nflverse +
 *      kickoffAt corriges)
 *
 * Tout est idempotent — re-run safe. skipExisting=true sur les
 * weeks deja ingerees.
 *
 * Usage :
 *   docker exec nufflearena_server sh -c "cd /app/apps/server && \
 *     pnpm exec tsx src/scripts/bootstrap-nfl-prod.ts"
 *
 *   # En prod (DATABASE_URL pointant prod) :
 *   DATABASE_URL=postgres://... pnpm exec tsx \
 *     src/scripts/bootstrap-nfl-prod.ts --season 2024 --season 2025
 *
 * Options :
 *   --season YYYY      Saison a populer (repetable). Default :
 *                      2023 2024 2025.
 *   --skip-stats       Skip backfillNflSeason (utile si deja fait).
 *   --skip-rosters     Skip ingestNflverseRosters.
 *   --skip-scores      Skip backfillScoresFromSchedules.
 *   --refresh-stats    Re-ingere les weeks deja ingerees (skipExisting=false).
 *                      Indispensable pour un rattrapage : une week ingeree
 *                      partiellement par le cron (TNF seul) est marquee
 *                      `success` et serait sinon sautee.
 *   --resettle-weeks A-B
 *                      Step 6 : re-settle les weeks A..B de toutes les
 *                      leagues in_progress de chaque saison (sans double
 *                      credit de carriere, cf. resettleSeasonWeeks).
 *
 * Duree estimee : ~5-7 min par saison sur connexion correcte.
 *
 * Saison en cours (ex: 2026 avant le kickoff du 09/09/2026) :
 *   Aucun match n'a encore ete joue, donc stats + scores n'existent
 *   pas. Lancer rosters-seuls :
 *     pnpm exec tsx src/scripts/bootstrap-nfl-prod.ts \
 *       --season 2026 --skip-stats --skip-scores
 *   nflverse publie les rosters offseason des le printemps puis les
 *   met a jour en continu ; les rosters definitifs a 53 sont figes
 *   apres le cutdown du 30/08/2026 (re-run idempotent a ce moment).
 *   Cf. docs/nfl-fantasy/09-transitions-2026.md pour le calendrier.
 *
 * Rattrapage d'une saison en cours (ex: 2026 apres W4, cf. doc 32) :
 *     pnpm exec tsx src/scripts/bootstrap-nfl-prod.ts \
 *       --season 2026 --refresh-stats --resettle-weeks 1-4
 */

import { prisma } from "../prisma";
import {
  backfillNflSeason,
  backfillScoresFromSchedules,
  seedNflSeason,
  seedNflTeams,
} from "../services/nfl-ingest";
import { ingestNflverseRosters } from "../services/nfl-ingest-rosters";
import { resettleSeasonWeeks } from "../services/nfl-fantasy-scoring";

const DEFAULT_SEASONS = ["2023", "2024", "2025"] as const;

export interface CliArgs {
  readonly seasons: ReadonlyArray<string>;
  readonly skipStats: boolean;
  readonly skipRosters: boolean;
  readonly skipScores: boolean;
  readonly refreshStats: boolean;
  readonly resettleWeeks: { readonly from: number; readonly to: number } | null;
}

const USAGE =
  "Usage: tsx bootstrap-nfl-prod.ts [--season YYYY ...] [--skip-stats] [--skip-rosters] [--skip-scores] [--refresh-stats] [--resettle-weeks A-B]";

/** "1-4" -> { from: 1, to: 4 } ; null si invalide (bornes 1..22, from <= to). Pur. */
export function parseWeekRange(
  raw: string,
): { from: number; to: number } | null {
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(raw.trim());
  if (!m) return null;
  const from = Number(m[1]);
  const to = Number(m[2]);
  if (from < 1 || to > 22 || from > to) return null;
  return { from, to };
}

/** Pur : leve sur un argument inconnu ou invalide. */
export function parseArgs(argv: ReadonlyArray<string>): CliArgs {
  const seasons: string[] = [];
  let skipStats = false;
  let skipRosters = false;
  let skipScores = false;
  let refreshStats = false;
  let resettleWeeks: CliArgs["resettleWeeks"] = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--season" && i + 1 < argv.length) {
      seasons.push(argv[i + 1]!);
      i++;
    } else if (a === "--skip-stats") {
      skipStats = true;
    } else if (a === "--skip-rosters") {
      skipRosters = true;
    } else if (a === "--skip-scores") {
      skipScores = true;
    } else if (a === "--refresh-stats") {
      refreshStats = true;
    } else if (a === "--resettle-weeks" && i + 1 < argv.length) {
      resettleWeeks = parseWeekRange(argv[i + 1]!);
      if (!resettleWeeks) {
        throw new Error(`--resettle-weeks invalide: ${argv[i + 1]} (attendu A-B, 1..22)`);
      }
      i++;
    } else {
      throw new Error(`Argument inconnu: ${a}\n${USAGE}`);
    }
  }
  return {
    seasons: seasons.length > 0 ? seasons : Array.from(DEFAULT_SEASONS),
    skipStats,
    skipRosters,
    skipScores,
    refreshStats,
    resettleWeeks,
  };
}

function section(label: string): void {
  console.log("");
  console.log("═".repeat(70));
  console.log(`  ${label}`);
  console.log("═".repeat(70));
}

async function step1Teams(): Promise<void> {
  section("Step 1/5 — Seed 32 NflTeam");
  const r = await seedNflTeams();
  console.log(`  created=${r.teamsCreated} updated=${r.teamsUpdated}`);
}

async function step2Seasons(seasons: ReadonlyArray<string>): Promise<void> {
  section(`Step 2/5 — Seed NflSeason + NflWeek pour ${seasons.join(", ")}`);
  for (const s of seasons) {
    await seedNflSeason(s);
    const weeks = await prisma.nflWeek.count({ where: { seasonId: s } });
    console.log(`  ${s} : ${weeks} weeks`);
  }
}

async function step3Rosters(seasons: ReadonlyArray<string>): Promise<void> {
  section(`Step 3/5 — Ingest rosters (jersey + bio) pour ${seasons.join(", ")}`);
  for (const s of seasons) {
    const t0 = Date.now();
    const r = await ingestNflverseRosters({ seasonId: s });
    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(
      `  ${s} : rows=${r.rowsTotal} updated=${r.playersUpdated} created=${r.playersCreated} skipped=${r.playersSkipped} errors=${r.errors.length} (${dt}s)`,
    );
  }
}

async function step4Stats(
  seasons: ReadonlyArray<string>,
  refresh: boolean,
): Promise<void> {
  section(`Step 4/5 — Backfill stats nflverse W1-W22 pour ${seasons.join(", ")}`);
  for (const s of seasons) {
    const t0 = Date.now();
    const r = await backfillNflSeason({
      seasonId: s,
      skipExisting: !refresh,
      onProgress: (weekNum, status) => {
        if (status === "ingested") process.stdout.write(`W${weekNum} `);
      },
    });
    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    console.log("");
    console.log(
      `  ${s} : processed=${r.weeksProcessed} skipped=${r.weeksSkipped} failed=${r.weeksFailed} (${dt}s)`,
    );
  }
}

async function step5Scores(seasons: ReadonlyArray<string>): Promise<void> {
  section(`Step 5/5 — Backfill scores nflverse pour ${seasons.join(", ")}`);
  for (const s of seasons) {
    const t0 = Date.now();
    // createMissing : matchs a venir crees "scheduled" (verrouillage des
    // lineups au coup d'envoi) — sans effet sur une saison terminee.
    const r = await backfillScoresFromSchedules({ seasonId: s, createMissing: true });
    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(
      `  ${s} : rows=${r.schedulesRows} scores=${r.scoresUpdated} kickoffs=${r.kickoffsUpdated} created=${r.gamesCreated} notInDb=${r.notInDb} (${dt}s)`,
    );
  }
}

async function step6Resettle(
  seasons: ReadonlyArray<string>,
  range: { from: number; to: number },
): Promise<void> {
  section(`Step 6 — Re-settle W${range.from}-W${range.to} pour ${seasons.join(", ")}`);
  for (const s of seasons) {
    const r = await resettleSeasonWeeks({
      seasonId: s,
      fromWeek: range.from,
      toWeek: range.to,
    });
    console.log(
      `  ${s} : leagues=${r.leaguesProcessed} matchups=${r.matchupsSettled} errors=${r.errors.length}`,
    );
    for (const e of r.errors) console.log(`    ! ${e.leagueId} ${e.weekId} : ${e.error}`);
  }
}

async function printSummary(seasons: ReadonlyArray<string>): Promise<void> {
  section("Summary");
  for (const s of seasons) {
    type Row = { count: bigint };
    const [teams, weeks, games, gamesScored, stats, players] = await Promise.all([
      prisma.nflTeam.count(),
      prisma.nflWeek.count({ where: { seasonId: s } }),
      prisma.nflGame.count({ where: { seasonId: s } }),
      prisma.nflGame.count({
        where: { seasonId: s, homeScore: { not: null } },
      }),
      prisma.$queryRaw<
        Row[]
      >`SELECT COUNT(*)::bigint AS count FROM "NflGameStat" s JOIN "NflGame" g ON g.id=s."gameId" WHERE g."seasonId"=${s}`,
      prisma.nflPlayer.count(),
    ]);
    const statsCount = Number(stats[0]?.count ?? 0n);
    console.log(
      `  ${s} : ${teams} teams · ${weeks} weeks · ${games} games (${gamesScored} with score) · ${statsCount} stats`,
    );
    console.log(`         ${players} total NflPlayer in DB (cumulative)`);
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(USAGE);
    process.exit(0);
  }
  let args: CliArgs;
  try {
    args = parseArgs(argv);
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
  console.log(`[bootstrap-nfl-prod] seasons=${args.seasons.join(",")}`);

  const t0 = Date.now();
  try {
    await step1Teams();
    await step2Seasons(args.seasons);
    if (!args.skipRosters) await step3Rosters(args.seasons);
    if (!args.skipStats) await step4Stats(args.seasons, args.refreshStats);
    if (!args.skipScores) await step5Scores(args.seasons);
    if (args.resettleWeeks) await step6Resettle(args.seasons, args.resettleWeeks);
    await printSummary(args.seasons);

    const dtMin = ((Date.now() - t0) / 60000).toFixed(1);
    section(`✓ Bootstrap done in ${dtMin} min`);
  } catch (e) {
    console.error(`[bootstrap-nfl-prod] FAILED: ${(e as Error).message}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.includes("bootstrap-nfl-prod")) {
  void main();
}
