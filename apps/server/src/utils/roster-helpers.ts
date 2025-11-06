/**
 * Fonctions helpers pour récupérer les rosters depuis la base de données
 */

import { prisma } from "../prisma";

/**
 * Récupère un roster complet depuis la base de données avec ses positions et leurs compétences
 * @param slug - Le slug du roster
 * @param lang - La langue ('fr' ou 'en', par défaut 'fr')
 */
export async function getRosterFromDb(slug: string, lang: string = "fr") {
  const roster = await prisma.roster.findUnique({
    where: { slug },
    include: {
      positions: {
        include: {
          skills: {
            include: { skill: true },
          },
        },
        orderBy: { displayName: "asc" },
      },
    },
  });

  if (!roster) {
    return null;
  }

  const isEnglish = lang === "en";

  // Transformer les données pour correspondre au format attendu (compatible avec TEAM_ROSTERS)
  return {
    name: isEnglish ? roster.nameEn : roster.name,
    budget: roster.budget,
    tier: roster.tier,
    naf: roster.naf,
    positions: roster.positions.map((position) => ({
      slug: position.slug,
      displayName: position.displayName,
      cost: position.cost,
      min: position.min,
      max: position.max,
      ma: position.ma,
      st: position.st,
      ag: position.ag,
      pa: position.pa,
      av: position.av,
      skills: position.skills
        .map((ps) => ps.skill.slug)
        .join(","),
    })),
  };
}

/**
 * Récupère tous les rosters depuis la base de données
 * @param lang - La langue ('fr' ou 'en', par défaut 'fr')
 */
export async function getAllRostersFromDb(lang: string = "fr") {
  const rosters = await prisma.roster.findMany({
    include: {
      positions: {
        include: {
          skills: {
            include: { skill: true },
          },
        },
        orderBy: { displayName: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const isEnglish = lang === "en";

  // Transformer les données pour correspondre au format attendu
  const result: Record<string, any> = {};
  for (const roster of rosters) {
    result[roster.slug] = {
      name: isEnglish ? roster.nameEn : roster.name,
      budget: roster.budget,
      tier: roster.tier,
      naf: roster.naf,
      positions: roster.positions.map((position) => ({
        slug: position.slug,
        displayName: position.displayName,
        cost: position.cost,
        min: position.min,
        max: position.max,
        ma: position.ma,
        st: position.st,
        ag: position.ag,
        pa: position.pa,
        av: position.av,
        skills: position.skills
          .map((ps) => ps.skill.slug)
          .join(","),
      })),
    };
  }
  return result;
}


