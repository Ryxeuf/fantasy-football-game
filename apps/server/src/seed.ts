import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import { SKILLS_DEFINITIONS } from "../../../packages/game-engine/src/skills/index";
import {
  TEAM_ROSTERS,
  TEAM_ROSTERS_BY_RULESET,
  RULESETS,
  DEFAULT_RULESET,
  type Ruleset,
} from "../../../packages/game-engine/src/rosters/positions";
import { STAR_PLAYERS_BY_RULESET } from "../../../packages/game-engine/src/rosters/star-players";
import { STATIC_SKILLS_DATA } from "./static-skills-data";
import { 
  SEASON_3_NEW_SKILLS, 
  SEASON_3_CATEGORY_CHANGES, 
  SEASON_3_ELITE_SKILLS,
  SEASON_3_RENAMED_SKILLS 
} from "./static-skills-data-s3";
import { UNKNOWN_USER_ID } from "./utils/user-constants";
import { ONLINE_PLAY_FLAG } from "./services/featureFlags";
import { seedDefaultLeagues, DEFAULT_LEAGUE_NAME } from "./seeders/leagues";

async function main() {
  console.log("🌱 Début du seed...\n");

  // =============================================================================
  // 1. SEED DES COMPÉTENCES (Skills) - Pour chaque ruleset
  // =============================================================================
  console.log("📚 Seed des compétences...");
  let skillsCreated = 0;
  let skillsSkipped = 0;
  
  // Supprimer les compétences S3-only qui ont été créées par erreur en S2
  console.log("   🧹 Nettoyage des compétences S3-only créées par erreur en S2...");
  const s3OnlySlugs = SKILLS_DEFINITIONS
    .filter(s => s.season3Only)
    .map(s => s.slug);
  
  if (s3OnlySlugs.length > 0) {
    const deleted = await prisma.skill.deleteMany({
      where: {
        ruleset: "season_2",
        slug: { in: s3OnlySlugs }
      }
    });
    if (deleted.count > 0) {
      console.log(`   ✅ ${deleted.count} compétences S3-only supprimées de S2`);
    }
  }

  // Créer les compétences pour chaque ruleset (season_2 et season_3)
  for (const ruleset of RULESETS) {
    console.log(`   📖 Seed des compétences pour ${ruleset}...`);
    const isSeason3 = ruleset === "season_3";
    
    for (const skillDef of SKILLS_DEFINITIONS) {
      // Ignorer les compétences S3-only quand on seed pour S2
      if (!isSeason3 && skillDef.season3Only) {
        continue;
      }
      
      try {
        const existing = await prisma.skill.findUnique({
          where: { slug_ruleset: { slug: skillDef.slug, ruleset } }
        });

        // Récupérer toutes les données depuis les données statiques (description FR et EN mises à jour)
        const staticData = STATIC_SKILLS_DATA[skillDef.nameEn];
        
        // Utiliser les données statiques si disponibles, sinon utiliser les données du game-engine
        let finalNameFr = staticData?.nameFr || skillDef.nameFr;
        let finalNameEn = staticData?.nameEn || skillDef.nameEn;
        const finalDescription = staticData?.description || skillDef.description;
        const finalDescriptionEn = staticData?.descriptionEn || null;
        let finalCategory = staticData?.category || skillDef.category;
        // En Saison 2, aucune compétence n'est Elite
        // En Saison 3, on applique SEASON_3_ELITE_SKILLS
        let finalIsElite = false;
        const finalIsPassive = skillDef.isPassive || false;
        const finalIsModified = skillDef.isModified || false;

        // Appliquer les modifications spécifiques à la Saison 3
        if (isSeason3) {
          // Changements de catégorie pour la Saison 3
          if (SEASON_3_CATEGORY_CHANGES[skillDef.slug]) {
            finalCategory = SEASON_3_CATEGORY_CHANGES[skillDef.slug];
          }
          // Compétences Elite pour la Saison 3 uniquement
          if (SEASON_3_ELITE_SKILLS.includes(skillDef.slug)) {
            finalIsElite = true;
          }
          // Renommages pour la Saison 3
          const renamed = SEASON_3_RENAMED_SKILLS[skillDef.slug];
          if (renamed) {
            if (renamed.nameFr) finalNameFr = renamed.nameFr;
            if (renamed.nameEn) finalNameEn = renamed.nameEn;
          }
        }

        if (existing) {
          await prisma.skill.update({
            where: { slug_ruleset: { slug: skillDef.slug, ruleset } },
            data: {
              nameFr: finalNameFr,
              nameEn: finalNameEn,
              description: finalDescription,
              descriptionEn: finalDescriptionEn,
              category: finalCategory,
              isElite: finalIsElite,
              isPassive: finalIsPassive,
              isModified: finalIsModified,
            }
          });
          skillsSkipped++;
        } else {
          await prisma.skill.create({
            data: {
              slug: skillDef.slug,
              ruleset,
              nameFr: finalNameFr,
              nameEn: finalNameEn,
              description: finalDescription,
              descriptionEn: finalDescriptionEn,
              category: finalCategory,
              isElite: finalIsElite,
              isPassive: finalIsPassive,
              isModified: finalIsModified,
            }
          });
          skillsCreated++;
        }
      } catch (error) {
        console.error(`❌ Erreur lors du seed de la compétence ${skillDef.slug} (${ruleset}):`, error);
      }
    }
  }

  // =============================================================================
  // 1b. SEED DES NOUVELLES COMPÉTENCES SAISON 3
  // =============================================================================
  console.log("📚 Seed des nouvelles compétences Saison 3...");
  let s3SkillsCreated = 0;
  let s3SkillsUpdated = 0;

  for (const s3Skill of SEASON_3_NEW_SKILLS) {
    try {
      const existing = await prisma.skill.findUnique({
        where: { slug_ruleset: { slug: s3Skill.slug, ruleset: "season_3" } }
      });

      if (existing) {
        await prisma.skill.update({
          where: { slug_ruleset: { slug: s3Skill.slug, ruleset: "season_3" } },
          data: {
            nameFr: s3Skill.nameFr,
            nameEn: s3Skill.nameEn,
            description: s3Skill.description,
            descriptionEn: s3Skill.descriptionEn || null,
            category: s3Skill.category,
            isElite: s3Skill.isElite || false,
            isPassive: s3Skill.isPassive || false,
          }
        });
        s3SkillsUpdated++;
      } else {
        await prisma.skill.create({
          data: {
            slug: s3Skill.slug,
            ruleset: "season_3",
            nameFr: s3Skill.nameFr,
            nameEn: s3Skill.nameEn,
            description: s3Skill.description,
            descriptionEn: s3Skill.descriptionEn || null,
            category: s3Skill.category,
            isElite: s3Skill.isElite || false,
            isPassive: s3Skill.isPassive || false,
          }
        });
        s3SkillsCreated++;
      }
    } catch (error) {
      console.error(`❌ Erreur lors du seed de la compétence S3 ${s3Skill.slug}:`, error);
    }
  }

  console.log(`✅ Compétences: ${skillsCreated} créées, ${skillsSkipped} mises à jour`);
  console.log(`✅ Nouvelles compétences S3: ${s3SkillsCreated} créées, ${s3SkillsUpdated} mises à jour\n`);

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
  
  for (const ruleset of RULESETS) {
    const rosterMap = TEAM_ROSTERS_BY_RULESET[ruleset] || TEAM_ROSTERS;
    for (const [slug, rosterDef] of Object.entries(rosterMap)) {
      try {
        const existing = await prisma.roster.findUnique({
          where: { slug_ruleset: { slug, ruleset } },
        });

        const nameEn = rosterNamesEn[slug] || rosterDef.name; // Fallback sur le nom français si pas de traduction
        const regionalRulesJson = rosterDef.regionalRules
          ? JSON.stringify(rosterDef.regionalRules)
          : null;

        if (existing) {
          await prisma.roster.update({
            where: { slug_ruleset: { slug, ruleset } },
            data: {
              name: rosterDef.name,
              nameEn,
              descriptionFr: rosterDef.descriptionFr || null,
              descriptionEn: rosterDef.descriptionEn || null,
              budget: rosterDef.budget,
              tier: rosterDef.tier,
              regionalRules: regionalRulesJson,
              specialRules: rosterDef.specialRules || null,
              naf: rosterDef.naf,
            },
          });
          rostersSkipped++;
        } else {
          await prisma.roster.create({
            data: {
              slug,
              ruleset,
              name: rosterDef.name,
              nameEn,
              descriptionFr: rosterDef.descriptionFr || null,
              descriptionEn: rosterDef.descriptionEn || null,
              budget: rosterDef.budget,
              tier: rosterDef.tier,
              regionalRules: regionalRulesJson,
              specialRules: rosterDef.specialRules || null,
              naf: rosterDef.naf,
            },
          });
          rostersCreated++;
        }
      } catch (error) {
        console.error(
          `❌ Erreur lors du seed du roster ${slug} (${ruleset}):`,
          error,
        );
      }
    }
  }
  console.log(`✅ Rosters: ${rostersCreated} créés, ${rostersSkipped} mis à jour\n`);

  // =============================================================================
  // 3. SEED DES POSITIONS
  // =============================================================================
  console.log("👥 Seed des positions...");
  let positionsCreated = 0;
  let positionsSkipped = 0;
  
  for (const ruleset of RULESETS) {
    const rosterMap = TEAM_ROSTERS_BY_RULESET[ruleset] || TEAM_ROSTERS;
    for (const [rosterSlug, rosterDef] of Object.entries(rosterMap)) {
      const roster = await prisma.roster.findUnique({
        where: { slug_ruleset: { slug: rosterSlug, ruleset } },
      });

      if (!roster) {
        console.error(
          `❌ Roster ${rosterSlug} (${ruleset}) non trouvé, impossible de créer les positions`,
        );
        continue;
      }

      for (const positionDef of rosterDef.positions) {
        try {
          const existing = await prisma.position.findFirst({
            where: {
              rosterId: roster.id,
              slug: positionDef.slug,
            },
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
              data: positionData,
            });
            positionsSkipped++;
          } else {
            position = await prisma.position.create({
              data: positionData,
            });
            positionsCreated++;
          }

          // Supprimer les anciennes relations de compétences pour cette position
          await prisma.positionSkill.deleteMany({
            where: { positionId: position.id },
          });

          // Créer les nouvelles relations de compétences
          if (positionDef.skills && positionDef.skills.trim() !== "") {
            const skillSlugs = positionDef.skills
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s.length > 0);

            for (const skillSlug of skillSlugs) {
              const skill = await prisma.skill.findUnique({
                where: { slug_ruleset: { slug: skillSlug, ruleset } },
              });

              if (skill) {
                await prisma.positionSkill.create({
                  data: {
                    positionId: position.id,
                    skillId: skill.id,
                  },
                });
              } else {
                console.warn(
                  `⚠️  Compétence ${skillSlug} non trouvée pour la position ${positionDef.slug} (${ruleset})`,
                );
              }
            }
          }
        } catch (error) {
          console.error(
            `❌ Erreur lors du seed de la position ${positionDef.slug} (${ruleset}):`,
            error,
          );
        }
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
  
  for (const ruleset of RULESETS) {
    const starPlayersMap = STAR_PLAYERS_BY_RULESET[ruleset];
    for (const [slug, starPlayerDef] of Object.entries(starPlayersMap)) {
      try {
        const existing = await prisma.starPlayer.findUnique({
          where: { slug_ruleset: { slug, ruleset } }
        });

        const starPlayerData = {
          slug,
          ruleset,
          displayName: starPlayerDef.displayName,
          cost: starPlayerDef.cost,
          ma: starPlayerDef.ma,
          st: starPlayerDef.st,
          ag: starPlayerDef.ag,
          pa: starPlayerDef.pa ?? null,
          av: starPlayerDef.av,
          specialRule: starPlayerDef.specialRule ?? null,
          imageUrl: starPlayerDef.imageUrl ?? null,
          isMegaStar: starPlayerDef.isMegaStar ?? false,
        };

        let starPlayer;
        if (existing) {
          starPlayer = await prisma.starPlayer.update({
            where: { slug_ruleset: { slug, ruleset } },
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
              where: { slug_ruleset: { slug: skillSlug, ruleset } }
            });

            if (skill) {
              await prisma.starPlayerSkill.create({
                data: {
                  starPlayerId: starPlayer.id,
                  skillId: skill.id,
                }
              });
            } else {
              console.warn(`⚠️  Compétence ${skillSlug} non trouvée pour le Star Player ${slug} (${ruleset})`);
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
            // Chercher si c'est un slug de roster pour le même ruleset
            const roster = await prisma.roster.findUnique({
              where: { slug_ruleset: { slug: rule, ruleset } },
              select: { id: true },
            });

            if (roster) {
              await prisma.starPlayerHirableBy.create({
                data: {
                  starPlayerId: starPlayer.id,
                  rule,
                  rosterId: roster.id,
                },
              });
            } else {
              // C'est une règle régionale (ex: "old_world_classic", "lustrian_superleague", etc.)
              await prisma.starPlayerHirableBy.create({
                data: {
                  starPlayerId: starPlayer.id,
                  rule,
                  rosterId: null,
                },
              });
            }
          }
        }
      } catch (error) {
        console.error(`❌ Erreur lors du seed du Star Player ${slug} (${ruleset}):`, error);
      }
    }
  }
  console.log(`✅ Star Players: ${starPlayersCreated} créés, ${starPlayersSkipped} mis à jour\n`);

  // =============================================================================
  // 5. SEED DES UTILISATEURS ET ÉQUIPES (code existant)
  // =============================================================================
  console.log("👤 Seed des utilisateurs et équipes...");

  // Utilisateur technique "Unknown" utilisé pour représenter un compte inconnu/supprimé
  // Cet utilisateur possède un ID fixe défini dans UNKNOWN_USER_ID pour pouvoir
  // être référencé de manière stable dans le code applicatif.
  console.log("👤 Seed de l'utilisateur technique 'Unknown'...");
  const unknownPasswordHash = await bcrypt.hash("unknown123", 10);
  await prisma.user.upsert({
    where: { id: UNKNOWN_USER_ID },
    update: {},
    create: {
      id: UNKNOWN_USER_ID,
      email: "unknown@example.com",
      name: "Unknown",
      coachName: "Unknown",
      firstName: "Unknown",
      lastName: "User",
      role: "user",
      roles: ["user"],
      passwordHash: unknownPasswordHash,
      valid: true,
    },
  });

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
      roles: ["user", "admin"],
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
      roles: ["user"],
    },
    {
      email: "moderator@example.com",
      name: "Moderator",
      coachName: "Moderator",
      firstName: "Mod",
      lastName: "User",
      role: "user",
      password: "moderator123",
      valid: true,
      roles: ["user", "moderator"],
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
        roles: Array.from(
          new Set(
            (u.roles && Array.isArray(u.roles) && u.roles.length > 0
              ? u.roles
              : [u.role]
            ).concat("user"),
          ),
        ),
        passwordHash,
        valid: true,
      },
    });
  }

  // Créer des équipes par défaut par utilisateur
  // - Admin: seulement Skaven (pas d'équipe Lizardmen)
  // - Autres utilisateurs: Skaven + Lizardmen
  const allUsers = await prisma.user.findMany();
  for (const u of allUsers) {
    const existingTeams = await prisma.team.findMany({ where: { ownerId: u.id } });
    const hasSkaven = existingTeams.some((t: { roster: string }) => t.roster === "skaven");
    const hasLizardmen = existingTeams.some((t: { roster: string }) => t.roster === "lizardmen");

    let teamA = existingTeams.find((t: { roster: string }) => t.roster === "skaven") as any;

    if (!hasSkaven) {
      teamA = await prisma.team.create({
        data: {
          ownerId: u.id,
          name: `${u.coachName || u.name || u.email}-Skavens`,
          roster: "skaven",
          ruleset: "season_2",
          initialBudget: 1000000, // 1000k po
          treasury: 1000000, // 1000k po
        },
      });
    }

    let teamB: any = null;
    if (u.role !== "admin" && !hasLizardmen) {
      teamB = await prisma.team.create({
        data: {
          ownerId: u.id,
          name: `${u.coachName || u.name || u.email}-Lizardmen`,
          roster: "lizardmen",
          ruleset: "season_2",
          initialBudget: 1000000, // 1000k po
          treasury: 1000000, // 1000k po
        },
      });
    }
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

    // Équipe Lizardmen selon le roster: 2 Chameleon Skink, 1 Kroxigor, 5 Saurus, 4 Skink Runner
    const lizardmenPlayers = teamB
      ? [
      // 2 Chameleon Skink
      {
        teamId: teamB.id,
        name: "Chameleon Skink 1",
        position: "lizardmen_chameleon_skink",
        number: 1,
        ma: 7,
        st: 2,
        ag: 3,
        pa: 3,
        av: 8,
        skills: "dodge,on-the-ball,shadowing,stunty",
      },
      {
        teamId: teamB.id,
        name: "Chameleon Skink 2",
        position: "lizardmen_chameleon_skink",
        number: 2,
        ma: 7,
        st: 2,
        ag: 3,
        pa: 3,
        av: 8,
        skills: "dodge,on-the-ball,shadowing,stunty",
      },
      // 1 Kroxigor
      {
        teamId: teamB.id,
        name: "Kroxigor 1",
        position: "lizardmen_kroxigor",
        number: 3,
        ma: 6,
        st: 5,
        ag: 5,
        pa: 6,
        av: 10,
        skills: "bone-head,loner-4,mighty-blow-1,prehensile-tail,thick-skull,throw-team-mate",
      },
      // 5 Saurus
      {
        teamId: teamB.id,
        name: "Saurus 1",
        position: "lizardmen_saurus",
        number: 4,
        ma: 6,
        st: 4,
        ag: 4,
        pa: 6,
        av: 10,
        skills: "",
      },
      {
        teamId: teamB.id,
        name: "Saurus 2",
        position: "lizardmen_saurus",
        number: 5,
        ma: 6,
        st: 4,
        ag: 4,
        pa: 6,
        av: 10,
        skills: "",
      },
      {
        teamId: teamB.id,
        name: "Saurus 3",
        position: "lizardmen_saurus",
        number: 6,
        ma: 6,
        st: 4,
        ag: 4,
        pa: 6,
        av: 10,
        skills: "",
      },
      {
        teamId: teamB.id,
        name: "Saurus 4",
        position: "lizardmen_saurus",
        number: 7,
        ma: 6,
        st: 4,
        ag: 4,
        pa: 6,
        av: 10,
        skills: "",
      },
      {
        teamId: teamB.id,
        name: "Saurus 5",
        position: "lizardmen_saurus",
        number: 8,
        ma: 6,
        st: 4,
        ag: 4,
        pa: 6,
        av: 10,
        skills: "",
      },
      // 4 Skink Runner
      {
        teamId: teamB.id,
        name: "Skink Runner 1",
        position: "lizardmen_skink_runner",
        number: 9,
        ma: 8,
        st: 2,
        ag: 3,
        pa: 4,
        av: 8,
        skills: "dodge,stunty",
      },
      {
        teamId: teamB.id,
        name: "Skink Runner 2",
        position: "lizardmen_skink_runner",
        number: 10,
        ma: 8,
        st: 2,
        ag: 3,
        pa: 4,
        av: 8,
        skills: "dodge,stunty",
      },
      {
        teamId: teamB.id,
        name: "Skink Runner 3",
        position: "lizardmen_skink_runner",
        number: 11,
        ma: 8,
        st: 2,
        ag: 3,
        pa: 4,
        av: 8,
        skills: "dodge,stunty",
      },
      {
        teamId: teamB.id,
        name: "Skink Runner 4",
        position: "lizardmen_skink_runner",
        number: 12,
        ma: 8,
        st: 2,
        ag: 3,
        pa: 4,
        av: 8,
        skills: "dodge,stunty",
      },
    ]
      : [];

    await prisma.teamPlayer.createMany({
      data: skavenPlayers,
    });
    if (lizardmenPlayers.length > 0) {
      await prisma.teamPlayer.createMany({
        data: lizardmenPlayers,
      });
    }
  }

  // =============================================================================
  // 6. SEED D'UN COACH ET D'UNE ÉQUIPE PAR ROSTER
  // =============================================================================
  console.log("👥 Seed d'un coach et d'une équipe type par roster...");
  for (const [rosterSlug, rosterDef] of Object.entries(TEAM_ROSTERS)) {
    const email = `coach+${rosterSlug}@example.com`;
    let coach = await prisma.user.findUnique({
      where: { email },
    });

    if (!coach) {
      const passwordHash = await bcrypt.hash("coach123", 10);
      const coachName = `Coach ${rosterDef.name}`;
      coach = await prisma.user.create({
        data: {
          email,
          passwordHash,
          name: coachName,
          coachName,
          firstName: rosterDef.name,
          lastName: "Coach",
          role: "user",
          roles: ["user"],
          valid: true,
        },
      });
    }

    const existingTeamForRoster = await prisma.team.findFirst({
      where: {
        ownerId: coach.id,
        roster: rosterSlug,
      },
    });

    if (!existingTeamForRoster) {
      await prisma.team.create({
        data: {
          ownerId: coach.id,
          name: `${rosterDef.name} All-Stars`,
          roster: rosterSlug,
          ruleset: "season_2",
          initialBudget: 1000000,
          treasury: 1000000,
        },
      });
    }
  }

  // =============================================================================
  // 6b. SEED DES FEATURE FLAGS
  // =============================================================================
  console.log("🚩 Seed des feature flags...");
  // "online_play" : gate toute la partie "Jouer en ligne" du site.
  // Par défaut désactivé globalement ; les admins ont un bypass automatique
  // (cf. services/featureFlags.ts) et l'utilisateur "user@example.com" reçoit
  // un override explicite ci-dessous pour les tests personnels.
  const onlinePlayFlag = await prisma.featureFlag.upsert({
    where: { key: ONLINE_PLAY_FLAG },
    update: {
      description:
        "Active la partie 'Jouer en ligne' du site (matchmaking, match en ligne, lobby, spectate).",
    },
    create: {
      key: ONLINE_PLAY_FLAG,
      description:
        "Active la partie 'Jouer en ligne' du site (matchmaking, match en ligne, lobby, spectate).",
      enabled: false,
    },
  });
  console.log(
    `   ✅ Flag '${ONLINE_PLAY_FLAG}' ${onlinePlayFlag.enabled ? "actif" : "inactif (override admin/user)"}`,
  );

  const testUser = await prisma.user.findUnique({
    where: { email: "user@example.com" },
  });
  if (testUser) {
    await prisma.featureFlagUser.upsert({
      where: {
        flagId_userId: { flagId: onlinePlayFlag.id, userId: testUser.id },
      },
      create: { flagId: onlinePlayFlag.id, userId: testUser.id },
      update: {},
    });
    console.log(
      `   ✅ Override '${ONLINE_PLAY_FLAG}' ajouté pour user@example.com`,
    );
  }

  // =============================================================================
  // 7. SEED D'UNE COUPE ET D'UN MATCH LOCAL (fixtures de test)
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
      // Créer la coupe "Test 1" avec un système de points de type Kraken Cup
      const defaultCupScoring = {
        winPoints: 1000,
        drawPoints: 400,
        lossPoints: 0,
        forfeitPoints: -100,
        touchdownPoints: 5,
        blockCasualtyPoints: 3,
        foulCasualtyPoints: 2,
        passPoints: 2,
      };

      const existingCup = await prisma.cup.findFirst({
        where: { name: "Test 1" },
      });

      let cup;
      if (existingCup) {
        console.log("   ⚠️  La coupe 'Test 1' existe déjà, mise à jour de la configuration de points");
        cup = await prisma.cup.update({
          where: { id: existingCup.id },
          data: {
            ...defaultCupScoring,
          },
        });
      } else {
        cup = await prisma.cup.create({
          data: {
            name: "Test 1",
            creatorId: adminUser.id,
            ruleset: "season_2",
            validated: true,
            isPublic: true,
            status: "en_cours",
            ...defaultCupScoring,
          },
        });
        console.log("   ✅ Coupe 'Test 1' créée");
      }

      // Inscrire les équipes à la coupe : Admin (Skaven) + 11 rosters différents
      const participantTeams: any[] = [];
      participantTeams.push(adminSkavenTeam);
      participantTeams.push(userLizardmenTeam);

      const rosterSlugsForCup = [
        "lizardmen",
        "dwarf",
        "human",
        "orc",
        "dark_elf",
        "wood_elf",
        "undead",
        "nurgle",
        "amazon",
        "chaos_chosen",
        "imperial_nobility",
      ];

      for (const rosterSlug of rosterSlugsForCup) {
        // Skaven déjà couvert par adminSkavenTeam
        if (rosterSlug === "skaven") continue;
        const team = await prisma.team.findFirst({
          where: { roster: rosterSlug },
          orderBy: { createdAt: "asc" },
        });
        if (team && !participantTeams.some((t) => t.id === team.id)) {
          participantTeams.push(team);
        }
      }

      console.log(
        `   ✅ ${participantTeams.length} équipes sélectionnées pour la coupe (objectif 12)`,
      );

      for (const team of participantTeams) {
        const existingParticipant = await prisma.cupParticipant.findFirst({
          where: {
            cupId: cup.id,
            teamId: team.id,
          },
        });
        if (!existingParticipant) {
          await prisma.cupParticipant.create({
            data: {
              cupId: cup.id,
              teamId: team.id,
            },
          });
          console.log(
            `   ✅ Équipe ${team.name} (${team.roster}) inscrite à la coupe`,
          );
        }
      }

      // Créer un match local associé à la coupe entre Admin-Skavens et User-Lizardmen
      let localMatch = await prisma.localMatch.findFirst({
        where: {
          cupId: cup.id,
          teamAId: adminSkavenTeam.id,
          teamBId: userLizardmenTeam.id,
        },
      });

      if (!localMatch) {
        localMatch = await prisma.localMatch.create({
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

      // Valider le match et générer les actions
      if (localMatch) {
        // Créer un gameState avec les informations de pré-match
        const gameState = {
          preMatch: {
            phase: 'setup',
            fanFactor: {
              teamA: {
                d3: 2,
                dedicatedFans: adminSkavenTeam.dedicatedFans || 1,
                total: 2 + (adminSkavenTeam.dedicatedFans || 1),
              },
              teamB: {
                d3: 1,
                dedicatedFans: userLizardmenTeam.dedicatedFans || 1,
                total: 1 + (userLizardmenTeam.dedicatedFans || 1),
              },
            },
            weatherType: 'classique',
            weather: {
              total: 7,
              condition: 'Conditions parfaites',
              description: 'Ni trop froid ni trop chaud. Une journée chaude, sèche et légèrement nuageuse offre des conditions parfaites pour Blood Bowl.',
            },
          },
        };

        // Valider le match (les deux propriétaires ont validé)
        await prisma.localMatch.update({
          where: { id: localMatch.id },
          data: {
            status: "completed",
            teamAOwnerValidated: true,
            teamBOwnerValidated: true,
            scoreTeamA: 2,
            scoreTeamB: 1,
            startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // Il y a 2 heures
            completedAt: new Date(),
            gameState: gameState as any,
          },
        });
        console.log("   ✅ Match validé et complété avec informations de pré-match");

        // Récupérer les joueurs des deux équipes
        const skavenPlayers = await prisma.teamPlayer.findMany({
          where: { teamId: adminSkavenTeam.id },
          orderBy: { number: "asc" },
        });
        const lizardmenPlayers = await prisma.teamPlayer.findMany({
          where: { teamId: userLizardmenTeam.id },
          orderBy: { number: "asc" },
        });

        // Vérifier s'il y a déjà des actions
        const existingActions = await prisma.localMatchAction.findMany({
          where: { matchId: localMatch.id },
        });

        if (existingActions.length === 0) {
          // Générer au moins 40 actions pour un match réaliste
          const actions = [];

          // MI-TEMPS 1 - Tour 1 (Équipe A - Skavens)
          actions.push({
            matchId: localMatch.id,
            half: 1,
            turn: 1,
            actionType: "blocage",
            playerId: skavenPlayers[1].id, // Blitzer 1
            playerName: skavenPlayers[1].name,
            playerTeam: "A",
            opponentId: lizardmenPlayers[2].id, // Saurus 1
            opponentName: lizardmenPlayers[2].name,
            diceResult: 5,
            fumble: false,
            armorBroken: true,
            opponentState: "ko",
          });

          actions.push({
            matchId: localMatch.id,
            half: 1,
            turn: 1,
            actionType: "sprint",
            playerId: skavenPlayers[3].id, // Gutter Runner 1
            playerName: skavenPlayers[3].name,
            playerTeam: "A",
            diceResult: 3,
            fumble: false,
          });

          actions.push({
            matchId: localMatch.id,
            half: 1,
            turn: 1,
            actionType: "esquive",
            playerId: skavenPlayers[3].id, // Gutter Runner 1
            playerName: skavenPlayers[3].name,
            playerTeam: "A",
            diceResult: 2,
            fumble: false,
          });

          // MI-TEMPS 1 - Tour 2 (Équipe B - Lizardmen)
          actions.push({
            matchId: localMatch.id,
            half: 1,
            turn: 2,
            actionType: "blitz",
            playerId: lizardmenPlayers[2].id, // Kroxigor
            playerName: lizardmenPlayers[2].name,
            playerTeam: "B",
            opponentId: skavenPlayers[0].id, // Rat Ogre
            opponentName: skavenPlayers[0].name,
            diceResult: 6,
            fumble: false,
            armorBroken: true,
            opponentState: "sonne",
          });

          actions.push({
            matchId: localMatch.id,
            half: 1,
            turn: 2,
            actionType: "blocage",
            playerId: lizardmenPlayers[3].id, // Saurus 1
            playerName: lizardmenPlayers[3].name,
            playerTeam: "B",
            opponentId: skavenPlayers[6].id, // Lineman 1
            opponentName: skavenPlayers[6].name,
            diceResult: 4,
            fumble: false,
            armorBroken: false,
          });

          // MI-TEMPS 1 - Tour 3 (Équipe A - Skavens)
          actions.push({
            matchId: localMatch.id,
            half: 1,
            turn: 3,
            actionType: "passe",
            playerId: skavenPlayers[5].id, // Thrower
            playerName: skavenPlayers[5].name,
            playerTeam: "A",
            diceResult: 5,
            fumble: false,
            passType: "courte",
          });

          actions.push({
            matchId: localMatch.id,
            half: 1,
            turn: 3,
            actionType: "reception",
            playerId: skavenPlayers[4].id, // Gutter Runner 2
            playerName: skavenPlayers[4].name,
            playerTeam: "A",
            diceResult: 3,
            fumble: false,
          });

          actions.push({
            matchId: localMatch.id,
            half: 1,
            turn: 3,
            actionType: "sprint",
            playerId: skavenPlayers[4].id, // Gutter Runner 2
            playerName: skavenPlayers[4].name,
            playerTeam: "A",
            diceResult: 4,
            fumble: false,
          });

          actions.push({
            matchId: localMatch.id,
            half: 1,
            turn: 3,
            actionType: "td",
            playerId: skavenPlayers[4].id, // Gutter Runner 2
            playerName: skavenPlayers[4].name,
            playerTeam: "A",
          });

          // MI-TEMPS 1 - Tour 4 (Équipe B - Lizardmen)
          actions.push({
            matchId: localMatch.id,
            half: 1,
            turn: 4,
            actionType: "aggression",
            playerId: lizardmenPlayers[0].id, // Chameleon Skink 1
            playerName: lizardmenPlayers[0].name,
            playerTeam: "B",
            opponentId: skavenPlayers[7].id, // Lineman 2
            opponentName: skavenPlayers[7].name,
            diceResult: 6,
            fumble: false,
            armorBroken: true,
            opponentState: "ko",
          });

          actions.push({
            matchId: localMatch.id,
            half: 1,
            turn: 4,
            actionType: "blocage",
            playerId: lizardmenPlayers[4].id, // Saurus 2
            playerName: lizardmenPlayers[4].name,
            playerTeam: "B",
            opponentId: skavenPlayers[8].id, // Lineman 3
            opponentName: skavenPlayers[8].name,
            diceResult: 3,
            fumble: false,
            armorBroken: false,
          });

          // MI-TEMPS 1 - Tour 5 (Équipe A - Skavens)
          actions.push({
            matchId: localMatch.id,
            half: 1,
            turn: 5,
            actionType: "blitz",
            playerId: skavenPlayers[2].id, // Blitzer 2
            playerName: skavenPlayers[2].name,
            playerTeam: "A",
            opponentId: lizardmenPlayers[5].id, // Saurus 3
            opponentName: lizardmenPlayers[5].name,
            diceResult: 5,
            fumble: false,
            armorBroken: true,
            opponentState: "sonne",
          });

          actions.push({
            matchId: localMatch.id,
            half: 1,
            turn: 5,
            actionType: "esquive",
            playerId: skavenPlayers[3].id, // Gutter Runner 1
            playerName: skavenPlayers[3].name,
            playerTeam: "A",
            diceResult: 1,
            fumble: true,
            playerState: "ko",
          });

          actions.push({
            matchId: localMatch.id,
            half: 1,
            turn: 5,
            actionType: "apothicaire",
            playerId: skavenPlayers[3].id, // Gutter Runner 1
            playerName: skavenPlayers[3].name,
            playerTeam: "A",
            diceResult: 4,
            fumble: false,
          });

          // MI-TEMPS 1 - Tour 6 (Équipe B - Lizardmen)
          actions.push({
            matchId: localMatch.id,
            half: 1,
            turn: 6,
            actionType: "transmission",
            playerId: lizardmenPlayers[8].id, // Skink Runner 1
            playerName: lizardmenPlayers[8].name,
            playerTeam: "B",
            opponentId: lizardmenPlayers[9].id, // Skink Runner 2
            opponentName: lizardmenPlayers[9].name,
            diceResult: 2,
            fumble: false,
          });

          actions.push({
            matchId: localMatch.id,
            half: 1,
            turn: 6,
            actionType: "sprint",
            playerId: lizardmenPlayers[9].id, // Skink Runner 2
            playerName: lizardmenPlayers[9].name,
            playerTeam: "B",
            diceResult: 5,
            fumble: false,
          });

          actions.push({
            matchId: localMatch.id,
            half: 1,
            turn: 6,
            actionType: "esquive",
            playerId: lizardmenPlayers[9].id, // Skink Runner 2
            playerName: lizardmenPlayers[9].name,
            playerTeam: "B",
            diceResult: 3,
            fumble: false,
          });

          actions.push({
            matchId: localMatch.id,
            half: 1,
            turn: 6,
            actionType: "td",
            playerId: lizardmenPlayers[9].id, // Skink Runner 2
            playerName: lizardmenPlayers[9].name,
            playerTeam: "B",
          });

          // MI-TEMPS 1 - Tour 7 (Équipe A - Skavens)
          actions.push({
            matchId: localMatch.id,
            half: 1,
            turn: 7,
            actionType: "blocage",
            playerId: skavenPlayers[0].id, // Rat Ogre
            playerName: skavenPlayers[0].name,
            playerTeam: "A",
            opponentId: lizardmenPlayers[2].id, // Kroxigor
            opponentName: lizardmenPlayers[2].name,
            diceResult: 6,
            fumble: false,
            armorBroken: true,
            opponentState: "ko",
          });

          actions.push({
            matchId: localMatch.id,
            half: 1,
            turn: 7,
            actionType: "blocage",
            playerId: skavenPlayers[1].id, // Blitzer 1
            playerName: skavenPlayers[1].name,
            playerTeam: "A",
            opponentId: lizardmenPlayers[4].id, // Saurus 2
            opponentName: lizardmenPlayers[4].name,
            diceResult: 4,
            fumble: false,
            armorBroken: false,
          });

          // MI-TEMPS 1 - Tour 8 (Équipe B - Lizardmen)
          actions.push({
            matchId: localMatch.id,
            half: 1,
            turn: 8,
            actionType: "blitz",
            playerId: lizardmenPlayers[3].id, // Saurus 1
            playerName: lizardmenPlayers[3].name,
            playerTeam: "B",
            opponentId: skavenPlayers[9].id, // Lineman 4
            opponentName: skavenPlayers[9].name,
            diceResult: 5,
            fumble: false,
            armorBroken: true,
            opponentState: "elimine",
          });

          actions.push({
            matchId: localMatch.id,
            half: 1,
            turn: 8,
            actionType: "apothicaire",
            playerId: skavenPlayers[9].id, // Lineman 4
            playerName: skavenPlayers[9].name,
            playerTeam: "A",
            diceResult: 2,
            fumble: true,
          });

          // MI-TEMPS 2 - Tour 1 (Équipe B - Lizardmen)
          actions.push({
            matchId: localMatch.id,
            half: 2,
            turn: 1,
            actionType: "blocage",
            playerId: lizardmenPlayers[2].id, // Kroxigor
            playerName: lizardmenPlayers[2].name,
            playerTeam: "B",
            opponentId: skavenPlayers[0].id, // Rat Ogre
            opponentName: skavenPlayers[0].name,
            diceResult: 5,
            fumble: false,
            armorBroken: true,
            opponentState: "sonne",
          });

          actions.push({
            matchId: localMatch.id,
            half: 2,
            turn: 1,
            actionType: "passe",
            playerId: lizardmenPlayers[8].id, // Skink Runner 1
            playerName: lizardmenPlayers[8].name,
            playerTeam: "B",
            diceResult: 4,
            fumble: false,
            passType: "rapide",
          });

          actions.push({
            matchId: localMatch.id,
            half: 2,
            turn: 1,
            actionType: "interception",
            playerId: skavenPlayers[3].id, // Gutter Runner 1
            playerName: skavenPlayers[3].name,
            playerTeam: "A",
            opponentId: lizardmenPlayers[8].id, // Skink Runner 1
            opponentName: lizardmenPlayers[8].name,
            diceResult: 6,
            fumble: false,
          });

          // MI-TEMPS 2 - Tour 2 (Équipe A - Skavens)
          actions.push({
            matchId: localMatch.id,
            half: 2,
            turn: 2,
            actionType: "sprint",
            playerId: skavenPlayers[3].id, // Gutter Runner 1
            playerName: skavenPlayers[3].name,
            playerTeam: "A",
            diceResult: 2,
            fumble: false,
          });

          actions.push({
            matchId: localMatch.id,
            half: 2,
            turn: 2,
            actionType: "esquive",
            playerId: skavenPlayers[3].id, // Gutter Runner 1
            playerName: skavenPlayers[3].name,
            playerTeam: "A",
            diceResult: 4,
            fumble: false,
          });

          actions.push({
            matchId: localMatch.id,
            half: 2,
            turn: 2,
            actionType: "td",
            playerId: skavenPlayers[3].id, // Gutter Runner 1
            playerName: skavenPlayers[3].name,
            playerTeam: "A",
          });

          // MI-TEMPS 2 - Tour 3 (Équipe B - Lizardmen)
          actions.push({
            matchId: localMatch.id,
            half: 2,
            turn: 3,
            actionType: "blitz",
            playerId: lizardmenPlayers[4].id, // Saurus 2
            playerName: lizardmenPlayers[4].name,
            playerTeam: "B",
            opponentId: skavenPlayers[1].id, // Blitzer 1
            opponentName: skavenPlayers[1].name,
            diceResult: 3,
            fumble: false,
            armorBroken: false,
          });

          actions.push({
            matchId: localMatch.id,
            half: 2,
            turn: 3,
            actionType: "blocage",
            playerId: lizardmenPlayers[5].id, // Saurus 3
            playerName: lizardmenPlayers[5].name,
            playerTeam: "B",
            opponentId: skavenPlayers[2].id, // Blitzer 2
            opponentName: skavenPlayers[2].name,
            diceResult: 6,
            fumble: false,
            armorBroken: true,
            opponentState: "ko",
          });

          // MI-TEMPS 2 - Tour 4 (Équipe A - Skavens)
          actions.push({
            matchId: localMatch.id,
            half: 2,
            turn: 4,
            actionType: "aggression",
            playerId: skavenPlayers[0].id, // Rat Ogre
            playerName: skavenPlayers[0].name,
            playerTeam: "A",
            opponentId: lizardmenPlayers[3].id, // Saurus 1
            opponentName: lizardmenPlayers[3].name,
            diceResult: 5,
            fumble: false,
            armorBroken: true,
            opponentState: "ko",
          });

          actions.push({
            matchId: localMatch.id,
            half: 2,
            turn: 4,
            actionType: "blocage",
            playerId: skavenPlayers[1].id, // Blitzer 1
            playerName: skavenPlayers[1].name,
            playerTeam: "A",
            opponentId: lizardmenPlayers[8].id, // Skink Runner 1
            opponentName: lizardmenPlayers[8].name,
            diceResult: 4,
            fumble: false,
            armorBroken: true,
            opponentState: "sonne",
          });

          // MI-TEMPS 2 - Tour 5 (Équipe B - Lizardmen)
          actions.push({
            matchId: localMatch.id,
            half: 2,
            turn: 5,
            actionType: "passe",
            playerId: lizardmenPlayers[9].id, // Skink Runner 2
            playerName: lizardmenPlayers[9].name,
            playerTeam: "B",
            diceResult: 3,
            fumble: false,
            passType: "courte",
          });

          actions.push({
            matchId: localMatch.id,
            half: 2,
            turn: 5,
            actionType: "reception",
            playerId: lizardmenPlayers[10].id, // Skink Runner 3
            playerName: lizardmenPlayers[10].name,
            playerTeam: "B",
            diceResult: 2,
            fumble: false,
          });

          actions.push({
            matchId: localMatch.id,
            half: 2,
            turn: 5,
            actionType: "sprint",
            playerId: lizardmenPlayers[10].id, // Skink Runner 3
            playerName: lizardmenPlayers[10].name,
            playerTeam: "B",
            diceResult: 4,
            fumble: false,
          });

          // MI-TEMPS 2 - Tour 6 (Équipe A - Skavens)
          actions.push({
            matchId: localMatch.id,
            half: 2,
            turn: 6,
            actionType: "blitz",
            playerId: skavenPlayers[2].id, // Blitzer 2
            playerName: skavenPlayers[2].name,
            playerTeam: "A",
            opponentId: lizardmenPlayers[10].id, // Skink Runner 3
            opponentName: lizardmenPlayers[10].name,
            diceResult: 5,
            fumble: false,
            armorBroken: true,
            opponentState: "ko",
          });

          actions.push({
            matchId: localMatch.id,
            half: 2,
            turn: 6,
            actionType: "esquive",
            playerId: skavenPlayers[4].id, // Gutter Runner 2
            playerName: skavenPlayers[4].name,
            playerTeam: "A",
            diceResult: 1,
            fumble: true,
            playerState: "sonne",
          });

          // MI-TEMPS 2 - Tour 7 (Équipe B - Lizardmen)
          actions.push({
            matchId: localMatch.id,
            half: 2,
            turn: 7,
            actionType: "blocage",
            playerId: lizardmenPlayers[4].id, // Saurus 2
            playerName: lizardmenPlayers[4].name,
            playerTeam: "B",
            opponentId: skavenPlayers[10].id, // Lineman 5
            opponentName: skavenPlayers[10].name,
            diceResult: 4,
            fumble: false,
            armorBroken: false,
          });

          actions.push({
            matchId: localMatch.id,
            half: 2,
            turn: 7,
            actionType: "blocage",
            playerId: lizardmenPlayers[5].id, // Saurus 3
            playerName: lizardmenPlayers[5].name,
            playerTeam: "B",
            opponentId: skavenPlayers[11].id, // Lineman 6
            opponentName: skavenPlayers[11].name,
            diceResult: 5,
            fumble: false,
            armorBroken: true,
            opponentState: "ko",
          });

          // MI-TEMPS 2 - Tour 8 (Équipe A - Skavens)
          actions.push({
            matchId: localMatch.id,
            half: 2,
            turn: 8,
            actionType: "passe",
            playerId: skavenPlayers[5].id, // Thrower
            playerName: skavenPlayers[5].name,
            playerTeam: "A",
            diceResult: 6,
            fumble: false,
            passType: "longue",
          });

          actions.push({
            matchId: localMatch.id,
            half: 2,
            turn: 8,
            actionType: "reception",
            playerId: skavenPlayers[3].id, // Gutter Runner 1
            playerName: skavenPlayers[3].name,
            playerTeam: "A",
            diceResult: 4,
            fumble: false,
          });

          actions.push({
            matchId: localMatch.id,
            half: 2,
            turn: 8,
            actionType: "sprint",
            playerId: skavenPlayers[3].id, // Gutter Runner 1
            playerName: skavenPlayers[3].name,
            playerTeam: "A",
            diceResult: 3,
            fumble: false,
          });

          actions.push({
            matchId: localMatch.id,
            half: 2,
            turn: 8,
            actionType: "esquive",
            playerId: skavenPlayers[3].id, // Gutter Runner 1
            playerName: skavenPlayers[3].name,
            playerTeam: "A",
            diceResult: 2,
            fumble: false,
          });

          // Créer toutes les actions
          await prisma.localMatchAction.createMany({
            data: actions,
          });
          console.log(`   ✅ ${actions.length} actions générées pour le match`);
        } else {
          console.log(`   ⚠️  Le match a déjà ${existingActions.length} actions`);
        }
      }

      // Générer un premier round d'appariement 2 par 2 pour les autres équipes
      const allCupTeams = await prisma.cupParticipant.findMany({
        where: { cupId: cup.id },
        include: { team: true },
      });

      const teamsWithoutThisMatch = allCupTeams
        .map((p: { team: any }) => p.team)
        .filter(
          (t: { id: string }) =>
            t.id !== adminSkavenTeam.id && t.id !== userLizardmenTeam.id,
        );

      // Mélanger légèrement puis appairer 2 par 2
      const remainingTeams = [...teamsWithoutThisMatch];
      // tri déterministe par nom pour rester reproductible
      remainingTeams.sort((a, b) => a.name.localeCompare(b.name));

      for (let i = 0; i + 1 < remainingTeams.length; i += 2) {
        const teamA = remainingTeams[i];
        const teamB = remainingTeams[i + 1];

        let match = await prisma.localMatch.findFirst({
          where: {
            cupId: cup.id,
            teamAId: teamA.id,
            teamBId: teamB.id,
          },
        });

        if (!match) {
          match = await prisma.localMatch.create({
            data: {
              name: `${teamA.name} vs ${teamB.name}`,
              creatorId: adminUser.id,
              teamAId: teamA.id,
              teamBId: teamB.id,
              cupId: cup.id,
              status: "completed",
              teamAOwnerValidated: true,
              teamBOwnerValidated: true,
              scoreTeamA: 2,
              scoreTeamB: 1,
              startedAt: new Date(Date.now() - 90 * 60 * 1000),
              completedAt: new Date(Date.now() - 60 * 60 * 1000),
            },
          });
          console.log(
            `   ✅ Match local créé pour le premier round: ${teamA.name} vs ${teamB.name}`,
          );
        }

        const existingActionsForPair = await prisma.localMatchAction.count({
          where: { matchId: match.id },
        });

        if (existingActionsForPair === 0) {
          const simpleActions = [
            // Une passe de l'équipe A
            {
              matchId: match.id,
              half: 1,
              turn: 1,
              actionType: "passe",
              playerId: `${teamA.id}-p1`,
              playerName: "Lanceur A",
              playerTeam: "A" as const,
              diceResult: 4,
              fumble: false,
              passType: "courte",
            },
            // Un touchdown de l'équipe A
            {
              matchId: match.id,
              half: 1,
              turn: 2,
              actionType: "td",
              playerId: `${teamA.id}-p2`,
              playerName: "Scoreur A",
              playerTeam: "A" as const,
            },
            // Une sortie sur bloc de l'équipe B
            {
              matchId: match.id,
              half: 2,
              turn: 3,
              actionType: "blocage",
              playerId: `${teamB.id}-p1`,
              playerName: "Blocker B",
              playerTeam: "B" as const,
              opponentId: `${teamA.id}-p3`,
              opponentName: "Victime A",
              diceResult: 5,
              fumble: false,
              armorBroken: true,
              opponentState: "elimine",
            },
            // Une agression de l'équipe A
            {
              matchId: match.id,
              half: 2,
              turn: 4,
              actionType: "aggression",
              playerId: `${teamA.id}-p3`,
              playerName: "Dirty A",
              playerTeam: "A" as const,
              opponentId: `${teamB.id}-p2`,
              opponentName: "Victime B",
              diceResult: 6,
              fumble: false,
              armorBroken: true,
              opponentState: "elimine",
            },
          ];

          await prisma.localMatchAction.createMany({
            data: simpleActions,
          });
          console.log(
            `   ✅ Actions générées pour le match ${teamA.name} vs ${teamB.name}`,
          );
        }
      }
    } else {
      console.log("   ⚠️  Impossible de créer la coupe : équipes non trouvées");
    }
  } else {
    console.log("   ⚠️  Impossible de créer la coupe : utilisateurs non trouvés");
  }
  console.log("✅ Fixtures de coupe et match local terminées\n");

  // =============================================================================
  // 8. SEED DES LIGUES PAR DEFAUT (L.2 — Sprint 17)
  // =============================================================================
  console.log("🏟️  Seed des ligues par défaut...");
  const leagueCreator = await prisma.user.findUnique({
    where: { email: "admin@example.com" },
    select: { id: true },
  });
  if (leagueCreator) {
    await seedDefaultLeagues({ creatorId: leagueCreator.id });
    console.log(`   ✅ Ligue '${DEFAULT_LEAGUE_NAME}' prête (saison 1, rounds initiaux, 5 équipes prioritaires)`);
  } else {
    console.log("   ⚠️  Admin introuvable, seeder des ligues ignoré");
  }
  console.log("✅ Ligues par défaut terminées\n");
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
    console.log(`   - La ligue '${DEFAULT_LEAGUE_NAME}' est prête`);
  })
  .catch(async (e) => {
    console.error("❌ Erreur lors du seed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
