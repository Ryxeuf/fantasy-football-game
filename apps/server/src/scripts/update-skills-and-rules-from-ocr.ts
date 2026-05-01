/**
 * Mise à jour idempotente Saison 3 — données issues de l'OCR officiel.
 *
 * Ce script est SAFE en production :
 *   - aucune suppression de données existantes ;
 *   - aucune modification des positions, joueurs, équipes, matchs, etc. ;
 *   - uniquement des UPDATE/UPSERT ciblés sur :
 *      • `Skill`     : descriptions FR/EN pour les slugs S3 couverts par
 *        `SEASON_3_SKILL_DESCRIPTIONS` (ruleset = season_3 uniquement) ;
 *      • `TeamSpecialRule` (S3) : catalogue des règles spéciales d'équipe
 *        depuis `TEAM_SPECIAL_RULES` ;
 *      • `RegionalLeague`  (S3) : catalogue des ligues régionales depuis
 *        `REGIONAL_LEAGUES`.
 *
 * Utilisation :
 *   pnpm --filter @bb/server tsx src/scripts/update-skills-and-rules-from-ocr.ts
 */

import { prisma } from "../prisma";
import { serverLog } from "../utils/server-log";
import { SEASON_3_SKILL_DESCRIPTIONS } from "../static-skills-data-s3";
import { TEAM_SPECIAL_RULES } from "../../../../packages/game-engine/src/rosters/team-special-rules";
import { REGIONAL_LEAGUES } from "../../../../packages/game-engine/src/rosters/regional-leagues";

const RULESET = "season_3" as const;

async function updateSkillDescriptions(): Promise<void> {
  serverLog.log("📚 Mise à jour des descriptions de Compétences/Traits Saison 3 (OCR)...");

  const slugs = Object.keys(SEASON_3_SKILL_DESCRIPTIONS);
  let updated = 0;
  let missing = 0;

  for (const slug of slugs) {
    const ocr = SEASON_3_SKILL_DESCRIPTIONS[slug];
    if (!ocr) continue;

    const existing = await prisma.skill.findUnique({
      where: { slug_ruleset: { slug, ruleset: RULESET } },
    });

    if (!existing) {
      // On ne CRÉE PAS de skill ici : la création reste de la responsabilité
      // du seed principal (qui dépend de SKILLS_DEFINITIONS). Si le slug
      // n'existe pas encore en base, on log juste pour info.
      serverLog.log(`   ⚠️  Skill ${slug} (season_3) absent en base — skip`);
      missing++;
      continue;
    }

    await prisma.skill.update({
      where: { slug_ruleset: { slug, ruleset: RULESET } },
      data: {
        description: ocr.description,
        descriptionEn: ocr.descriptionEn ?? existing.descriptionEn,
      },
    });
    updated++;
  }

  serverLog.log(
    `✅ Skills (season_3) mis à jour : ${updated} / ${slugs.length} (manquants : ${missing})\n`,
  );
}

async function upsertTeamSpecialRules(): Promise<void> {
  serverLog.log("🛡️  Upsert des Règles Spéciales d'équipe Saison 3 (OCR)...");

  let created = 0;
  let updated = 0;

  for (const rule of TEAM_SPECIAL_RULES) {
    const existing = await prisma.teamSpecialRule.findUnique({
      where: { slug_ruleset: { slug: rule.slug, ruleset: RULESET } },
    });

    if (existing) {
      await prisma.teamSpecialRule.update({
        where: { slug_ruleset: { slug: rule.slug, ruleset: RULESET } },
        data: {
          nameFr: rule.nameFr,
          nameEn: rule.nameEn,
          description: rule.description,
          descriptionEn: rule.descriptionEn ?? null,
        },
      });
      updated++;
    } else {
      await prisma.teamSpecialRule.create({
        data: {
          slug: rule.slug,
          ruleset: RULESET,
          nameFr: rule.nameFr,
          nameEn: rule.nameEn,
          description: rule.description,
          descriptionEn: rule.descriptionEn ?? null,
        },
      });
      created++;
    }
  }

  serverLog.log(
    `✅ TeamSpecialRule : ${created} créées, ${updated} mises à jour\n`,
  );
}

async function upsertRegionalLeagues(): Promise<void> {
  serverLog.log("🏟️  Upsert des Ligues régionales Saison 3 (OCR)...");

  let created = 0;
  let updated = 0;

  for (const league of REGIONAL_LEAGUES) {
    const existing = await prisma.regionalLeague.findUnique({
      where: { slug_ruleset: { slug: league.slug, ruleset: RULESET } },
    });

    if (existing) {
      await prisma.regionalLeague.update({
        where: { slug_ruleset: { slug: league.slug, ruleset: RULESET } },
        data: {
          nameFr: league.nameFr,
          nameEn: league.nameEn,
          description: league.description,
          descriptionEn: league.descriptionEn ?? null,
        },
      });
      updated++;
    } else {
      await prisma.regionalLeague.create({
        data: {
          slug: league.slug,
          ruleset: RULESET,
          nameFr: league.nameFr,
          nameEn: league.nameEn,
          description: league.description,
          descriptionEn: league.descriptionEn ?? null,
        },
      });
      created++;
    }
  }

  serverLog.log(
    `✅ RegionalLeague : ${created} créées, ${updated} mises à jour\n`,
  );
}

async function main(): Promise<void> {
  serverLog.log("🌱 OCR S3 → mise à jour idempotente des données du jeu...\n");

  await updateSkillDescriptions();
  await upsertTeamSpecialRules();
  await upsertRegionalLeagues();

  serverLog.log("🎉 Mise à jour OCR Saison 3 terminée.");
}

main()
  .catch((e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    serverLog.error("❌ Erreur OCR S3 :", msg);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
