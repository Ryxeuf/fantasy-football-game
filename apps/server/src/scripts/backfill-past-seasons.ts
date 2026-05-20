/**
 * Backfill nflverse pour les saisons passees (Phase 3.E).
 *
 * Default : 2023 + 2024, weeks 1-22 (reg + post), skip-existing.
 *
 *   docker exec nufflearena_server sh -c "cd /app/apps/server && \
 *     pnpm exec tsx src/scripts/backfill-past-seasons.ts"
 *
 * Options :
 *   --season 2023 [--season 2024]   Saisons a traiter (repetable).
 *   --from 1                        Premiere week (default 1).
 *   --to 22                         Derniere week (default 22).
 *   --no-skip                       Re-ingest meme si NflIngestRun success.
 *
 * Le CSV nflverse est cache en memoire entre les weeks d'une meme saison
 * (1 seul download de ~3MB par saison au lieu de 22).
 */

import { prisma } from "../prisma";
import {
  backfillNflSeason,
  type BackfillSeasonResult,
} from "../services/nfl-ingest";

interface CliArgs {
  readonly seasons: ReadonlyArray<string>;
  readonly fromWeek: number;
  readonly toWeek: number;
  readonly skipExisting: boolean;
}

function parseArgs(argv: ReadonlyArray<string>): CliArgs {
  const seasons: string[] = [];
  let fromWeek = 1;
  let toWeek = 22;
  let skipExisting = true;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--season" && i + 1 < argv.length) {
      seasons.push(argv[i + 1]!);
      i++;
    } else if (a === "--from" && i + 1 < argv.length) {
      fromWeek = Number(argv[i + 1]);
      i++;
    } else if (a === "--to" && i + 1 < argv.length) {
      toWeek = Number(argv[i + 1]);
      i++;
    } else if (a === "--no-skip") {
      skipExisting = false;
    }
  }

  return {
    seasons: seasons.length > 0 ? seasons : ["2023", "2024"],
    fromWeek,
    toWeek,
    skipExisting,
  };
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const min = Math.floor(s / 60);
  const rem = s % 60;
  return min > 0 ? `${min}m${String(rem).padStart(2, "0")}s` : `${s}s`;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  console.log(
    `[backfill] saisons=[${args.seasons.join(",")}] weeks=${args.fromWeek}-${args.toWeek} skipExisting=${args.skipExisting}`,
  );

  const totalT0 = Date.now();
  const summaries: BackfillSeasonResult[] = [];

  for (const seasonId of args.seasons) {
    console.log(`\n[backfill] === Saison ${seasonId} ===`);
    const t0 = Date.now();
    const out = await backfillNflSeason({
      seasonId,
      fromWeek: args.fromWeek,
      toWeek: args.toWeek,
      skipExisting: args.skipExisting,
      onProgress: (w, status, res, err) => {
        const tag = `W${String(w).padStart(2, "0")}`;
        if (status === "skipped") {
          console.log(`  ${tag}  skipped (deja success)`);
        } else if (status === "failed") {
          console.log(`  ${tag}  FAILED · ${err ?? "?"}`);
        } else if (res) {
          const errsSuffix =
            res.errors.length > 0 ? ` · ${res.errors.length} errs` : "";
          console.log(
            `  ${tag}  ${res.gamesUpdated} games · ${res.playersUpdated} players · ${res.statsUpdated} stats${errsSuffix}`,
          );
        }
      },
    });

    const dt = formatDuration(Date.now() - t0);
    console.log(
      `[backfill] Saison ${seasonId} OK in ${dt} : ${out.weeksProcessed} ingested, ${out.weeksSkipped} skipped, ${out.weeksFailed} failed · ${out.totalGames} games · ${out.totalPlayers} players · ${out.totalStats} stats`,
    );
    if (out.errors.length > 0) {
      console.log(
        `  errors :\n    ${out.errors.map((e) => `W${e.weekNumber}: ${e.error}`).join("\n    ")}`,
      );
    }
    summaries.push(out);
  }

  const totalDt = formatDuration(Date.now() - totalT0);
  const totals = summaries.reduce(
    (acc, s) => ({
      games: acc.games + s.totalGames,
      players: acc.players + s.totalPlayers,
      stats: acc.stats + s.totalStats,
      failed: acc.failed + s.weeksFailed,
    }),
    { games: 0, players: 0, stats: 0, failed: 0 },
  );

  console.log(
    `\n[backfill] TOTAL ${totalDt} : ${totals.games} games · ${totals.players} players · ${totals.stats} stats · ${totals.failed} weeks failed`,
  );
  if (totals.failed > 0) {
    process.exitCode = 1;
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("[backfill] fatal:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
