/**
 * E2E Phase A : draft (auto-fill) -> finalize -> lineup -> settle
 * sur DB Postgres reelle.
 *
 *   pnpm exec tsx src/scripts/nfl-fantasy-draft-e2e.ts
 */

import { prisma } from "../prisma";
import { createLeague, joinLeague } from "../services/nfl-fantasy-league";
import { setLineup } from "../services/nfl-fantasy-lineup";
import {
  generateMatchups,
  settleNflFantasyWeek,
} from "../services/nfl-fantasy-scoring";
import {
  autoFillRosters,
  finalizeLeague,
  getDraftStats,
  NflFantasyDraftError,
} from "../services/nfl-fantasy-draft";
import { countAvailableRerolls } from "../services/nfl-fantasy-mercato";
import { getRosterWithPlayers } from "../services/nfl-fantasy-roster";

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
  console.log("[draft-e2e] start");

  const ts = Date.now();
  const owner = `e2e-A-owner-${ts}`;
  const member = `e2e-A-member-${ts}`;
  let leagueId = "";

  try {
    const lg = await createLeague({
      ownerId: owner,
      name: "Phase A E2E",
      teamName: "Draft Owner",
      seasonId: "2025",
      size: 2,
    });
    leagueId = lg.id;
    const ownerEntry = lg.entries[0]!;

    await joinLeague({
      userId: member,
      teamName: "Draft Member",
      inviteCode: lg.inviteCode!,
    });
    const lgFull = await prisma.nflFantasyLeague.findUnique({
      where: { id: leagueId },
      include: { entries: { orderBy: { joinedAt: "asc" } } },
    });
    const memberEntry = lgFull!.entries.find((e) => e.userId === member)!;

    await step("autoFillRosters (15/entry)", async () => {
      const out = await autoFillRosters({ leagueId });
      if (out.entriesFilled !== 2 || out.playersAssigned !== 30) {
        throw new Error(
          `entriesFilled=${out.entriesFilled} playersAssigned=${out.playersAssigned}`,
        );
      }
    });

    await step("autoFillRosters idempotent partiel (deja remplies)", async () => {
      const out = await autoFillRosters({ leagueId });
      if (out.playersAssigned !== 0) {
        throw new Error(`replay assign != 0 : ${out.playersAssigned}`);
      }
    });

    await step("getDraftStats reflete les 2 entries x 15", async () => {
      const stats = await getDraftStats(leagueId);
      const totals = stats.perEntry.map((e) => e.rostered);
      if (totals.length !== 2 || totals.some((t) => t !== 15)) {
        throw new Error(`rostered ${JSON.stringify(totals)}`);
      }
    });

    await step("finalizeLeague draft -> in_progress + seed 8x2 rerolls", async () => {
      const out = await finalizeLeague({ leagueId });
      if (out.status !== "in_progress") throw new Error("statut");
      if (out.rerollsSeededTotal !== 16) {
        throw new Error(`rerolls=${out.rerollsSeededTotal}, attendu 16`);
      }
      const ownerRerolls = await countAvailableRerolls(ownerEntry.id);
      const memberRerolls = await countAvailableRerolls(memberEntry.id);
      if (ownerRerolls !== 8 || memberRerolls !== 8) {
        throw new Error(
          `rerolls ownerRerolls=${ownerRerolls} memberRerolls=${memberRerolls}`,
        );
      }
    });

    await step("finalizeLeague rejet INVALID_STATUS si re-run", async () => {
      try {
        await finalizeLeague({ leagueId });
        throw new Error("aurait du throw");
      } catch (e) {
        if (
          !(e instanceof NflFantasyDraftError) ||
          e.code !== "INVALID_STATUS"
        ) {
          throw new Error(`mauvais code : ${(e as Error).message}`);
        }
      }
    });

    await step("setLineup 11 starters depuis le roster", async () => {
      const roster = await getRosterWithPlayers(ownerEntry.id);
      const starters = roster.slice(0, 11).map((r) => ({
        playerId: r.player!.id,
        bbPosition: r.player!.bbPosition,
      }));
      const out = await setLineup({
        entryId: ownerEntry.id,
        weekId: "2025:W10",
        starters,
        captainId: starters[0]!.playerId,
        viceCaptainId: starters[1]!.playerId,
      });
      if (out.starters.length !== 11) throw new Error("starters.length");
    });

    await step("lineup member aussi", async () => {
      const roster = await getRosterWithPlayers(memberEntry.id);
      const starters = roster.slice(0, 11).map((r) => ({
        playerId: r.player!.id,
        bbPosition: r.player!.bbPosition,
      }));
      await setLineup({
        entryId: memberEntry.id,
        weekId: "2025:W10",
        starters,
        captainId: starters[0]!.playerId,
        viceCaptainId: starters[1]!.playerId,
      });
    });

    await step("generateMatchups + settleNflFantasyWeek pour W10", async () => {
      const gm = await generateMatchups({ leagueId, weekId: "2025:W10" });
      if (gm.matchupsCreated !== 1) {
        throw new Error(`matchupsCreated=${gm.matchupsCreated}`);
      }
      const sw = await settleNflFantasyWeek({ leagueId, weekId: "2025:W10" });
      if (sw.matchupsSettled !== 1) {
        throw new Error(`matchupsSettled=${sw.matchupsSettled}`);
      }
      const matchup = await prisma.nflFantasyMatchup.findFirst({
        where: { leagueId, weekId: "2025:W10" },
      });
      if (matchup?.homeScore == null) throw new Error("homeScore null");
      console.log(
        `home=${matchup.homeScore} away=${matchup.awayScore} winner=${matchup.winnerId}`,
      );
    });

    console.log("[draft-e2e] all steps OK");
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
    console.error("[draft-e2e] fatal:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
