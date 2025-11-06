/**
 * Script de migration pour importer toutes les données statiques en base de données
 * 
 * Ce script importe :
 * - Toutes les compétences (Skills)
 * - Tous les rosters (Rosters)
 * - Toutes les positions (Positions)
 * - Tous les Star Players (StarPlayers)
 * - Toutes les relations entre ces entités
 */

import { PrismaClient } from '@prisma/client';
import { SKILLS_DEFINITIONS } from '../../packages/game-engine/src/skills/index';
import { TEAM_ROSTERS } from '../../packages/game-engine/src/rosters/positions';
import { STAR_PLAYERS } from '../../packages/game-engine/src/rosters/star-players';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Début de la migration des données statiques vers la base de données...\n');

  // 1. Migrer les compétences (Skills)
  console.log('📚 Migration des compétences...');
  let skillsCreated = 0;
  let skillsUpdated = 0;
  
  for (const skillDef of SKILLS_DEFINITIONS) {
    try {
      const existing = await prisma.skill.findUnique({
        where: { slug: skillDef.slug }
      });

      if (existing) {
        await prisma.skill.update({
          where: { slug: skillDef.slug },
          data: {
            nameFr: skillDef.nameFr,
            nameEn: skillDef.nameEn,
            description: skillDef.description,
            category: skillDef.category,
          }
        });
        skillsUpdated++;
      } else {
        await prisma.skill.create({
          data: {
            slug: skillDef.slug,
            nameFr: skillDef.nameFr,
            nameEn: skillDef.nameEn,
            description: skillDef.description,
            category: skillDef.category,
          }
        });
        skillsCreated++;
      }
    } catch (error) {
      console.error(`❌ Erreur lors de la migration de la compétence ${skillDef.slug}:`, error);
    }
  }
  console.log(`✅ Compétences: ${skillsCreated} créées, ${skillsUpdated} mises à jour\n`);

  // 2. Migrer les rosters
  console.log('🏈 Migration des rosters...');
  let rostersCreated = 0;
  let rostersUpdated = 0;
  
  // Mapping des noms en anglais pour chaque roster
  const rosterNamesEn: Record<string, string> = {
    skaven: "Skaven",
    lizardmen: "Lizardmen",
    wood_elf: "Wood Elf",
    dark_elf: "Dark Elf",
    dwarf: "Dwarf",
    goblin: "Goblin",
    undead: "Undead",
    chaos_renegade: "Chaos Renegades",
    ogre: "Ogre",
    halfling: "Halfling",
    underworld: "Underworld Denizens",
    chaos_chosen: "Chaos",
    imperial_nobility: "Imperial Nobility",
    necromantic_horror: "Necromantic Horror",
    orc: "Orc",
    nurgle: "Nurgle",
    old_world_alliance: "Old World Alliance",
    elven_union: "Elven Union",
    human: "Human",
    black_orc: "Black Orc",
    chaos_dwarf: "Chaos Dwarf",
    slann: "Slann",
    amazon: "Amazon",
    high_elf: "High Elf",
    khorne: "Khorne",
    vampire: "Vampire",
    tomb_kings: "Tomb Kings",
    gnome: "Gnome",
    norse: "Norse",
    snotling: "Snotling",
  };
  
  for (const [slug, rosterDef] of Object.entries(TEAM_ROSTERS)) {
    try {
      const existing = await prisma.roster.findUnique({
        where: { slug }
      });

      const nameEn = rosterNamesEn[slug] || rosterDef.name; // Fallback sur le nom français si pas de traduction

      if (existing) {
        await prisma.roster.update({
          where: { slug },
          data: {
            name: rosterDef.name,
            nameEn: nameEn,
            budget: rosterDef.budget,
            tier: rosterDef.tier,
            naf: rosterDef.naf,
          }
        });
        rostersUpdated++;
      } else {
        await prisma.roster.create({
          data: {
            slug,
            name: rosterDef.name,
            nameEn: nameEn,
            budget: rosterDef.budget,
            tier: rosterDef.tier,
            naf: rosterDef.naf,
          }
        });
        rostersCreated++;
      }
    } catch (error) {
      console.error(`❌ Erreur lors de la migration du roster ${slug}:`, error);
    }
  }
  console.log(`✅ Rosters: ${rostersCreated} créés, ${rostersUpdated} mis à jour\n`);

  // 3. Migrer les positions et leurs relations avec les compétences
  console.log('👥 Migration des positions...');
  let positionsCreated = 0;
  let positionsUpdated = 0;
  
  for (const [rosterSlug, rosterDef] of Object.entries(TEAM_ROSTERS)) {
    const roster = await prisma.roster.findUnique({
      where: { slug: rosterSlug }
    });

    if (!roster) {
      console.error(`❌ Roster ${rosterSlug} non trouvé, impossible de créer les positions`);
      continue;
    }

    for (const positionDef of rosterDef.positions) {
      try {
        const existing = await prisma.position.findFirst({
          where: {
            rosterId: roster.id,
            slug: positionDef.slug
          }
        });

        const positionData = {
          rosterId: roster.id,
          slug: positionDef.slug,
          displayName: positionDef.displayName,
          cost: positionDef.cost,
          min: positionDef.min,
          max: positionDef.max,
          ma: positionDef.ma,
          st: positionDef.st,
          ag: positionDef.ag,
          pa: positionDef.pa,
          av: positionDef.av,
        };

        let position;
        if (existing) {
          position = await prisma.position.update({
            where: { id: existing.id },
            data: positionData
          });
          positionsUpdated++;
        } else {
          position = await prisma.position.create({
            data: positionData
          });
          positionsCreated++;
        }

        // Supprimer les anciennes relations de compétences pour cette position
        await prisma.positionSkill.deleteMany({
          where: { positionId: position.id }
        });

        // Créer les nouvelles relations de compétences
        if (positionDef.skills && positionDef.skills.trim() !== '') {
          const skillSlugs = positionDef.skills.split(',').map(s => s.trim()).filter(s => s.length > 0);
          
          for (const skillSlug of skillSlugs) {
            const skill = await prisma.skill.findUnique({
              where: { slug: skillSlug }
            });

            if (skill) {
              await prisma.positionSkill.create({
                data: {
                  positionId: position.id,
                  skillId: skill.id,
                }
              });
            } else {
              console.warn(`⚠️  Compétence ${skillSlug} non trouvée pour la position ${positionDef.slug}`);
            }
          }
        }
      } catch (error) {
        console.error(`❌ Erreur lors de la migration de la position ${positionDef.slug}:`, error);
      }
    }
  }
  console.log(`✅ Positions: ${positionsCreated} créées, ${positionsUpdated} mises à jour\n`);

  // 4. Migrer les Star Players et leurs relations
  console.log('⭐ Migration des Star Players...');
  let starPlayersCreated = 0;
  let starPlayersUpdated = 0;
  
  for (const [slug, starPlayerDef] of Object.entries(STAR_PLAYERS)) {
    try {
      const existing = await prisma.starPlayer.findUnique({
        where: { slug }
      });

      const starPlayerData = {
        slug,
        displayName: starPlayerDef.displayName,
        cost: starPlayerDef.cost,
        ma: starPlayerDef.ma,
        st: starPlayerDef.st,
        ag: starPlayerDef.ag,
        pa: starPlayerDef.pa ?? null,
        av: starPlayerDef.av,
        specialRule: starPlayerDef.specialRule ?? null,
        imageUrl: starPlayerDef.imageUrl ?? null,
      };

      let starPlayer;
      if (existing) {
        starPlayer = await prisma.starPlayer.update({
          where: { slug },
          data: starPlayerData
        });
        starPlayersUpdated++;
      } else {
        starPlayer = await prisma.starPlayer.create({
          data: starPlayerData
        });
        starPlayersCreated++;
      }

      // Supprimer les anciennes relations de compétences pour ce Star Player
      await prisma.starPlayerSkill.deleteMany({
        where: { starPlayerId: starPlayer.id }
      });

      // Créer les nouvelles relations de compétences
      if (starPlayerDef.skills && starPlayerDef.skills.trim() !== '') {
        const skillSlugs = starPlayerDef.skills.split(',').map(s => s.trim()).filter(s => s.length > 0);
        
        for (const skillSlug of skillSlugs) {
          const skill = await prisma.skill.findUnique({
            where: { slug: skillSlug }
          });

          if (skill) {
            await prisma.starPlayerSkill.create({
              data: {
                starPlayerId: starPlayer.id,
                skillId: skill.id,
              }
            });
          } else {
            console.warn(`⚠️  Compétence ${skillSlug} non trouvée pour le Star Player ${slug}`);
          }
        }
      }

      // Supprimer les anciennes relations hirableBy
      await prisma.starPlayerHirableBy.deleteMany({
        where: { starPlayerId: starPlayer.id }
      });

      // Créer les nouvelles relations hirableBy
      for (const rule of starPlayerDef.hirableBy) {
        // Si la règle est "all", on ne crée pas de relation avec un roster spécifique
        if (rule === 'all') {
          await prisma.starPlayerHirableBy.create({
            data: {
              starPlayerId: starPlayer.id,
              rule: 'all',
              rosterId: null,
            }
          });
        } else {
          // Chercher si c'est un slug de roster
          const roster = await prisma.roster.findUnique({
            where: { slug: rule }
          });

          if (roster) {
            await prisma.starPlayerHirableBy.create({
              data: {
                starPlayerId: starPlayer.id,
                rule: rule,
                rosterId: roster.id,
              }
            });
          } else {
            // C'est une règle régionale (ex: "old_world_classic", "lustrian_superleague", etc.)
            await prisma.starPlayerHirableBy.create({
              data: {
                starPlayerId: starPlayer.id,
                rule: rule,
                rosterId: null,
              }
            });
          }
        }
      }
    } catch (error) {
      console.error(`❌ Erreur lors de la migration du Star Player ${slug}:`, error);
    }
  }
  console.log(`✅ Star Players: ${starPlayersCreated} créés, ${starPlayersUpdated} mis à jour\n`);

  console.log('🎉 Migration terminée avec succès !');
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors de la migration:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });



