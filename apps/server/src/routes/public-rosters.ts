/**
 * Route publique pour récupérer les rosters
 * Accessible sans authentification
 */

import { Router } from "express";
import {
  getPositionNameEn,
  translateKeywordsCsv,
  getTeamSpecialRuleBySlug,
  getRegionalLeagueBySlug,
  getRegionalRulesForTeam,
  defaultStaffConfig,
  FORMATS,
  type GameFormat,
  type RosterStaffConfig,
  type Ruleset,
} from "@bb/game-engine";
import { prisma } from "../prisma";
import {
  resolveRuleset,
  DEFAULT_RULESET,
  RULESETS,
} from "../utils/ruleset-helpers";
import { memoizeAsync } from "../utils/memoize-async";
import { serverLog } from "../utils/server-log";
import { getRosterPositionStats } from "../services/position-usage-stats";

const router = Router();

// 5 min matches the existing roster-helpers cache in utils/roster-helpers.ts
// so admin-driven reseeds propagate quickly without explicit invalidation.
// Hors production, TTL 0 (toujours frais) : aligné avec roster-helpers pour
// que les éditions DB directes se voient tout de suite et que builder/page
// roster restent cohérents en dev. Single-flight conservé contre les stampedes.
const ROSTER_CACHE_TTL_MS =
  process.env.NODE_ENV === "production" ? 5 * 60 * 1000 : 0;
const ROSTER_LIST_NS = "public-rosters-list";
const ROSTER_DETAIL_NS = "public-rosters-detail";
const POSITION_STATS_NS = "public-position-stats";

interface RosterListPayload {
  rosters: Array<{
    slug: string;
    name: string;
    budget: number;
    tier: string;
    naf: boolean;
    ruleset?: string;
    _count: { positions: number };
    /** Config staff par format (DB ; défaut dérivé sinon). Coûts en po. */
    staffConfigs: Record<GameFormat, RosterStaffConfig>;
  }>;
  ruleset: string;
  availableRulesets: readonly string[];
}

/**
 * Règle spéciale d'équipe résolue (A11). `name`/`description` sont déjà
 * localisés selon la langue demandée côté serveur.
 */
interface RosterSpecialRuleView {
  slug: string;
  name: string;
  description: string;
}

/** Ligue régionale ("type de ligue") résolue (A11). `name` déjà localisé. */
interface RosterRegionalLeagueView {
  slug: string;
  name: string;
}

interface RosterDetailPayload {
  roster: {
    slug: string;
    name: string;
    budget: number;
    tier: string;
    naf: boolean;
    positions: Array<{
      slug: string;
      displayName: string;
      cost: number;
      min: number;
      max: number;
      ma: number;
      st: number;
      ag: number;
      pa: number | null;
      av: number;
      skills: string;
      keywords: string | null;
      keywordsEn: string | null;
      primarySkills: string | null;
      secondarySkills: string | null;
    }>;
    /** A11 — règles spéciales d'équipe résolues (vide si aucune). */
    specialRules: RosterSpecialRuleView[];
    /** A11 — ligues régionales / "type de ligue" résolues (vide si aucune). */
    regionalLeagues: RosterRegionalLeagueView[];
    /** Config staff par format (DB ; défaut dérivé si pas de ligne). Coûts en po. */
    staffConfigs: Record<GameFormat, RosterStaffConfig>;
  };
  ruleset: string;
}

/**
 * Parse tolérant d'un champ "liste de slugs" stocké en base : tableau natif
 * (PG), chaîne JSON sérialisée (sqlite mirror), CSV libre, ou null/undefined.
 * Sert pour `Roster.specialRules` (souvent null ou texte libre tel que "NONE")
 * et `Roster.regionalRules` (JSON array de slugs de ligues régionales).
 */
export function parseSlugList(raw: unknown): string[] {
  const fromArray = (arr: unknown[]): string[] =>
    arr.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .map((s) => s.trim());
  if (Array.isArray(raw)) return fromArray(raw);
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed.length === 0) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return fromArray(parsed);
      if (typeof parsed === "string" && parsed.trim().length > 0) {
        return [parsed.trim()];
      }
    } catch {
      // Pas du JSON : on retombe sur un split CSV.
    }
    return trimmed
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return [];
}

