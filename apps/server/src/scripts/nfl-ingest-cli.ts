/**
 * Script CLI ad-hoc pour invoquer manuellement les fonctions du service
 * `nfl-ingest`. Utilise pour la validation end-to-end Phase 2.A.
 *
 * Usage (dans le container nufflearena_server) :
 *
 *   pnpm exec tsx src/scripts/nfl-ingest-cli.ts seed-teams
 *   pnpm exec tsx src/scripts/nfl-ingest-cli.ts seed-season 2025
 *   pnpm exec tsx src/scripts/nfl-ingest-cli.ts ingest-week 2025 10
 *   pnpm exec tsx src/scripts/nfl-ingest-cli.ts all 2025 10
 *
 * En Phase 2.G, ces fonctions seront aussi exposees via routes admin
 * Express (POST /admin/nfl/ingest/week, etc.).
 */

import { prisma } from "../prisma";
import {
  ingestNflverseWeek,
  seedNflSeason,
  seedNflTeams,
} from "../services/nfl-ingest";

async function cmdSeedTeams(): Promise<void> {
  console.log("[seed-teams] start");
  const result = await seedNflTeams();
  console.log(`[seed-teams] done — created=${result.teamsCreated} updated=${result.teamsUpdated}`);
}

async function cmdSeedSeason(seasonId: string): Promise<void> {
  console.log(`[seed-season] start ${seasonId}`);
  await seedNflSeason(seasonId);
  const weeks = await prisma.nflWeek.count({ where: { seasonId } });
  console.log(`[seed-season] done — ${weeks} weeks pour saison ${seasonId}`);
}

async function cmdIngestWeek(seasonId: string, weekArg: string): Promise<void> {
  const weekNumber = Number(weekArg);
  console.log(`[ingest-week] start ${seasonId} W${weekNumber}`);
  const t0 = Date.now();
  const result = await ingestNflverseWeek({ seasonId, weekNumber });
  const dt = Date.now() - t0;
  console.log(`[ingest-week] done in ${dt}ms`);
  console.log(`  players updated : ${result.playersUpdated}`);
  console.log(`  stats   updated : ${result.statsUpdated}`);
  console.log(`  games   touched : ${result.gamesUpdated}`);
  console.log(`  errors          : ${result.errors.length}`);
  if (result.errors.length > 0) {
    console.log(`  premiers errors :`);
    for (const e of result.errors.slice(0, 5)) {
      console.log(`    - ${e.context}: ${e.error}`);
    }
  }
  console.log(`  ingestRunId     : ${result.ingestRunId}`);
}

async function main(): Promise<void> {
  const [, , cmd, ...rest] = process.argv;
  switch (cmd) {
    case "seed-teams":
      await cmdSeedTeams();
      break;
    case "seed-season":
      await cmdSeedSeason(rest[0] ?? "2025");
      break;
    case "ingest-week":
      await cmdIngestWeek(rest[0] ?? "2025", rest[1] ?? "10");
      break;
    case "all":
      await cmdSeedTeams();
      await cmdSeedSeason(rest[0] ?? "2025");
      await cmdIngestWeek(rest[0] ?? "2025", rest[1] ?? "10");
      break;
    default:
      console.log("Usage: pnpm exec tsx src/scripts/nfl-ingest-cli.ts <cmd>");
      console.log("  cmd: seed-teams | seed-season <year> | ingest-week <year> <week> | all <year> <week>");
      process.exit(1);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("[nfl-ingest-cli] fatal:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
