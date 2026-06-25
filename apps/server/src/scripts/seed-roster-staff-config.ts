/**
 * Seed / backfill du modèle `RosterStaffConfig` (config staff par roster ×
 * format). Pour chaque Roster × {bb11, sevens}, crée la ligne manquante à
 * partir de `defaultStaffConfig` (dérivé des constantes historiques) →
 * iso-comportement après la bascule DB.
 *
 * **Create-only** : `update: {}` garantit qu'un re-run NE réécrit PAS les
 * valeurs déjà éditées en admin. Idempotent.
 *
 * Usage :
 *   tsx src/scripts/seed-roster-staff-config.ts            # applique
 *   tsx src/scripts/seed-roster-staff-config.ts --dry-run  # simule
 * Aussi appelé par le seed principal (`seed.ts`).
 */

import type { PrismaClient } from "@prisma/client";
import { prisma } from "../prisma";
import { serverLog } from "../utils/server-log";
import { defaultStaffConfig, FORMATS } from "@bb/game-engine";

export interface SeedStaffResult {
  rosters: number;
  created: number;
  skipped: number;
}

/**
 * Crée les `RosterStaffConfig` manquantes pour tous les rosters et formats.
 * Ne touche pas les lignes existantes (valeurs admin préservées).
 */
export async function seedRosterStaffConfigs(
  db: Pick<PrismaClient, "roster" | "rosterStaffConfig"> = prisma,
): Promise<SeedStaffResult> {
  const rosters = await db.roster.findMany({ select: { id: true, slug: true } });
  let created = 0;
  let skipped = 0;

  for (const roster of rosters) {
    for (const format of FORMATS) {
      const existing = await db.rosterStaffConfig.findUnique({
        where: { rosterId_format: { rosterId: roster.id, format } },
        select: { id: true },
      });
      if (existing) {
        skipped += 1;
        continue;
      }
      const cfg = defaultStaffConfig(roster.slug, format);
      await db.rosterStaffConfig.create({
        data: { rosterId: roster.id, format, ...cfg },
      });
      created += 1;
    }
  }

  return { rosters: rosters.length, created, skipped };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  serverLog.log(
    `🌱 Seed RosterStaffConfig${dryRun ? " (DRY-RUN)" : ""}…\n`,
  );

  const rosters = await prisma.roster.findMany({ select: { id: true, slug: true } });
  if (dryRun) {
    let missing = 0;
    for (const roster of rosters) {
      for (const format of FORMATS) {
        const existing = await prisma.rosterStaffConfig.findUnique({
          where: { rosterId_format: { rosterId: roster.id, format } },
          select: { id: true },
        });
        if (!existing) missing += 1;
      }
    }
    serverLog.log(
      `À créer : ${missing} ligne(s) sur ${rosters.length * FORMATS.length} (rosters=${rosters.length} × formats=${FORMATS.length}).`,
    );
    return;
  }

  const res = await seedRosterStaffConfigs();
  serverLog.log(
    `✅ Rosters=${res.rosters} — créées=${res.created}, déjà présentes=${res.skipped}.`,
  );
}

// Exécution directe en CLI uniquement (pas quand importé par seed.ts).
const invokedDirectly =
  process.argv[1]?.includes("seed-roster-staff-config") ?? false;
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