/**
 * Résout les règles spéciales d'équipe (A11). Les slugs non mappés (ex: la
 * sentinelle "NONE") sont silencieusement ignorés. `name`/`description` sont
 * localisés selon `isEnglish`.
 */
export function resolveSpecialRules(
  raw: unknown,
  isEnglish: boolean,
): RosterSpecialRuleView[] {
  const out: RosterSpecialRuleView[] = [];
  for (const slug of parseSlugList(raw)) {
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

/**
 * Résout les ligues régionales ("type de ligue") d'une équipe (A11). On part
 * de `Roster.regionalRules` (slugs en base) avec un fallback sur la table
 * canonique `getRegionalRulesForTeam(slug, ruleset)` quand la colonne est
 * vide — utile en Saison 3 où les rosters ne renseignent pas ce champ inline.
 * Les slugs non mappés sont ignorés proprement.
 */
export function resolveRegionalLeagues(
  raw: unknown,
  rosterSlug: string,
  ruleset: Ruleset,
  isEnglish: boolean,
): RosterRegionalLeagueView[] {
  let slugs = parseSlugList(raw);
  if (slugs.length === 0) {
    slugs = getRegionalRulesForTeam(rosterSlug, ruleset);
  }
  const out: RosterRegionalLeagueView[] = [];
  const seen = new Set<string>();
  for (const slug of slugs) {
    if (seen.has(slug)) continue;
    const def = getRegionalLeagueBySlug(slug);
    if (!def) continue;
    seen.add(slug);
    out.push({ slug: def.slug, name: isEnglish ? def.nameEn : def.nameFr });
  }
  return out;
}

async function loadRosterList(
  lang: string,
  ruleset: string,
): Promise<RosterListPayload> {
  const isEnglish = lang === "en";
  const rosters = await prisma.roster.findMany({
    where: { ruleset },
    orderBy: { name: "asc" },
    select: {
      slug: true,
      name: true,
      nameEn: true,
      budget: true,
      tier: true,
      naf: true,
      _count: { select: { positions: true } },
      staffConfigs: true,
    },
  });

  if (rosters.length === 0) {
    serverLog.warn(
      `[public-rosters] No rosters found for ruleset=${ruleset}. ` +
        "The database may need a seed for this ruleset.",
    );
  }

  return {
    rosters: rosters.map((roster: any) => ({
      slug: roster.slug,
      name: isEnglish ? roster.nameEn : roster.name,
      budget: roster.budget,
      tier: roster.tier,
      naf: roster.naf,
      _count: roster._count,
      staffConfigs: staffConfigsByFormat(roster),
    })),
    ruleset,
    availableRulesets: RULESETS,
  };
}

async function loadRosterDetail(
  slug: string,
  lang: string,
  ruleset: string,
): Promise<RosterDetailPayload | null> {
  const isEnglish = lang === "en";
  const roster = await prisma.roster.findFirst({
    where: { slug, ruleset },
    include: {
      positions: {
        include: {
          skills: { include: { skill: true } },
        },
        orderBy: { displayName: "asc" },
      },
      staffConfigs: true,
    },
  });

  if (roster) {
    return {
      roster: transformRoster(roster, isEnglish, ruleset as Ruleset),
      ruleset,
    };
  }
  if (ruleset !== DEFAULT_RULESET) {
    const fallback = await prisma.roster.findFirst({
      where: { slug, ruleset: DEFAULT_RULESET },
      include: {
        positions: {
          include: {
            skills: { include: { skill: true } },
          },
          orderBy: { displayName: "asc" },
        },
      },
    });
    if (fallback) {
      return {
        roster: transformRoster(
          fallback,
          isEnglish,
          DEFAULT_RULESET as Ruleset,
        ),
        ruleset: DEFAULT_RULESET,
      };
    }
  }
  return null;
}

/**
 * GET /api/rosters
 * Obtenir la liste complète des rosters
 * Query param: ?lang=en ou ?lang=fr (par défaut: fr)
 */
router.get("/rosters", async (req, res) => {
  try {
    const lang = (req.query.lang as string) || "fr";
    const ruleset = resolveRuleset(req.query.ruleset as string | undefined);
    const payload = await memoizeAsync(
      ROSTER_LIST_NS,
      `${lang}::${ruleset}`,
      ROSTER_CACHE_TTL_MS,
      () => loadRosterList(lang, ruleset),
    );
    res.json(payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    serverLog.error("Erreur lors de la récupération des rosters:", error);
    res.setHeader("Cache-Control", "no-store");
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/rosters/:slug
 * Obtenir les détails d'un roster par son slug
 * Query param: ?lang=en ou ?lang=fr (par défaut: fr)
 */
router.get("/rosters/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const lang = (req.query.lang as string) || "fr";
    const ruleset = resolveRuleset(req.query.ruleset as string | undefined);
    const payload = await memoizeAsync(
      ROSTER_DETAIL_NS,
      `${slug}::${lang}::${ruleset}`,
      ROSTER_CACHE_TTL_MS,
      () => loadRosterDetail(slug, lang, ruleset),
    );
    if (!payload) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(404).json({ error: "Roster non trouvé" });
    }
    res.json(payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    serverLog.error("Erreur lors de la récupération du roster:", error);
    res.setHeader("Cache-Control", "no-store");
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/rosters/:slug/positions-stats
 * Statistiques d'usage par position du roster (nombre de joueurs créés +
 * moyennes carrière), agrégées depuis les équipes réelles des coachs.
 * Query param: ?ruleset=season_2|season_3 (par défaut: édition courante).
 */
router.get("/rosters/:slug/positions-stats", async (req, res) => {
  try {
    const { slug } = req.params;
    const ruleset = resolveRuleset(req.query.ruleset as string | undefined);
    const payload = await memoizeAsync(
      POSITION_STATS_NS,
      `${slug}::${ruleset}`,
      ROSTER_CACHE_TTL_MS,
      async () => {
        const stats = await getRosterPositionStats(slug, ruleset);
        return { rosterSlug: slug, ruleset, ...stats };
      },
    );
    res.json(payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    serverLog.error(
      "Erreur lors de la récupération des stats de positions:",
      error,
    );
    res.setHeader("Cache-Control", "no-store");
    res.status(500).json({ error: message });
  }
});

function transformRoster(roster: any, isEnglish: boolean, ruleset: Ruleset) {
  return {
    slug: roster.slug,
    name: isEnglish ? roster.nameEn : roster.name,
    budget: roster.budget,
    tier: roster.tier,
    naf: roster.naf,
    positions: roster.positions.map((position: any) => ({
      slug: position.slug,
      displayName: position.displayName,
      displayNameEn: getPositionNameEn(position.slug) ?? null,
      cost: position.cost,
      min: position.min,
      max: position.max,
      ma: position.ma,
      st: position.st,
      ag: position.ag,
      pa: position.pa,
      av: position.av,
      skills: position.skills.map((ps: any) => ps.skill.slug).join(","),
      keywords: position.keywords ?? null,
      keywordsEn: translateKeywordsCsv(position.keywords ?? null, "en"),
      primarySkills: position.primarySkills ?? null,
      secondarySkills: position.secondarySkills ?? null,
    })),
    specialRules: resolveSpecialRules(roster.specialRules, isEnglish),
    regionalLeagues: resolveRegionalLeagues(
      roster.regionalRules,
      roster.slug,
      ruleset,
      isEnglish,
    ),
    staffConfigs: staffConfigsByFormat(roster),
  };
}

/**
 * Construit la config staff par format pour un roster : ligne DB si présente,
 * sinon défaut dérivé des constantes (`defaultStaffConfig`). Coûts en po.
 */
function staffConfigsByFormat(
  roster: any,
): Record<GameFormat, RosterStaffConfig> {
  const out = {} as Record<GameFormat, RosterStaffConfig>;
  for (const format of FORMATS) {
    const row = roster.staffConfigs?.find((s: any) => s.format === format);
    out[format] = row
      ? {
          rerollCost: row.rerollCost,
          maxRerolls: row.maxRerolls,
          apothecaryAllowed: row.apothecaryAllowed,
          apothecaryCost: row.apothecaryCost,
          maxCheerleaders: row.maxCheerleaders,
          cheerleaderCost: row.cheerleaderCost,
          maxAssistants: row.maxAssistants,
          assistantCost: row.assistantCost,
          maxDedicatedFans: row.maxDedicatedFans,
          dedicatedFanCost: row.dedicatedFanCost,
        }
      : defaultStaffConfig(roster.slug, format);
  }
  return out;
}

export default router;
