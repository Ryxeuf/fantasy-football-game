/**
 * E2E Phase 2.E : matchups + settle SPP sur DB Postgres reelle, en
 * s'appuyant sur l'ingestion W10 2025 deja en place.
 *
 *   pnpm exec tsx src/scripts/nfl-fantasy-scoring-e2e.ts
 */

import { prisma } from "../prisma";
import { createLeague, joinLeague } from "../services/nfl-fantasy-league";
import { addPlayerToRoster } from "../services/nfl-fantasy-roster";
import { setLineup } from "../services/nfl-fantasy-lineup";
import {
  generateMatchups,
  listMatchupsForWeek,
  settleNflFantasyWeek,
} from "../services/nfl-fantasy-scoring";

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
  console.log("[scoring-e2e] start");

  const ts = Date.now();
  const owner = `e2e-e-owner-${ts}`;
  const member = `e2e-e-member-${ts}`;
  let leagueId = "";

  try {
    // 1. Setup league (2 entries = 1 matchup)
    const lg = await createLeague({
      ownerId: owner,
      name: "Phase 2E E2E",
      teamName: "Owner Stompers",
      seasonId: "2025",
      size: 2,
    });
    leagueId = lg.id;
    const ownerEntry = lg.entries[0]!;

    await joinLeague({
      userId: member,
      teamName: "Member Mob",
      inviteCode: lg.inviteCode!,
    });

    const lg2 = await prisma.nflFantasyLeague.findUnique({
      where: { id: leagueId },
      include: { entries: { orderBy: { joinedAt: "asc" } } },
    });
    const memberEntry = lg2!.entries.find(
      (e: { userId: string }) => e.userId === member,
    )!;

    // 2. Recupere 22 players (11 par entry) qui ONT joue en W10
    //    -> filtre via NflGameStat existants
    type StatWithPlayer = {
      playerId: string;
      player: { bbPosition: string };
    };
    const stats: ReadonlyArray<StatWithPlayer> =
      await prisma.nflGameStat.findMany({
        where: {
          gameId: { startsWith: "2025_10_" },
          computedSpp: { gt: 0 },
        },
        take: 22,
        orderBy: { computedSpp: "desc" }, // top scorers
        include: { player: true },
      });
    if (stats.length < 22) {
      throw new Error(
        `Pas assez de stats W10 (${stats.length}/22) — relancer ingest-week 2025 10`,
      );
    }
    const ownerPlayers = stats.slice(0, 11);
    const memberPlayers = stats.slice(11, 22);

    await step("seed rosters (11 + 11 starters W10)", async () => {
      for (const s of ownerPlayers) {
        await addPlayerToRoster({ entryId: ownerEntry.id, playerId: s.playerId, tvCost: 1 });
      }
      for (const s of memberPlayers) {
        await addPlayerToRoster({ entryId: memberEntry.id, playerId: s.playerId, tvCost: 1 });
      }
    });

    await step("setLineup owner + member (captain top SPP)", async () => {
      await setLineup({
        entryId: ownerEntry.id,
        weekId: "2025:W10",
        starters: ownerPlayers.map((s) => ({
          playerId: s.playerId,
          bbPosition: s.player.bbPosition,
        })),
        captainId: ownerPlayers[0]!.playerId,
        viceCaptainId: ownerPlayers[1]!.playerId,
      });
      await setLineup({
        entryId: memberEntry.id,
        weekId: "2025:W10",
        starters: memberPlayers.map((s) => ({
          playerId: s.playerId,
          bbPosition: s.player.bbPosition,
        })),
        captainId: memberPlayers[0]!.playerId,
        viceCaptainId: memberPlayers[1]!.playerId,
      });
    });

    await step("generateMatchups (W10) cree 1 matchup", async () => {
      const out = await generateMatchups({ leagueId, weekId: "2025:W10" });
      if (out.matchupsCreated !== 1) {
        throw new Error(`matchupsCreated=${out.matchupsCreated}, attendu 1`);
      }
    });

    await step("generateMatchups idempotent (skip si deja la)", async () => {
      const out = await generateMatchups({ leagueId, weekId: "2025:W10" });
      if (out.matchupsCreated !== 0 || out.matchupsExisting !== 1) {
        throw new Error(`re-run pas idempotent`);
      }
    });

    let matchupId = "";
    await step("settleNflFantasyWeek calcule scores + winner", async () => {
      const out = await settleNflFantasyWeek({ leagueId, weekId: "2025:W10" });
      if (out.matchupsSettled !== 1) {
        throw new Error(`matchupsSettled=${out.matchupsSettled}`);
      }
      if (out.startersScored !== 22) {
        throw new Error(`startersScored=${out.startersScored}, attendu 22`);
      }
      const matchups = await listMatchupsForWeek({ leagueId, weekId: "2025:W10" });
      const m = matchups[0]!;
      matchupId = m.id;
      if (m.settledAt == null) throw new Error("settledAt pas set");
      if (m.homeScore == null || m.awayScore == null) {
        throw new Error("scores null");
      }
      // Verifie que captain multiplier a bien ete applique
      const homeCaptain = await prisma.nflFantasyLineupStarter.findFirst({
        where: {
          lineup: { entryId: ownerEntry.id, weekId: "2025:W10" },
          isCaptain: true,
        },
      });
      if (
        homeCaptain?.rawSpp == null ||
        homeCaptain.finalSpp == null ||
        homeCaptain.finalSpp !== Math.trunc(homeCaptain.rawSpp * 1.5)
      ) {
        throw new Error(
          `captain multiplier mal applique : raw=${homeCaptain?.rawSpp} final=${homeCaptain?.finalSpp}`,
        );
      }
      console.log(
        `home=${m.homeScore} away=${m.awayScore} winner=${m.winnerId}`,
      );
    });

    await step("settleNflFantasyWeek idempotent (skip already-settled)", async () => {
      const out = await settleNflFantasyWeek({ leagueId, weekId: "2025:W10" });
      if (out.matchupsSettled !== 0 || out.matchupsSkipped !== 1) {
        throw new Error(`re-run pas idempotent`);
      }
    });

    if (!matchupId) throw new Error("matchupId missing");

    console.log("[scoring-e2e] all steps OK");
  } finally {
    if (leagueId) {
      await prisma.nflFantasyLeague
        .delete({ where: { id: leagueId } })
        .catch(() => undefined);
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("[scoring-e2e] fatal:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
