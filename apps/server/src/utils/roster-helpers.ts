/**
 * Fonctions helpers pour récupérer les rosters depuis la base de données
 */

import {
  DEFAULT_RULESET,
  translateKeywordsCsv,
  getTeamSpecialRuleBySlug,
  type Ruleset,
} from "@bb/game-engine";
import { prisma } from "../prisma";

/**
 * Résout `Roster.specialRules` (CSV de slugs) en vues localisées
 * (slug + nom + description) via le catalogue game-engine. Les slugs
 * inconnus (ex: sentinelle "NONE") sont ignorés. Mutualise la même logique
 * que la route publique sans créer de cycle d'import routes ↔ utils.
 */
export interface RosterSpecialRuleView {
  slug: string;
  name: string;
  description: string;
}

export function resolveSpecialRulesCsv(
  raw: string | null | undefined,
  isEnglish: boolean,
): RosterSpecialRuleView[] {
  const out: RosterSpecialRuleView[] = [];
  for (const slug of (raw ?? "")
    .split(/[,\s]+/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)) {
    const def = getTeamSpecialRuleBySlug(slug);
    if (!def) continue;
    out.push({
      slug: def.slug,
      name: isEnglish ? def.nameEn : def.nameFr,
      description:
        isEnglish && def.descriptionEn ? def.descriptionEn : def.description,
    });
  }
  return out;
}

// In-process cache. Roster data is effectively static between seeds, and
// this helper is called many times per team creation/display cycle. A short
// TTL means admin-driven roster edits propagate within minutes without
// requiring explicit invalidation.
//
// Hors production (dev/test), on désactive le cache (TTL 0 = toujours frais)
// pour que les éditions DB directes se voient immédiatement et que le builder
// (/team/rosters) reste cohérent avec la page roster publique (/api/rosters),
// qui possède son propre cache. Le single-flight protège quand même des
// stampedes. En prod, on garde 5 min pour soulager Prisma.
const ROSTER_TTL_MS =
  process.env.NODE_ENV === "production" ? 5 * 60 * 1000 : 0;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface RosterPosition {
  slug: string;
  displayName: string;
  cost: number;
  min: number;
  max: number;
  ma: number;
  st: number;
  ag: number;
  pa: number | null; // null = pas de passe ("-")
  av: number;
  skills: string;
  // Mots-clés (lignée/type du joueur) localisés. CSV ; `null` si aucun.
  keywords: string | null;
  keywordsEn: string | null;
  // Accès aux compétences en montée de niveau (BB Season 3). CSV "G,A,S,P,M".
  // `null` = non renseigné (ex: season_2). Exposé pour l'affichage builder (E5).
  primarySkills: string | null;
  secondarySkills: string | null;
}

export interface RosterPayload {
  name: string;
  budget: number;
  tier: string;
  naf: boolean;
  positions: RosterPosition[];
  /** Règles spéciales d'équipe résolues (vide si aucune). Localisées. */
  specialRules: RosterSpecialRuleView[];
}

const singleRosterCache = new Map<string, CacheEntry<RosterPayload>>();
const allRostersCache = new Map<string, CacheEntry<Record<string, RosterPayload>>>();

function cacheGet<T>(store: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    store.delete(key);
    return undefined;
  }
  return entry.value;
}

function cacheSet<T>(
  store: Map<string, CacheEntry<T>>,
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
): Promise<RosterPayload | null> {
  const cacheKey = `${slug}::${lang}::${ruleset}`;
  const cached = cacheGet(singleRosterCache, cacheKey);
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
      keywords: position.keywords ?? null,
      keywordsEn: translateKeywordsCsv(position.keywords ?? null, "en"),
      primarySkills: position.primarySkills ?? null,
      secondarySkills: position.secondarySkills ?? null,
    })),
    specialRules: resolveSpecialRulesCsv(roster.specialRules, isEnglish),
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
): Promise<Record<string, RosterPayload>> {
  const cacheKey = `${lang}::${ruleset}`;
  const cached = cacheGet(allRostersCache, cacheKey);
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
  const result: Record<string, RosterPayload> = {};
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
        keywords: position.keywords ?? null,
        keywordsEn: translateKeywordsCsv(position.keywords ?? null, "en"),
        primarySkills: position.primarySkills ?? null,
        secondarySkills: position.secondarySkills ?? null,
      })),
      specialRules: resolveSpecialRulesCsv(roster.specialRules, isEnglish),
    };
  }
  cacheSet(allRostersCache, cacheKey, result);
  return result;
}


