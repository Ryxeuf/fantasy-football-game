/**
 * Route publique pour récupérer les rosters
 * Accessible sans authentification
 */

import { Router } from "express";
import { prisma } from "../prisma";
import { resolveRuleset, DEFAULT_RULESET } from "../utils/ruleset-helpers";

const router = Router();

/**
 * GET /api/rosters
 * Obtenir la liste complète des rosters
 * Query param: ?lang=en ou ?lang=fr (par défaut: fr)
 */

router.get("/rosters", async (req, res) => {
  try {
    const lang = (req.query.lang as string) || "fr";
    const isEnglish = lang === "en";
    const ruleset = resolveRuleset(req.query.ruleset as string | undefined);
    
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
        _count: {
          select: { positions: true },
        },
      },
    });
    
    // Transformer les rosters pour utiliser le nom approprié selon la langue
    const transformedRosters = rosters.map(roster => ({
      slug: roster.slug,
      name: isEnglish ? roster.nameEn : roster.name,
      budget: roster.budget,
      tier: roster.tier,
      naf: roster.naf,
      ruleset: roster.ruleset,
      _count: roster._count,
    }));
    
    res.json({ rosters: transformedRosters, ruleset });
  } catch (error: any) {
    console.error("Erreur lors de la récupération des rosters:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
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
    const isEnglish = lang === "en";
    const ruleset = resolveRuleset(req.query.ruleset as string | undefined);
    
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
        const fallbackRoster = await prisma.roster.findFirst({
          where: { slug, ruleset: DEFAULT_RULESET },
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
        if (!fallbackRoster) {
          return res.status(404).json({ error: "Roster non trouvé" });
        }
        return res.json({
          roster: transformRoster(fallbackRoster, isEnglish),
          ruleset: DEFAULT_RULESET,
        });
      }
      return res.status(404).json({ error: "Roster non trouvé" });
    }

    res.json({ roster: transformRoster(roster, isEnglish), ruleset });
  } catch (error: any) {
    console.error("Erreur lors de la récupération du roster:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
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
      skills: position.skills
        .map((ps: any) => ps.skill.slug)
        .join(","),
    })),
  };
}

export default router;


