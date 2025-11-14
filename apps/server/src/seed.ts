import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import { SKILLS_DEFINITIONS } from "../../../packages/game-engine/src/skills/index";
import { TEAM_ROSTERS } from "../../../packages/game-engine/src/rosters/positions";
import { STAR_PLAYERS } from "../../../packages/game-engine/src/rosters/star-players";
import { STATIC_SKILLS_DATA } from "./static-skills-data";

async function main() {
  console.log("🌱 Début du seed...\n");

  // =============================================================================
  // 1. SEED DES COMPÉTENCES (Skills)
  // =============================================================================
  console.log("📚 Seed des compétences...");
  let skillsCreated = 0;
  let skillsSkipped = 0;
  
  for (const skillDef of SKILLS_DEFINITIONS) {
    try {
      const existing = await prisma.skill.findUnique({
        where: { slug: skillDef.slug }
      });

      // Récupérer toutes les données depuis les données statiques (description FR et EN mises à jour)
      const staticData = STATIC_SKILLS_DATA[skillDef.nameEn];
      
      // Utiliser les données statiques si disponibles, sinon utiliser les données du game-engine
      const finalNameFr = staticData?.nameFr || skillDef.nameFr;
      const finalNameEn = staticData?.nameEn || skillDef.nameEn;
      const finalDescription = staticData?.description || skillDef.description;
      const finalDescriptionEn = staticData?.descriptionEn || null;
      const finalCategory = staticData?.category || skillDef.category;

      if (existing) {
        await prisma.skill.update({
          where: { slug: skillDef.slug },
          data: {
            nameFr: finalNameFr,
            nameEn: finalNameEn,
            description: finalDescription,
            descriptionEn: finalDescriptionEn,
            category: finalCategory,
          }
        });
        skillsSkipped++;
      } else {
        await prisma.skill.create({
          data: {
            slug: skillDef.slug,
            nameFr: finalNameFr,
            nameEn: finalNameEn,
            description: finalDescription,
            descriptionEn: finalDescriptionEn,
            category: finalCategory,
          }
        });
        skillsCreated++;
      }
    } catch (error) {
      console.error(`❌ Erreur lors du seed de la compétence ${skillDef.slug}:`, error);
    }
  }
  console.log(`✅ Compétences: ${skillsCreated} créées, ${skillsSkipped} mises à jour\n`);

  // =============================================================================
  // 2. SEED DES ROSTERS
  // =============================================================================
  console.log("🏈 Seed des rosters...");
  let rostersCreated = 0;
  let rostersSkipped = 0;
  
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
        rostersSkipped++;
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
      console.error(`❌ Erreur lors du seed du roster ${slug}:`, error);
    }
  }
  console.log(`✅ Rosters: ${rostersCreated} créés, ${rostersSkipped} mis à jour\n`);

  // =============================================================================
  // 3. SEED DES POSITIONS
  // =============================================================================
  console.log("👥 Seed des positions...");
  let positionsCreated = 0;
  let positionsSkipped = 0;
  
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
          positionsSkipped++;
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
        console.error(`❌ Erreur lors du seed de la position ${positionDef.slug}:`, error);
      }
    }
  }
  console.log(`✅ Positions: ${positionsCreated} créées, ${positionsSkipped} mises à jour\n`);

  // =============================================================================
  // 4. SEED DES STAR PLAYERS
  // =============================================================================
  console.log("⭐ Seed des Star Players...");
  let starPlayersCreated = 0;
  let starPlayersSkipped = 0;
  
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
        starPlayersSkipped++;
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
      console.error(`❌ Erreur lors du seed du Star Player ${slug}:`, error);
    }
  }
  console.log(`✅ Star Players: ${starPlayersCreated} créés, ${starPlayersSkipped} mis à jour\n`);

  // =============================================================================
  // 5. SEED DES UTILISATEURS ET ÉQUIPES (code existant)
  // =============================================================================
  console.log("👤 Seed des utilisateurs et équipes...");
  const users = [
    {
      email: "admin@example.com",
      name: "Admin",
      coachName: "Admin",
      firstName: "Admin",
      lastName: "User",
      role: "admin",
      password: "admin123",
      valid: true,
    },
    {
      email: "user@example.com",
      name: "User",
      coachName: "User",
      firstName: "John",
      lastName: "Doe",
      role: "user",
      password: "user123",
      valid: true,
    },
  ];

  for (const u of users) {
    const existing = await prisma.user.findUnique({
      where: { email: u.email },
    });
    if (existing) continue;
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.create({
      data: { 
        email: u.email, 
        name: u.name, 
        coachName: u.coachName,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role, 
        passwordHash,
        valid: true,
      },
    });
  }

  // Créer 2 équipes par défaut par utilisateur: skaven et lizardmen
  const allUsers = await prisma.user.findMany();
  for (const u of allUsers) {
    const existingTeams = await prisma.team.findMany({
      where: { ownerId: u.id },
    });
    if (existingTeams.length >= 2) continue;
    const teamA = await prisma.team.create({
      data: {
        ownerId: u.id,
        name: `${u.coachName || u.name || u.email}-Skavens`,
        roster: "skaven",
        initialBudget: 1000000, // 1000k po
        treasury: 1000000,      // 1000k po
      },
    });
    const teamB = await prisma.team.create({
      data: {
        ownerId: u.id,
        name: `${u.coachName || u.name || u.email}-Lizardmen`,
        roster: "lizardmen",
        initialBudget: 1000000, // 1000k po
        treasury: 1000000,      // 1000k po
      },
    });
    // Créer une équipe Skaven réaliste : 1 Rat Ogre, 2 Blitzers, 2 Gutter Runners, 1 Thrower, 6 Linemen
    const skavenPlayers = [
      // 1 Rat Ogre
      {
        teamId: teamA.id,
        name: "Rat Ogre",
        position: "skaven_rat_ogre",
        number: 1,
        ma: 6,
        st: 5,
        ag: 5,
        pa: 6,
        av: 9,
        skills: "animal-savagery,frenzy,loner-4,mighty-blow-1,prehensile-tail",
      },
      // 2 Blitzers
      {
        teamId: teamA.id,
        name: "Blitzer 1",
        position: "skaven_blitzer",
        number: 2,
        ma: 7,
        st: 3,
        ag: 3,
        pa: 4,
        av: 9,
        skills: "block",
      },
      {
        teamId: teamA.id,
        name: "Blitzer 2",
        position: "skaven_blitzer",
        number: 3,
        ma: 7,
        st: 3,
        ag: 3,
        pa: 4,
        av: 9,
        skills: "block",
      },
      // 2 Gutter Runners
      {
        teamId: teamA.id,
        name: "Gutter Runner 1",
        position: "skaven_gutter_runner",
        number: 4,
        ma: 9,
        st: 2,
        ag: 2,
        pa: 4,
        av: 8,
        skills: "dodge",
      },
      {
        teamId: teamA.id,
        name: "Gutter Runner 2",
        position: "skaven_gutter_runner",
        number: 5,
        ma: 9,
        st: 2,
        ag: 2,
        pa: 4,
        av: 8,
        skills: "dodge",
      },
      // 1 Thrower
      {
        teamId: teamA.id,
        name: "Thrower",
        position: "skaven_thrower",
        number: 6,
        ma: 7,
        st: 3,
        ag: 3,
        pa: 2,
        av: 8,
        skills: "pass,sure-hands",
      },
      // 6 Linemen
      ...Array.from({ length: 6 }, (_, i) => ({
        teamId: teamA.id,
        name: `Lineman ${i + 1}`,
        position: "skaven_lineman",
        number: i + 7,
        ma: 7,
        st: 3,
        ag: 3,
        pa: 4,
        av: 8,
        skills: "",
      })),
    ];

    // Équipe Lizardmen (11 linemen placeholder)
    const mk = (teamId: string, i: number) => ({
      teamId,
      name: `J${i}`,
      position: "Lineman",
      number: i,
      ma: 6,
      st: 3,
      ag: 3,
      pa: 3,
      av: 9,
      skills: "",
    });

    await prisma.teamPlayer.createMany({
      data: skavenPlayers,
    });
    await prisma.teamPlayer.createMany({
      data: Array.from({ length: 11 }, (_, i) => mk(teamB.id, i + 1)),
    });
  }

  // =============================================================================
  // 6. SEED D'UNE COUPE ET D'UN MATCH LOCAL (fixtures de test)
  // =============================================================================
  console.log("🏆 Seed d'une coupe et d'un match local de test...");
  
  const adminUser = await prisma.user.findUnique({
    where: { email: "admin@example.com" },
  });
  const userUser = await prisma.user.findUnique({
    where: { email: "user@example.com" },
  });

  if (adminUser && userUser) {
    // Récupérer les équipes
    const adminSkavenTeam = await prisma.team.findFirst({
      where: {
        ownerId: adminUser.id,
        roster: "skaven",
      },
    });
    const userLizardmenTeam = await prisma.team.findFirst({
      where: {
        ownerId: userUser.id,
        roster: "lizardmen",
      },
    });

    if (adminSkavenTeam && userLizardmenTeam) {
      // Créer la coupe "Test 1"
      const existingCup = await prisma.cup.findFirst({
        where: { name: "Test 1" },
      });

      let cup;
      if (existingCup) {
        console.log("   ⚠️  La coupe 'Test 1' existe déjà, utilisation de celle-ci");
        cup = existingCup;
      } else {
        cup = await prisma.cup.create({
          data: {
            name: "Test 1",
            creatorId: adminUser.id,
            validated: true,
            isPublic: true,
            status: "en_cours",
          },
        });
        console.log("   ✅ Coupe 'Test 1' créée");
      }

      // Inscrire les équipes à la coupe
      const existingParticipant1 = await prisma.cupParticipant.findFirst({
        where: {
          cupId: cup.id,
          teamId: adminSkavenTeam.id,
        },
      });
      if (!existingParticipant1) {
        await prisma.cupParticipant.create({
          data: {
            cupId: cup.id,
            teamId: adminSkavenTeam.id,
          },
        });
        console.log("   ✅ Équipe Admin-Skavens inscrite à la coupe");
      }

      const existingParticipant2 = await prisma.cupParticipant.findFirst({
        where: {
          cupId: cup.id,
          teamId: userLizardmenTeam.id,
        },
      });
      if (!existingParticipant2) {
        await prisma.cupParticipant.create({
          data: {
            cupId: cup.id,
            teamId: userLizardmenTeam.id,
          },
        });
        console.log("   ✅ Équipe User-Lizardmen inscrite à la coupe");
      }

      // Créer un match local associé à la coupe
      const existingMatch = await prisma.localMatch.findFirst({
        where: {
          cupId: cup.id,
          teamAId: adminSkavenTeam.id,
          teamBId: userLizardmenTeam.id,
        },
      });

      if (!existingMatch) {
        await prisma.localMatch.create({
          data: {
            name: null, // Pas de nom spécifique
            creatorId: adminUser.id,
            teamAId: adminSkavenTeam.id,
            teamBId: userLizardmenTeam.id,
            cupId: cup.id,
            status: "pending",
            teamAOwnerValidated: false,
            teamBOwnerValidated: false,
          },
        });
        console.log("   ✅ Match local créé (Admin-Skavens vs User-Lizardmen)");
      } else {
        console.log("   ⚠️  Le match local existe déjà");
      }
    } else {
      console.log("   ⚠️  Impossible de créer la coupe : équipes non trouvées");
    }
  } else {
    console.log("   ⚠️  Impossible de créer la coupe : utilisateurs non trouvés");
  }
  console.log("✅ Fixtures de coupe et match local terminées\n");
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("\n🎉 Seed terminé avec succès !");
    console.log("   - Toutes les compétences ont été importées");
    console.log("   - Tous les rosters ont été importés");
    console.log("   - Toutes les positions ont été importées");
    console.log("   - Tous les Star Players ont été importés");
    console.log("   - Les comptes par défaut sont prêts");
    console.log("   - La coupe 'Test 1' et un match local ont été créés");
  })
  .catch(async (e) => {
    console.error("❌ Erreur lors du seed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
