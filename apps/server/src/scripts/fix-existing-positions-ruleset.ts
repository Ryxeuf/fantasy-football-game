/**
 * Script pour mettre à jour le ruleset de toutes les positions existantes
 * Les positions doivent avoir le même ruleset que leur roster parent
 */

import { prisma } from "../prisma";

async function main() {
  console.log("🔧 Début de la correction des rulesets des positions...\n");

  // Récupérer tous les rosters avec leur ruleset
  const rosters = await prisma.roster.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      ruleset: true,
    },
  });

  console.log(`📊 Nombre de rosters trouvés: ${rosters.length}\n`);

  let totalUpdated = 0;

  for (const roster of rosters) {
    // Compter les positions pour ce roster
    const positionCount = await prisma.position.count({
      where: { rosterId: roster.id },
    });

    if (positionCount > 0) {
      console.log(
        `📝 Roster: ${roster.name} (${roster.slug}) - Ruleset: ${roster.ruleset} - ${positionCount} positions`
      );
      totalUpdated += positionCount;
    }
  }

  console.log(`\n✅ Total de positions vérifiées: ${totalUpdated}`);
  console.log(
    "\nℹ️  Note: Les positions héritent automatiquement du ruleset de leur roster via la relation."
  );
  console.log(
    "Si vous voyez 'Ruleset: Inconnu' dans l'UI, vérifiez que le roster a bien un ruleset défini."
  );
}

main()
  .catch((e) => {
    console.error("❌ Erreur:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

