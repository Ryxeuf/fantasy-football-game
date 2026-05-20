/**
 * E2E Phase 2.H : exerce les ticks crons sur la DB Postgres reelle.
 *   pnpm exec tsx src/scripts/nfl-fantasy-cron-e2e.ts
 *
 * Lance chaque tick avec `force=true` pour valider le wiring +
 * cible une "wrong window" date pour verifier le skip.
 */

import { prisma } from "../prisma";
import {
  espnGamedayTick,
  isLockLineupsWindow,
  isNflGameday,
  isNflverseDailyWindow,
  isSettleWindow,
  lockLineupsTick,
  nflFantasyOrchestratorTick,
  nflverseIngestTick,
  settleWeekTick,
} from "../services/nfl-fantasy-cron";

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
  console.log("[cron-e2e] start");

  // 1. Helpers purs sur dates connues (sanity check inline)
  await step("helpers purs verifient les fenetres", async () => {
    if (!isNflverseDailyWindow(new Date("2025-11-09T03:00:00Z"))) {
      throw new Error("isNflverseDailyWindow false at 03h");
    }
    if (isNflverseDailyWindow(new Date("2025-11-09T12:00:00Z"))) {
      throw new Error("isNflverseDailyWindow true outside 03h");
    }
    if (!isNflGameday(new Date("2025-11-09T18:00:00Z"))) {
      throw new Error("isNflGameday false dimanche");
    }
    if (!isLockLineupsWindow(new Date("2025-11-09T17:00:00Z"))) {
      throw new Error("isLockLineupsWindow false dim 17h");
    }
    if (!isSettleWindow(new Date("2025-11-11T12:00:00Z"))) {
      throw new Error("isSettleWindow false mar 12h");
    }
  });

  // 2. Out-of-window orchestrator -> tout false
  await step("orchestrator hors fenetre : 0 ticks", async () => {
    const out = await nflFantasyOrchestratorTick({
      now: new Date("2025-11-12T20:00:00Z"), // mercredi 20h, aucune fenetre
    });
    if (out.nflverse.ran || out.lock.ran || out.settle.ran) {
      throw new Error("ticks fire hors fenetre");
    }
    // ESPN reste false aussi (mercredi != gameday)
    if (out.espn.ran) {
      throw new Error("espn fire mercredi");
    }
  });

  // 3. force=true sur chaque tick
  await step("nflverseIngestTick force=true s'execute", async () => {
    const out = await nflverseIngestTick({
      now: new Date("2025-11-09T12:00:00Z"),
      force: true,
    });
    if (!out.ran) throw new Error(`ran=false : ${out.reason}`);
    // Detail attendu : objet IngestResult (succes ou ingest_failed sur
    // network temporaire ; on tolere les deux)
  });

  await step("espnGamedayTick force=true s'execute", async () => {
    const out = await espnGamedayTick({
      now: new Date("2025-11-12T20:00:00Z"),
      force: true,
    });
    if (!out.ran) throw new Error(`ran=false : ${out.reason}`);
  });

  await step("lockLineupsTick force=true (idempotent, deja lockees)", async () => {
    const out = await lockLineupsTick({
      now: new Date("2025-11-12T20:00:00Z"),
      force: true,
    });
    if (!out.ran) throw new Error(`ran=false : ${out.reason}`);
    // W10 a deja ete lockee par l'E2E Phase 2.D -> locked = 0 attendu
  });

  await step("settleWeekTick force=true (aucune league in_progress)", async () => {
    const out = await settleWeekTick({
      now: new Date("2025-11-12T20:00:00Z"),
      force: true,
    });
    if (!out.ran) throw new Error(`ran=false : ${out.reason}`);
    const detail = out.detail as { leaguesProcessed: number };
    if (typeof detail.leaguesProcessed !== "number") {
      throw new Error("detail mal forme");
    }
  });

  await step("orchestratorTick force-equivalent via dates synthetiques", async () => {
    // On utilise une vraie fenetre nflverse (03h UTC) sur un mardi
    // (pas gameday) — verifie qu'une seule case fire.
    const out = await nflFantasyOrchestratorTick({
      now: new Date("2025-11-11T03:00:00Z"), // mardi 03h
    });
    if (!out.nflverse.ran) throw new Error("nflverse aurait du fire");
    if (out.espn.ran) throw new Error("espn ne devrait pas fire mardi");
    if (out.lock.ran) throw new Error("lock ne devrait pas fire mardi 03h");
    if (out.settle.ran) throw new Error("settle ne devrait pas fire a 03h");
  });

  console.log("[cron-e2e] all steps OK");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("[cron-e2e] fatal:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
