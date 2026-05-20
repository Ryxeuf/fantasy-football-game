/**
 * E2E Phase 3.C : explorer admin (seasons, teams, players + resync)
 * sur DB Postgres reelle.
 *
 *   docker exec nufflearena_server sh -c "cd /app/apps/server && \
 *     pnpm exec tsx src/scripts/nfl-fantasy-admin-explorer-e2e.ts"
 */

import { prisma } from "../prisma";
import {
  getNflPlayerDetail,
  getNflTeamDetail,
  listNflPlayersForAdmin,
  listNflSeasonsForAdmin,
  listNflTeamsForAdmin,
  recomputePlayerSpp,
  reDerivePlayerBb,
} from "../services/nfl-fantasy-admin-explorer";
import { seedNflTeams } from "../services/nfl-ingest";

async function step(name: string, fn: () => Promise<void>): Promise<void> {
  process.stdout.write(`  [${name}] `);
  try {
    await fn();
    console.log("OK");
  } catch (e) {
    console.log("FAIL");
    throw e;
  }
}

async function main(): Promise<void> {
  console.log("[admin-explorer-e2e] start");

  // Pre-requis : 32 NflTeam seedees (idempotent)
  await seedNflTeams();

  await step("listNflSeasonsForAdmin renvoie un tableau", async () => {
    const seasons = await listNflSeasonsForAdmin();
    if (!Array.isArray(seasons)) throw new Error("not array");
    console.log(`(${seasons.length} season${seasons.length > 1 ? "s" : ""})`);
  });

  await step("listNflTeamsForAdmin renvoie 32 teams", async () => {
    const teams = await listNflTeamsForAdmin({});
    if (teams.length !== 32) throw new Error(`got ${teams.length}, want 32`);
    const kc = teams.find((t) => t.code === "KC");
    if (!kc) throw new Error("KC missing");
    if (kc.bbRace !== "Skaven") throw new Error(`KC race != Skaven (${kc.bbRace})`);
  });

  await step("getNflTeamDetail(KC) renvoie city + race + roster + games", async () => {
    const detail = await getNflTeamDetail({ code: "KC" });
    if (!detail) throw new Error("null");
    if (detail.code !== "KC") throw new Error(`code ${detail.code}`);
    if (!detail.raceLabel) throw new Error("no raceLabel");
  });

  await step("getNflTeamDetail(XXX) renvoie null", async () => {
    const detail = await getNflTeamDetail({ code: "XXX" });
    if (detail !== null) throw new Error("expected null");
  });

  await step("listNflPlayersForAdmin (no filter) renvoie players (pagine 50)", async () => {
    const out = await listNflPlayersForAdmin({});
    if (out.pageSize !== 50) throw new Error(`pageSize=${out.pageSize}`);
    if (out.page !== 1) throw new Error(`page=${out.page}`);
    if (!Array.isArray(out.players)) throw new Error("players not array");
  });

  // Test sur un joueur reel s'il en existe un avec computedSpp
  const samplePlayer = (await prisma.nflPlayer.findFirst({
    where: { teamCode: { not: null } },
  })) as { id: string; bbPosition: string } | null;

  if (samplePlayer) {
    await step(
      `getNflPlayerDetail(${samplePlayer.id}) renvoie detail`,
      async () => {
        const detail = await getNflPlayerDetail({ id: samplePlayer.id });
        if (!detail) throw new Error("null");
        if (detail.id !== samplePlayer.id) throw new Error("id mismatch");
        if (!Array.isArray(detail.stats)) throw new Error("stats not array");
      },
    );

    await step(
      `reDerivePlayerBb(${samplePlayer.id}) est idempotent`,
      async () => {
        const a = await reDerivePlayerBb(samplePlayer.id);
        const b = await reDerivePlayerBb(samplePlayer.id);
        // Second call doit etre changed=false
        if (b.changed) throw new Error("2eme call doit etre idempotent (changed=false)");
        // Premier call : on tolere l'un ou l'autre (depend de l'etat initial)
        console.log(`first.changed=${a.changed}, second.changed=${b.changed}`);
      },
    );

    // Recompute uniquement si stats existent
    const stat = await prisma.nflGameStat.findFirst({
      where: { playerId: samplePlayer.id },
    });
    if (stat) {
      await step(
        `recomputePlayerSpp(${samplePlayer.id}) idempotent (delta = 0)`,
        async () => {
          const out1 = await recomputePlayerSpp(samplePlayer.id);
          const out2 = await recomputePlayerSpp(samplePlayer.id);
          if (out1.newTotalSpp !== out2.newTotalSpp) {
            throw new Error(
              `non idempotent: ${out1.newTotalSpp} != ${out2.newTotalSpp}`,
            );
          }
          console.log(
            `stats=${out1.statsUpdated}, SPP=${out1.newTotalSpp}`,
          );
        },
      );
    } else {
      console.log("  [recompute] SKIP (no NflGameStat pour ce joueur)");
    }
  } else {
    console.log("  [player tests] SKIP (aucun joueur en DB)");
  }

  await step("reDerivePlayerBb sur ID ghost throw PLAYER_NOT_FOUND", async () => {
    try {
      await reDerivePlayerBb("ghost-player-id");
      throw new Error("did not throw");
    } catch (e) {
      const msg = (e as Error).message;
      if (!msg.includes("introuvable")) throw new Error(`bad msg: ${msg}`);
    }
  });

  console.log("[admin-explorer-e2e] all steps OK");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("[admin-explorer-e2e] fatal:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
