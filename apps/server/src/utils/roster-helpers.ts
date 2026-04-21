/**
 * Fonctions helpers pour récupérer les rosters depuis la base de données
 */

import { DEFAULT_RULESET, type Ruleset } from "@bb/game-engine";
import { prisma } from "../prisma";

// In-process cache. Roster data is effectively static between seeds, and
// this helper is called many times per team creation/display cycle. A short
// TTL means admin-driven roster edits propagate within minutes without
// requiring explicit invalidation.
const ROSTER_TTL_MS = 5 * 60 * 1000;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const singleRosterCache = new Map<string, CacheEntry<unknown>>();
const allRostersCache = new Map<string, CacheEntry<unknown>>();

function cacheGet<T>(store: Map<string, CacheEntry<unknown>>, key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

function cacheSet<T>(
  store: Map<string, CacheEntry<unknown>>,
  key: string,
  value: T,
) {
  store.set(key, { value, expiresAt: Date.now() + ROSTER_TTL_MS });
}

/** Invalidate every cached roster entry — call after admin-driven reseeds. */
export function invalidateRosterCache(): void {
  singleRosterCache.clear();
  allRostersCache.clear();
}

/**
 * Récupère un roster complet depuis la base de données avec ses positions et leurs compétences
 * @param slug - Le slug du roster
 * @param lang - La langue ('fr' ou 'en', par défaut 'fr')
 * @param ruleset - Le ruleset ciblé (par défaut Saison 2)
 */
export async function getRosterFromDb(
  slug: string,
  lang: string = "fr",
  ruleset: Ruleset = DEFAULT_RULESET,
) {
  const cacheKey = `${slug}::${lang}::${ruleset}`;
  const cached = cacheGet<unknown>(singleRosterCache, cacheKey);
  if (cached !== undefined) {
    return cached;
  }
  const roster = await prisma.roster.findFirst({
    where: { slug, ruleset },
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
    if (ruleset !== DEFAULT_RULESET) {
      return getRosterFromDb(slug, lang, DEFAULT_RULESET);
    }
    return null;
  }

  const isEnglish = lang === "en";

  // Transformer les données pour correspondre au format attendu (compatible avec TEAM_ROSTERS)
  const result = {
    name: isEnglish ? roster.nameEn : roster.name,
    budget: roster.budget,
    tier: roster.tier,
    naf: roster.naf,
    positions: roster.positions.map((position: any) => ({
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
        .map((ps: any) => ps.skill.slug)
        .join(","),
    })),
  };

  cacheSet(singleRosterCache, cacheKey, result);
  return result;
}

/**
 * Récupère tous les rosters depuis la base de données
 * @param lang - La langue ('fr' ou 'en', par défaut 'fr')
 * @param ruleset - Le ruleset ciblé
 */
export async function getAllRostersFromDb(
  lang: string = "fr",
  ruleset: Ruleset = DEFAULT_RULESET,
) {
  const cacheKey = `${lang}::${ruleset}`;
  const cached = cacheGet<Record<string, unknown>>(allRostersCache, cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const rosters = await prisma.roster.findMany({
    where: { ruleset },
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
      positions: roster.positions.map((position: any) => ({
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
          .map((ps: any) => ps.skill.slug)
          .join(","),
      })),
    };
  }
  cacheSet(allRostersCache, cacheKey, result);
  return result;
}


