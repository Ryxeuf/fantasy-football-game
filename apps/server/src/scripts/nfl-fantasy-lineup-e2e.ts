/**
 * E2E Phase 2.D : roster + lineup sur DB Postgres reelle.
 *   pnpm exec tsx src/scripts/nfl-fantasy-lineup-e2e.ts
 */

import { prisma } from "../prisma";
import { createLeague, deleteLeague } from "../services/nfl-fantasy-league";
import {
  addPlayerToRoster,
  getRoster,
  removePlayerFromRoster,
} from "../services/nfl-fantasy-roster";
import {
  getLineup,
  isLineupLocked,
  lockLineups,
  setLineup,
  NflFantasyLineupError,
} from "../services/nfl-fantasy-lineup";

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
  console.log("[lineup-e2e] start");

  const owner = "e2e-d-owner-" + Date.now();
  let leagueId = "";
  let entryId = "";

  try {
    // Setup : league + entry
    const lg = await createLeague({
      ownerId: owner,
      name: "Phase 2D E2E",
      teamName: "P2D Owner",
      seasonId: "2025",
    });
    leagueId = lg.id;
    entryId = lg.entries[0]!.id;

    // Recupere 11 vrais NflPlayer pour le roster (issus de l'ingestion)
    const players = await prisma.nflPlayer.findMany({ take: 11 });
    if (players.length < 11) {
      throw new Error(`Pas assez de NflPlayer en DB (${players.length}/11)`);
    }

    await step("addPlayerToRoster x11", async () => {
      for (const p of players) {
        await addPlayerToRoster({ entryId, playerId: p.id, tvCost: 10 });
      }
      const roster = await getRoster(entryId);
      if (roster.length !== 11) {
        throw new Error(`roster.length=${roster.length}, attendu 11`);
      }
    });

    await step("entry.totalTV = sum(tvCost) = 110", async () => {
      const e = await prisma.nflFantasyEntry.findUnique({ where: { id: entryId } });
      if (e?.totalTV !== 110) {
        throw new Error(`totalTV=${e?.totalTV}, attendu 110`);
      }
    });

    await step("setLineup avec captain + vice", async () => {
      const out = await setLineup({
        entryId,
        weekId: "2025:W10",
        starters: players.map((p) => ({
          playerId: p.id,
          bbPosition: p.bbPosition,
        })),
        captainId: players[0]!.id,
        viceCaptainId: players[1]!.id,
      });
      if (out.starters.length !== 11) {
        throw new Error(`starters.length=${out.starters.length}`);
      }
      const captain = out.starters.find((s) => s.isCaptain);
      if (captain?.playerId !== players[0]!.id) {
        throw new Error("captain flag mauvais");
      }
    });

    await step("setLineup idempotent (re-applique)", async () => {
      const out = await setLineup({
        entryId,
        weekId: "2025:W10",
        starters: players.map((p) => ({
          playerId: p.id,
          bbPosition: p.bbPosition,
        })),
        captainId: players[1]!.id, // captain change
        viceCaptainId: players[2]!.id,
      });
      const newCaptain = out.starters.find((s) => s.isCaptain);
      if (newCaptain?.playerId !== players[1]!.id) {
        throw new Error("captain pas mis a jour");
      }
    });

    await step("setLineup rejet PLAYER_NOT_ON_ROSTER", async () => {
      try {
        await setLineup({
          entryId,
          weekId: "2025:W10",
          starters: [
            { playerId: "ghost-id", bbPosition: "Lineman" },
            ...players.slice(1).map((p) => ({
              playerId: p.id,
              bbPosition: p.bbPosition,
            })),
          ],
          captainId: players[1]!.id,
        });
        throw new Error("aurait du throw");
      } catch (e) {
        if (
          !(e instanceof NflFantasyLineupError) ||
          e.code !== "PLAYER_NOT_ON_ROSTER"
        ) {
          throw new Error(`mauvais code : ${(e as Error).message}`);
        }
      }
    });

    await step("lockLineups + setLineup rejet LINEUP_LOCKED", async () => {
      const { locked } = await lockLineups("2025:W10");
      if (locked < 1) throw new Error(`locked=${locked}, attendu >=1`);

      const isLocked = await isLineupLocked({ entryId, weekId: "2025:W10" });
      if (!isLocked) throw new Error("isLineupLocked devrait etre true");

      try {
        await setLineup({
          entryId,
          weekId: "2025:W10",
          starters: players.map((p) => ({
            playerId: p.id,
            bbPosition: p.bbPosition,
          })),
          captainId: players[0]!.id,
        });
        throw new Error("aurait du throw LINEUP_LOCKED");
      } catch (e) {
        if (
          !(e instanceof NflFantasyLineupError) ||
          e.code !== "LINEUP_LOCKED"
        ) {
          throw new Error(`mauvais code : ${(e as Error).message}`);
        }
      }
    });

    await step("getLineup retourne 11 starters", async () => {
      const lineup = await getLineup({ entryId, weekId: "2025:W10" });
      if (!lineup) throw new Error("null");
      if (lineup.starters.length !== 11) {
        throw new Error(`starters.length=${lineup.starters.length}`);
      }
    });

    await step("removePlayerFromRoster decremente totalTV", async () => {
      await removePlayerFromRoster({ entryId, playerId: players[10]!.id });
      const e = await prisma.nflFantasyEntry.findUnique({ where: { id: entryId } });
      if (e?.totalTV !== 100) {
        throw new Error(`totalTV=${e?.totalTV}, attendu 100`);
      }
    });

    console.log("[lineup-e2e] all steps OK");
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
    console.error("[lineup-e2e] fatal:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
