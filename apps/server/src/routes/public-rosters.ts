/**
 * Route publique pour récupérer les rosters
 * Accessible sans authentification
 */

import { Router } from "express";
import { prisma } from "../prisma";
import {
  resolveRuleset,
  DEFAULT_RULESET,
  RULESETS,
} from "../utils/ruleset-helpers";
import { memoizeAsync } from "../utils/memoize-async";

const router = Router();

// 5 min matches the existing roster-helpers cache in utils/roster-helpers.ts
// so admin-driven reseeds propagate quickly without explicit invalidation.
const ROSTER_CACHE_TTL_MS = 5 * 60 * 1000;
const ROSTER_LIST_NS = "public-rosters-list";
const ROSTER_DETAIL_NS = "public-rosters-detail";

interface RosterListPayload {
  rosters: Array<{
    slug: string;
    name: string;
    budget: number;
    tier: string;
    naf: boolean;
    ruleset?: string;
    _count: { positions: number };
  }>;
  ruleset: string;
  availableRulesets: readonly string[];
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
      pa: number;
      av: number;
      skills: string;
    }>;
  };
  ruleset: string;
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
    },
  });

  if (rosters.length === 0) {
    console.warn(
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
    },
  });

  if (roster) {
    return { roster: transformRoster(roster, isEnglish), ruleset };
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
        roster: transformRoster(fallback, isEnglish),
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
    console.error("Erreur lors de la récupération des rosters:", error);
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
    console.error("Erreur lors de la récupération du roster:", error);
    res.setHeader("Cache-Control", "no-store");
    res.status(500).json({ error: message });
  }
});

function transformRoster(roster: any, isEnglish: boolean) {
  return {
    slug: roster.slug,
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
      skills: position.skills.map((ps: any) => ps.skill.slug).join(","),
    })),
  };
}

export default router;
