/**
 * CLI du sync roster (positions only) — wrapper autour du service
 * `seeders/sync-rosters.ts` (source de vérité de la logique).
 *
 * Contrairement à `seed.ts` (seed de DEV complet qui purge les skills,
 * crée user@example.com, des équipes/ligues démo et pose des overrides de
 * feature flags — DANGEREUX en prod), ce script ne touche QUE les tables
 * Roster / Position / PositionSkill.
 *
 * Même logique disponible via le bouton admin (POST /admin/utilities/
 * sync-rosters). Voir `seeders/sync-rosters.ts` pour les garanties de
 * sûreté référentielle.
 *
 * Usage (depuis apps/server, ou via le conteneur serveur) :
 *   tsx src/scripts/sync-rosters.ts                       # DRY-RUN (rapport)
 *   tsx src/scripts/sync-rosters.ts --write               # applique
 *   tsx src/scripts/sync-rosters.ts --ruleset=season_3 --roster=high_elf --write
 */

import { prisma } from "../prisma";
import { syncRosters, type SyncRostersOptions } from "../seeders/sync-rosters";

function parseArgs(argv: string[]): SyncRostersOptions {
  const write = argv.includes("--write");
  const get = (k: string): string | undefined => {
    const hit = argv.find((a) => a.startsWith(`--${k}=`));
    return hit ? hit.split("=")[1] : undefined;
  };
  return { write, ruleset: get("ruleset"), roster: get("roster") };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const mode = options.write ? "WRITE" : "DRY-RUN";
  console.log(`🔄 Sync rosters (${mode})`);
  if (options.ruleset) console.log(`   filtre ruleset = ${options.ruleset}`);
  if (options.roster) console.log(`   filtre roster  = ${options.roster}`);

  const result = await syncRosters(options);

  for (const r of result.missingRosters) {
    console.warn(
      `⚠️  Roster ${r.roster} (${r.ruleset}) absent en base — ignoré (lancer le seed initial d'abord).`,
    );
  }
  for (const p of result.prunedPositions) {
    console.log(
      `   🗑️  prune ${p.roster}/${p.ruleset} : ${p.displayName} (${p.slug})`,
    );
  }
  for (const u of result.upsertedPositions) {
    console.log(`   ✅ ${u.action} ${u.slug} → "${u.displayName}"`);
  }
  for (const m of result.missingSkills) {
    console.warn(
      `   ⚠️  skill ${m.skillSlug} introuvable (${m.ruleset}) pour ${m.positionSlug}`,
    );
  }

  console.log(
    `\n${result.write ? "✅ Appliqué" : "ℹ️  Dry-run"} : ${result.upserted} positions upsert, ${result.pruned} purgées, ${result.skillLinks} liens de compétence.`,
  );
  if (!result.write) {
    console.log("   (Relancer avec --write pour appliquer.)");
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ sync-rosters a échoué:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
