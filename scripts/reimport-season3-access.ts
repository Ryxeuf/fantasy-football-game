/**
 * Réimporte les accès Primaire/Secondaire (dont Sournoiserie/Scélérates) sur
 * toutes les positions season_3 en base, depuis SKILL_ACCESS_SEASON3.
 *
 * À lancer dans le conteneur serveur (DB accessible) :
 *   docker compose exec server npx tsx scripts/reimport-season3-access.ts
 *
 * Idempotent. Régénérer d'abord la source si besoin :
 *   npx tsx scripts/generate-skill-access-season3.ts --write
 */

import { reimportSeason3SkillAccess } from "../apps/server/src/seeders/season3-skill-access";
import { prisma } from "../apps/server/src/prisma";

async function main(): Promise<void> {
  const r = await reimportSeason3SkillAccess();
  console.log(`Rosters season_3 : ${r.rosters}`);
  console.log(`Positions mises à jour : ${r.updated}/${r.positionsTotal}`);
  if (r.missing.length) {
    console.log(
      `Positions sans données d'accès (${r.missing.length}) : ${r.missing.join(", ")}`,
    );
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
