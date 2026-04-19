/**
 * Script pour vérifier la cohérence des rulesets dans la base
 */

import { prisma } from "../prisma";

async function main() {
  console.log("🔍 Vérification de la cohérence des rulesets...\n");

  // 1. Vérifier que tous les rosters ont un ruleset (pas de null)
  const allRosters = await prisma.roster.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      ruleset: true,
    },
  });

  const rostersWithoutRuleset = allRosters.filter((r: any) => !r.ruleset);

  if (rostersWithoutRuleset.length > 0) {
    console.log(`❌ ${rostersWithoutRuleset.length} rosters SANS ruleset trouvés:`);
    rostersWithoutRuleset.forEach((r: any) => {
      console.log(`   - ${r.name} (${r.slug}) - ID: ${r.id}`);
    });
    console.log();
  } else {
    console.log("✅ Tous les rosters ont un ruleset défini\n");
  }

  // 2. Compter les rosters par ruleset
  const rosterStats = await prisma.roster.groupBy({
    by: ["ruleset"],
    _count: true,
  });

  console.log("📊 Répartition des rosters par ruleset:");
  rosterStats.forEach((stat: any) => {
    console.log(`   - ${stat.ruleset}: ${stat._count} rosters`);
  });
  console.log();

  // 3. Compter les positions par ruleset de leur roster
  const positionStats = await prisma.position.findMany({
    select: {
      roster: {
        select: {
          ruleset: true,
        },
      },
    },
  });

  const positionsByRuleset: Record<string, number> = {};
  positionStats.forEach((pos: any) => {
    const ruleset = pos.roster.ruleset || "inconnu";
    positionsByRuleset[ruleset] = (positionsByRuleset[ruleset] || 0) + 1;
  });

  console.log("📊 Répartition des positions par ruleset (via leur roster):");
  Object.entries(positionsByRuleset).forEach(([ruleset, count]) => {
    console.log(`   - ${ruleset}: ${count} positions`);
  });
  console.log();

  // 4. Vérifier les équipes sans ruleset
  const allTeams = await prisma.team.findMany({
    select: {
      id: true,
      name: true,
      ruleset: true,
    },
  });

  const teamsWithoutRuleset = allTeams.filter((t: any) => !t.ruleset);

  if (teamsWithoutRuleset.length > 0) {
    console.log(
      `⚠️  ${teamsWithoutRuleset.length} équipes SANS ruleset (devrait être season_3 par défaut)`
    );
    teamsWithoutRuleset.slice(0, 5).forEach((t: any) => {
      console.log(`   - ${t.name} (ID: ${t.id})`);
    });
    if (teamsWithoutRuleset.length > 5) {
      console.log(`   ... et ${teamsWithoutRuleset.length - 5} autres`);
    }
  } else {
    console.log("✅ Toutes les équipes ont un ruleset défini");
  }

  const teamStats = await prisma.team.groupBy({
    by: ["ruleset"],
    _count: true,
  });

  console.log("\n📊 Répartition des équipes par ruleset:");
  teamStats.forEach((stat: any) => {
    console.log(`   - ${stat.ruleset}: ${stat._count} équipes`);
  });
  console.log();

  console.log("✅ Vérification terminée!");
}

main()
  .catch((e) => {
    console.error("❌ Erreur:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

