/**
 * CLI du sync Star Players — wrapper autour du service
 * `seeders/sync-star-players.ts` (source de vérité de la logique).
 *
 * Contrairement à `seed.ts` (seed de DEV complet qui purge les skills, crée
 * user@example.com, des équipes/ligues démo et pose des overrides de feature
 * flags — DANGEREUX en prod), ce script ne touche QUE les tables StarPlayer /
 * StarPlayerSkill / StarPlayerHirableBy (+ création des lignes Skill
 * manquantes référencées par une fiche).
 *
 * Usage (depuis apps/server, ou via le conteneur serveur) :
 *   tsx src/scripts/sync-star-players.ts                        # DRY-RUN
 *   tsx src/scripts/sync-star-players.ts --write                # applique
 *   tsx src/scripts/sync-star-players.ts --slug=grombrindal --write
 *   tsx src/scripts/sync-star-players.ts --ruleset=all          # S2 + S3
 *   tsx src/scripts/sync-star-players.ts --write --snapshot=/tmp/before.json
 *
 * Le ruleset par défaut est `season_3` : les corrections « Legends 2025 » ne
 * concernent pas la Saison 2.
 *
 * `--snapshot=<fichier>` écrit l'état AVANT écriture (valeurs `from` de chaque
 * champ modifié) : c'est le filet de rollback.
 *
 * Le mode DRY-RUN est aussi le script de contrôle : après application, il doit
 * afficher « 0 écart ».
 */

import { writeFileSync } from "node:fs";
import { prisma } from "../prisma";
import {
  syncStarPlayers,
  type SyncStarPlayersOptions,
} from "../seeders/sync-star-players";

function parseArgs(argv: string[]): SyncStarPlayersOptions & {
  snapshot?: string;
} {
  const write = argv.includes("--write");
  const get = (k: string): string | undefined => {
    const hit = argv.find((a) => a.startsWith(`--${k}=`));
    return hit ? hit.slice(k.length + 3) : undefined;
  };
  return {
    write,
    ruleset: get("ruleset"),
    slug: get("slug"),
    snapshot: get("snapshot"),
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const mode = options.write ? "WRITE" : "DRY-RUN";
  console.log(`⭐ Sync Star Players (${mode})`);
  console.log(`   ruleset = ${options.ruleset ?? "season_3"}`);
  if (options.slug) console.log(`   filtre slug = ${options.slug}`);

  const result = await syncStarPlayers(options);

  for (const s of result.createdSkills) {
    console.log(
      `   🧩 skill ${s.slug} (${s.ruleset}) créé — "${s.nameFr}"` +
        (s.excludedFromSelection ? " [réservé star player]" : ""),
    );
  }

  for (const p of result.players) {
    if (p.action === "unchanged") continue;
    const alias = p.dbSlug !== p.slug ? ` (slug en base: ${p.dbSlug})` : "";
    console.log(`   ${p.action === "create" ? "✅" : "🔧"} ${p.slug}${alias} — ${p.displayName}`);
    for (const c of p.changes) {
      console.log(`      ${c.field}: ${JSON.stringify(c.from)} → ${JSON.stringify(c.to)}`);
    }
  }

  for (const m of result.missingSkills) {
    console.warn(
      `   ⚠️  skill ${m.skillSlug} introuvable (${m.ruleset}) pour ${m.starPlayerSlug} — lien ignoré`,
    );
  }

  if (options.snapshot) {
    const snapshot = result.players
      .filter((p) => p.changes.length > 0)
      .map((p) => ({
        slug: p.slug,
        dbSlug: p.dbSlug,
        ruleset: p.ruleset,
        before: Object.fromEntries(p.changes.map((c) => [c.field, c.from])),
      }));
    writeFileSync(options.snapshot, JSON.stringify(snapshot, null, 2), "utf8");
    console.log(`   💾 instantané de rollback écrit dans ${options.snapshot}`);
  }

  const drift = result.created + result.updated;
  console.log(
    `\n${options.write ? "Appliqué" : "Écarts détectés"} : ${result.created} création(s), ` +
      `${result.updated} mise(s) à jour, ${result.unchanged} déjà conforme(s).`,
  );
  if (!options.write) {
    console.log(
      drift === 0
        ? "✅ 0 écart entre le code et la base."
        : `ℹ️  ${drift} fiche(s) à corriger — relancer avec --write.`,
    );
  }
}

main()
  .catch((error) => {
    console.error("❌ Sync Star Players échoué :", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
