/**
 * Script pour vérifier la cohérence des rulesets dans la base
 */

import { prisma } from "../prisma";
import { serverLog } from "../utils/server-log";

async function main() {
  serverLog.log("🔍 Vérification de la cohérence des rulesets...\n");

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
    serverLog.log(`❌ ${rostersWithoutRuleset.length} rosters SANS ruleset trouvés:`);
    rostersWithoutRuleset.forEach((r: any) => {
      serverLog.log(`   - ${r.name} (${r.slug}) - ID: ${r.id}`);
    });
    serverLog.log();
  } else {
    serverLog.log("✅ Tous les rosters ont un ruleset défini\n");
  }

  // 2. Compter les rosters par ruleset
  const rosterStats = await prisma.roster.groupBy({
    by: ["ruleset"],
    _count: true,
  });

  serverLog.log("📊 Répartition des rosters par ruleset:");
  rosterStats.forEach((stat: any) => {
    serverLog.log(`   - ${stat.ruleset}: ${stat._count} rosters`);
  });
  serverLog.log();

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

  serverLog.log("📊 Répartition des positions par ruleset (via leur roster):");
  Object.entries(positionsByRuleset).forEach(([ruleset, count]) => {
    serverLog.log(`   - ${ruleset}: ${count} positions`);
  });
  serverLog.log();

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
    serverLog.log(
      `⚠️  ${teamsWithoutRuleset.length} équipes SANS ruleset (devrait être season_3 par défaut)`
    );
    teamsWithoutRuleset.slice(0, 5).forEach((t: any) => {
      serverLog.log(`   - ${t.name} (ID: ${t.id})`);
    });
    if (teamsWithoutRuleset.length > 5) {
      serverLog.log(`   ... et ${teamsWithoutRuleset.length - 5} autres`);
    }
  } else {
    serverLog.log("✅ Toutes les équipes ont un ruleset défini");
  }

  const teamStats = await prisma.team.groupBy({
    by: ["ruleset"],
    _count: true,
  });

  serverLog.log("\n📊 Répartition des équipes par ruleset:");
  teamStats.forEach((stat: any) => {
    serverLog.log(`   - ${stat.ruleset}: ${stat._count} équipes`);
  });
  serverLog.log();

  serverLog.log("✅ Vérification terminée!");
}

main()
  .catch((e) => {
    serverLog.error("❌ Erreur:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

