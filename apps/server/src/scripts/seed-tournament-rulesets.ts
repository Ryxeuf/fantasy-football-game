/**
 * Seed / backfill du modèle `TournamentRuleset` (règlements de tournoi
 * éditables en admin). Pour chaque pack du registre statique
 * `@bb/game-engine` (`TOURNAMENT_RULESETS`, ex : NAF World Cup 2027), crée
 * la ligne manquante via `serializeDefinitionForDb` → iso-comportement
 * après la bascule DB.
 *
 * **Create-only** : un slug déjà présent n'est JAMAIS réécrit (les éditions
 * admin sont préservées). Idempotent.
 *
 * Usage :
 *   tsx src/scripts/seed-tournament-rulesets.ts            # applique
 *   tsx src/scripts/seed-tournament-rulesets.ts --dry-run  # simule
 * Aussi appelé par le seed principal (`seed.ts`).
 */

import type { PrismaClient } from "@prisma/client";
import { prisma } from "../prisma";
import { serverLog } from "../utils/server-log";
import { TOURNAMENT_RULESETS } from "@bb/game-engine";
import { serializeDefinitionForDb } from "../services/tournament-ruleset-repository";

export interface SeedTournamentRulesetsResult {
  packs: number;
  created: number;
  skipped: number;
}

/**
 * Crée les `TournamentRuleset` manquants depuis le registre statique.
 * Ne touche pas les lignes existantes (valeurs admin préservées).
 */
export async function seedTournamentRulesets(
  db: Pick<PrismaClient, "tournamentRuleset"> = prisma,
): Promise<SeedTournamentRulesetsResult> {
  const defs = Object.values(TOURNAMENT_RULESETS);
  let created = 0;
  let skipped = 0;

  for (const def of defs) {
    const existing = await db.tournamentRuleset.findUnique({
      where: { slug: def.slug },
      select: { id: true },
    });
    if (existing) {
      skipped += 1;
      continue;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.tournamentRuleset.create({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: serializeDefinitionForDb(def) as any,
    });
    created += 1;
  }

  return { packs: defs.length, created, skipped };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  serverLog.log(`🌱 Seed TournamentRuleset${dryRun ? " (DRY-RUN)" : ""}…\n`);

  if (dryRun) {
    let missing = 0;
    for (const def of Object.values(TOURNAMENT_RULESETS)) {
      const existing = await prisma.tournamentRuleset.findUnique({
        where: { slug: def.slug },
        select: { id: true },
      });
      if (!existing) missing += 1;
    }
    serverLog.log(
      `À créer : ${missing} règlement(s) sur ${Object.keys(TOURNAMENT_RULESETS).length}.`,
    );
    return;
  }

  const res = await seedTournamentRulesets();
  serverLog.log(
    `✅ Règlements de tournoi=${res.packs} — créés=${res.created}, déjà présents=${res.skipped}.`,
  );
}

// Exécution directe en CLI uniquement (pas quand importé par seed.ts).
const invokedDirectly =
  process.argv[1]?.includes("seed-tournament-rulesets") ?? false;
if (invokedDirectly) {
  main()
    .catch((e) => {
      serverLog.error("❌ Erreur:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
