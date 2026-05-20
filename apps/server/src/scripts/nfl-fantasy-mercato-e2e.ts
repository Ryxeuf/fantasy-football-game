/**
 * E2E Phase 2.F : rerolls + inducements sur DB Postgres reelle.
 *   pnpm exec tsx src/scripts/nfl-fantasy-mercato-e2e.ts
 */

import { prisma } from "../prisma";
import { createLeague } from "../services/nfl-fantasy-league";
import {
  consumeInducement,
  consumeReroll,
  countAvailableRerolls,
  countRemainingInducementSlots,
  grantReroll,
  INDUCEMENT_SLOTS_PER_MATCHUP,
  listInducements,
  listRerolls,
  NflFantasyMercatoError,
  seedStartingRerolls,
} from "../services/nfl-fantasy-mercato";

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
  console.log("[mercato-e2e] start");

  const owner = "e2e-f-owner-" + Date.now();
  let leagueId = "";

  try {
    const lg = await createLeague({
      ownerId: owner,
      name: "Phase 2F E2E",
      teamName: "Mercato Mob",
      seasonId: "2025",
      size: 2,
    });
    leagueId = lg.id;
    const entryId = lg.entries[0]!.id;

    await step("seedStartingRerolls cree 8 rerolls", async () => {
      const out = await seedStartingRerolls({ entryId });
      if (out.rerollsSeeded !== 8) {
        throw new Error(`rerollsSeeded=${out.rerollsSeeded}`);
      }
      const remaining = await countAvailableRerolls(entryId);
      if (remaining !== 8) throw new Error(`remaining=${remaining}`);
    });

    await step("seedStartingRerolls idempotent", async () => {
      const out = await seedStartingRerolls({ entryId });
      if (out.rerollsSeeded !== 0) {
        throw new Error(`second seed=${out.rerollsSeeded}`);
      }
    });

    await step("grantReroll source=achievement", async () => {
      await grantReroll({ entryId, source: "achievement" });
      const remaining = await countAvailableRerolls(entryId);
      if (remaining !== 9) throw new Error(`remaining=${remaining}, attendu 9`);
    });

    await step("consumeReroll decremente disponible", async () => {
      const rerolls = await listRerolls({ entryId, used: false });
      const first = rerolls[0]!;
      await consumeReroll({
        rerollId: first.id,
        entryId,
        weekId: "2025:W10",
        matchupId: "m-fake",
        appliedTo: "player-fake",
      });
      const remaining = await countAvailableRerolls(entryId);
      if (remaining !== 8) throw new Error(`remaining=${remaining}`);
    });

    await step("consumeReroll rejet REROLL_ALREADY_USED", async () => {
      const used = await listRerolls({ entryId, used: true });
      try {
        await consumeReroll({
          rerollId: used[0]!.id,
          entryId,
          weekId: "2025:W10",
          matchupId: "m-fake",
        });
        throw new Error("aurait du throw");
      } catch (e) {
        if (
          !(e instanceof NflFantasyMercatoError) ||
          e.code !== "REROLL_ALREADY_USED"
        ) {
          throw new Error(`mauvais code: ${(e as Error).message}`);
        }
      }
    });

    await step("3 inducements consumes -> remaining = 0", async () => {
      for (let i = 0; i < INDUCEMENT_SLOTS_PER_MATCHUP; i++) {
        await consumeInducement({
          entryId,
          weekId: "2025:W10",
          matchupId: "m-fake",
          type: `inducement-${i}`,
          slot: i === 0 ? "defensive" : i === 1 ? "offensive" : "wildcard",
        });
      }
      const rem = await countRemainingInducementSlots({
        entryId,
        weekId: "2025:W10",
        matchupId: "m-fake",
      });
      if (rem !== 0) throw new Error(`remaining=${rem}, attendu 0`);
      const list = await listInducements({
        entryId,
        weekId: "2025:W10",
        matchupId: "m-fake",
      });
      if (list.length !== 3) throw new Error(`list.length=${list.length}`);
    });

    await step("4eme consumeInducement rejet INDUCEMENT_LIMIT_REACHED", async () => {
      try {
        await consumeInducement({
          entryId,
          weekId: "2025:W10",
          matchupId: "m-fake",
          type: "overflow",
        });
        throw new Error("aurait du throw");
      } catch (e) {
        if (
          !(e instanceof NflFantasyMercatoError) ||
          e.code !== "INDUCEMENT_LIMIT_REACHED"
        ) {
          throw new Error(`mauvais code: ${(e as Error).message}`);
        }
      }
    });

    await step("autre matchup : remaining = 3 (isole par matchup)", async () => {
      const rem = await countRemainingInducementSlots({
        entryId,
        weekId: "2025:W10",
        matchupId: "m-other",
      });
      if (rem !== 3) throw new Error(`remaining=${rem}, attendu 3`);
    });

    console.log("[mercato-e2e] all steps OK");
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
    console.error("[mercato-e2e] fatal:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
