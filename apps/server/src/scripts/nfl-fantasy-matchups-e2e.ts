/**
 * E2E Phase A.3 : matchups + standings sur DB Postgres reelle.
 *
 *   pnpm exec tsx src/scripts/nfl-fantasy-matchups-e2e.ts
 */

import { prisma } from "../prisma";
import { createLeague, joinLeague } from "../services/nfl-fantasy-league";
import { setLineup } from "../services/nfl-fantasy-lineup";
import {
  computeStandings,
  generateMatchups,
  getLeagueStandings,
  listMatchupsForWeek,
  settleNflFantasyWeek,
} from "../services/nfl-fantasy-scoring";
import {
  autoFillRosters,
  finalizeLeague,
} from "../services/nfl-fantasy-draft";
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
  console.log("[matchups-e2e] start");

  const ts = Date.now();
  const owner = `e2e-match-owner-${ts}`;
  const member = `e2e-match-member-${ts}`;
  let leagueId = "";

  try {
    const lg = await createLeague({
      ownerId: owner,
      name: "Phase A matchups E2E",
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
    const lgFull = await prisma.nflFantasyLeague.findUnique({
      where: { id: leagueId },
      include: { entries: { orderBy: { joinedAt: "asc" } } },
    });
    const memberEntry = lgFull!.entries.find((e) => e.userId === member)!;

    await autoFillRosters({ leagueId });
    await finalizeLeague({ leagueId });

    // Lineups + settle pour avoir au moins 1 matchup termine
    for (const entryId of [ownerEntry.id, memberEntry.id]) {
      const roster = await getRosterWithPlayers(entryId);
      const starters = roster.slice(0, 11).map((r) => ({
        playerId: r.player!.id,
        bbPosition: r.player!.bbPosition,
      }));
      await setLineup({
        entryId,
        weekId: "2025:W10",
        starters,
        captainId: starters[0]!.playerId,
        viceCaptainId: starters[1]!.playerId,
      });
    }
    await generateMatchups({ leagueId, weekId: "2025:W10" });
    await settleNflFantasyWeek({ leagueId, weekId: "2025:W10" });

    await step("listMatchupsForWeek(W10) renvoie le matchup settle", async () => {
      const matchups = await listMatchupsForWeek({ leagueId, weekId: "2025:W10" });
      if (matchups.length !== 1) throw new Error(`length=${matchups.length}`);
      const m = matchups[0]!;
      if (m.settledAt == null) throw new Error("settledAt null");
      if (m.homeScore == null || m.awayScore == null) throw new Error("scores null");
      console.log(
        `home=${m.homeScore} away=${m.awayScore} winner=${m.winnerId}`,
      );
    });

    await step("listMatchupsForWeek(W11) renvoie vide", async () => {
      const matchups = await listMatchupsForWeek({ leagueId, weekId: "2025:W11" });
      if (matchups.length !== 0) throw new Error(`length=${matchups.length}`);
    });

    let standingsCount = 0;
    await step("getLeagueStandings calcule W-L-T + tri", async () => {
      const rows = await getLeagueStandings(leagueId);
      standingsCount = rows.length;
      if (rows.length !== 2) throw new Error(`rows=${rows.length}`);
      const total = rows.reduce((s, r) => s + r.wins + r.losses + r.ties, 0);
      if (total !== 2) throw new Error(`total games != 2 (got ${total})`);
      // Le winner doit etre en tete
      const top = rows[0]!;
      if (top.wins !== 1 && top.ties !== 1) {
        throw new Error(`top.wins=${top.wins} top.ties=${top.ties}`);
      }
      console.log(
        `top=${top.teamName} ${top.wins}-${top.losses}-${top.ties} diff=${top.differential}`,
      );
    });

    if (standingsCount !== 2) throw new Error("standings malformees");

    // Helper pur (sanity)
    await step("computeStandings (pur) sur 0 matchup -> tous 0", async () => {
      const out = computeStandings({
        entries: [
          { id: "A", teamName: "A" },
          { id: "B", teamName: "B" },
        ],
        matchups: [],
      });
      if (out.length !== 2) throw new Error("len");
      if (out.some((r) => r.games !== 0)) throw new Error("games != 0");
    });

    console.log("[matchups-e2e] all steps OK");
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
    console.error("[matchups-e2e] fatal:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
