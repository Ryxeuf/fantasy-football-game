/**
 * Script de migration pour convertir les compétences des joueurs
 * des noms anglais vers les slugs
 * 
 * Usage: node migrate-skills-to-slugs.js
 */

const { PrismaClient } = require("@prisma/client");
const { convertNamesToSlugs } = require("@bb/game-engine");

const prisma = new PrismaClient();

async function migrateSkillsToSlugs() {
  console.log("🔄 Début de la migration des compétences vers les slugs...\n");

  try {
    // Récupérer tous les joueurs
    const players = await prisma.teamPlayer.findMany({
      select: {
        id: true,
        name: true,
        position: true,
        skills: true,
      },
    });

    console.log(`📊 ${players.length} joueurs trouvés\n`);

    let migratedCount = 0;
    let unchangedCount = 0;
    let errorCount = 0;

    for (const player of players) {
      try {
        const oldSkills = player.skills || "";
        
        // Ignorer les joueurs sans compétences
        if (!oldSkills || oldSkills.trim() === "") {
          unchangedCount++;
          continue;
        }

        // Vérifier si ce sont déjà des slugs (contiennent des tirets)
        const hasHyphens = oldSkills.includes("-");
        const hasCommasWithoutSpaces = oldSkills.includes(",") && !oldSkills.includes(", ");
        
        if (hasHyphens || hasCommasWithoutSpaces) {
          // Probablement déjà des slugs
          console.log(`⏭️  Joueur ${player.name} (${player.position}): déjà migré`);
          unchangedCount++;
          continue;
        }

        // Convertir les noms vers les slugs
        const newSkills = convertNamesToSlugs(oldSkills);

        // Si pas de changement, ignorer
        if (oldSkills === newSkills) {
          unchangedCount++;
          continue;
        }

        // Mettre à jour en base de données
        await prisma.teamPlayer.update({
          where: { id: player.id },
          data: { skills: newSkills },
        });

        console.log(`✅ Joueur ${player.name} (${player.position}):`);
        console.log(`   Avant: "${oldSkills}"`);
        console.log(`   Après: "${newSkills}"\n`);
        
        migratedCount++;
      } catch (error) {
        console.error(`❌ Erreur pour le joueur ${player.name}:`, error.message);
        errorCount++;
      }
    }

    console.log("\n📈 Résumé de la migration:");
    console.log(`   ✅ Joueurs migrés: ${migratedCount}`);
    console.log(`   ⏭️  Joueurs inchangés: ${unchangedCount}`);
    console.log(`   ❌ Erreurs: ${errorCount}`);
    console.log(`   📊 Total: ${players.length}`);

    if (migratedCount > 0) {
      console.log("\n✨ Migration terminée avec succès !");
    } else {
      console.log("\nℹ️  Aucune migration nécessaire, tous les joueurs sont déjà à jour.");
    }
  } catch (error) {
    console.error("\n❌ Erreur fatale lors de la migration:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter la migration
if (require.main === module) {
  migrateSkillsToSlugs()
    .then(() => {
      console.log("\n✅ Script terminé");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Le script a échoué:", error);
      process.exit(1);
    });
}

module.exports = { migrateSkillsToSlugs };

