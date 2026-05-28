/**
 * Backfill : remplit `NflPlayer.bbStats` et `bbSkills` pour tous les joueurs
 * existants (ingest initialisait à `{}`/`[]`). Dérivation via
 * `deriveBbAttributes(race, bbPosition)` côté serveur.
 *
 * Sécurités :
 *  - DRY-RUN par défaut. Passer `--write` pour appliquer.
 *  - Ne touche pas les joueurs dont la combinaison (race, bbPosition) n'est
 *    pas mappée -> laissés tels quels (log).
 *  - Idempotent : ré-exécution = même résultat.
 *
 * Usage :
 *   tsx scripts/backfill-nfl-bb-attributes.ts          # rapport (dry-run)
 *   tsx scripts/backfill-nfl-bb-attributes.ts --write  # applique
 */

import { PrismaClient } from "@prisma/client";
import type { BbPosition, BbRace } from "@bb/nfl-mapper";
import { deriveBbAttributes } from "../apps/server/src/services/nfl-bb-derivation";

const prisma = new PrismaClient();
const WRITE = process.argv.includes("--write");

interface BackfillCounters {
  total: number;
  derived: number;
  skipped_no_team: number;
  skipped_no_mapping: number;
  updated: number;
}

async function main(): Promise<void> {
  const counters: BackfillCounters = {
    total: 0,
    derived: 0,
    skipped_no_team: 0,
    skipped_no_mapping: 0,
    updated: 0,
  };
  const unmappedExamples = new Map<string, string>(); // "Race/Pos" -> playerId

  // On lit en streaming via cursor pour éviter de charger les 4565 d'un coup.
  // Pour la taille actuelle, findMany direct est OK mais le cursor pattern
  // reste sain si la table grossit.
  const players = await prisma.nflPlayer.findMany({
    select: {
      id: true,
      teamCode: true,
      bbPosition: true,
      team: { select: { bbRace: true } },
    },
  });
  counters.total = players.length;

  for (const p of players) {
    if (!p.team) {
      counters.skipped_no_team++;
      continue;
    }
    const derived = deriveBbAttributes(
      p.team.bbRace as BbRace,
      p.bbPosition as BbPosition,
    );
    if (!derived) {
      counters.skipped_no_mapping++;
      const key = `${p.team.bbRace}/${p.bbPosition}`;
      if (!unmappedExamples.has(key)) unmappedExamples.set(key, p.id);
      continue;
    }
    counters.derived++;
    if (WRITE) {
      await prisma.nflPlayer.update({
        where: { id: p.id },
        data: {
          bbStats: derived.stats,
          bbSkills: [...derived.skills],
        },
      });
      counters.updated++;
    }
  }

  console.log("=== Backfill bbStats/bbSkills ===");
  console.log(`Total joueurs       : ${counters.total}`);
  console.log(`Dérivés (mappés)    : ${counters.derived}`);
  console.log(`Skip (sans équipe)  : ${counters.skipped_no_team}`);
  console.log(`Skip (combo non mappée) : ${counters.skipped_no_mapping}`);
  console.log(`Updates écrits      : ${counters.updated}`);
  if (unmappedExamples.size) {
    console.log("\nCombinaisons non mappées (1 ex. par cas) :");
    for (const [key, id] of unmappedExamples) {
      console.log(`  ${key.padEnd(28)} ex: ${id}`);
    }
  }
  if (!WRITE) {
    console.log("\n(dry-run — relancer avec --write pour appliquer)");
  }
}

main()
  .catch((e) => {
    console.error("ERREUR:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
