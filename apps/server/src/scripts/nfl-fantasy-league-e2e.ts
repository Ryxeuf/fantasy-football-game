/**
 * Script E2E pour valider Phase 2.C sur la DB Postgres reelle.
 * Volontairement non-idempotent : cleanup en fin de run.
 *
 *   pnpm exec tsx src/scripts/nfl-fantasy-league-e2e.ts
 */

import { prisma } from "../prisma";
import {
  createLeague,
  deleteLeague,
  getLeague,
  joinLeague,
  leaveLeague,
  listLeaguesForUser,
  NflFantasyLeagueError,
  updateLeague,
} from "../services/nfl-fantasy-league";

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
  console.log("[fantasy-league-e2e] start");

  // Pre-requis : la saison 2025 doit exister (seedee Phase 2.A)
  const season = await prisma.nflSeason.findUnique({ where: { id: "2025" } });
  if (!season) {
    throw new Error("Saison 2025 absente. Lancer seed-season 2025 d'abord.");
  }

  // IDs simulant des users (pas de FK explicite, donc on ne touche pas a la
  // table User pour eviter d'avoir a insert / cleanup un user reel)
  const owner = "e2e-owner-" + Date.now();
  const member = "e2e-member-" + Date.now();
  let createdLeagueId = "";
  let createdInviteCode = "";

  try {
    await step("createLeague (private)", async () => {
      const lg = await createLeague({
        ownerId: owner,
        name: "Phase 2C E2E League",
        teamName: "Owner Stompers",
        seasonId: "2025",
      });
      createdLeagueId = lg.id;
      createdInviteCode = lg.inviteCode ?? "";
      if (!lg.inviteCode) throw new Error("inviteCode null pour private");
      if (lg.entries.length !== 1) throw new Error("owner entry manquante");
      if (lg.size !== 10) throw new Error("size default != 10");
      if (lg.draftMode !== "snake") throw new Error("draftMode default != snake");
    });

    await step("getLeague", async () => {
      const lg = await getLeague(createdLeagueId);
      if (lg.entries.length !== 1) throw new Error("entries.length != 1");
    });

    await step("joinLeague via inviteCode", async () => {
      const entry = await joinLeague({
        userId: member,
        teamName: "Member Mob",
        inviteCode: createdInviteCode,
      });
      if (entry.leagueId !== createdLeagueId) {
        throw new Error("leagueId mismatch");
      }
    });

    await step("getLeague apres join (2 entries)", async () => {
      const lg = await getLeague(createdLeagueId);
      if (lg.entries.length !== 2) {
        throw new Error(`entries.length=${lg.entries.length}, attendu 2`);
      }
    });

    await step("listLeaguesForUser pour member", async () => {
      const list = await listLeaguesForUser(member);
      if (!list.some((l) => l.id === createdLeagueId)) {
        throw new Error("league absente de la liste du member");
      }
    });

    await step("joinLeague rejet ALREADY_JOINED", async () => {
      try {
        await joinLeague({
          userId: member,
          teamName: "Dup",
          inviteCode: createdInviteCode,
        });
        throw new Error("aurait du throw ALREADY_JOINED");
      } catch (e) {
        if (
          !(e instanceof NflFantasyLeagueError) ||
          e.code !== "ALREADY_JOINED"
        ) {
          throw new Error(
            `mauvaise erreur : ${(e as Error).message}`,
          );
        }
      }
    });

    await step("updateLeague rename", async () => {
      const updated = await updateLeague({
        leagueId: createdLeagueId,
        userId: owner,
        name: "Phase 2C E2E Renamed",
      });
      if (updated.name !== "Phase 2C E2E Renamed") {
        throw new Error("rename non applique");
      }
    });

    await step("updateLeague pivot public", async () => {
      const updated = await updateLeague({
        leagueId: createdLeagueId,
        userId: owner,
        type: "public",
      });
      if (updated.type !== "public") throw new Error("type non passe public");
      if (updated.inviteCode !== null) {
        throw new Error("inviteCode aurait du etre efface");
      }
    });

    await step("leaveLeague member", async () => {
      await leaveLeague({ leagueId: createdLeagueId, userId: member });
      const lg = await getLeague(createdLeagueId);
      if (lg.entries.length !== 1) {
        throw new Error(`entries.length=${lg.entries.length}, attendu 1`);
      }
    });

    await step("deleteLeague owner", async () => {
      await deleteLeague({ leagueId: createdLeagueId, userId: owner });
      try {
        await getLeague(createdLeagueId);
        throw new Error("league aurait du etre supprimee");
      } catch (e) {
        if (
          !(e instanceof NflFantasyLeagueError) ||
          e.code !== "NOT_FOUND"
        ) {
          throw new Error(`mauvaise erreur : ${(e as Error).message}`);
        }
      }
      createdLeagueId = ""; // evite double-cleanup en fin
    });

    console.log("[fantasy-league-e2e] all steps OK");
  } finally {
    if (createdLeagueId) {
      // Cleanup defensif si un step a echoue
      await prisma.nflFantasyLeague
        .delete({ where: { id: createdLeagueId } })
        .catch(() => undefined);
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("[fantasy-league-e2e] fatal:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
