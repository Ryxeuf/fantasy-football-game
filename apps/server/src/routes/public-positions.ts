/**
 * Route publique pour récupérer les positions
 * Accessible sans authentification
 */

import { Router } from "express";
import { prisma } from "../prisma";
import { resolveRuleset, DEFAULT_RULESET } from "../utils/ruleset-helpers";

const router = Router();

/**
 * GET /api/positions
 * Obtenir la liste des positions (optionnellement filtrées par roster)
 * Query param: ?lang=en ou ?lang=fr (par défaut: fr)
 */
router.get("/positions", async (req, res) => {
  try {
    const { rosterSlug } = req.query;
    const lang = (req.query.lang as string) || "fr";
    const isEnglish = lang === "en";
    const ruleset = resolveRuleset(req.query.ruleset as string | undefined);
    const where: any = {
      roster: {
        ruleset,
      },
    };
    
    if (rosterSlug) {
      where.roster = {
        slug: rosterSlug as string,
        ruleset,
      };
    }

    const positions = await prisma.position.findMany({
      where,
      include: {
        roster: {
          select: {
            slug: true,
            name: true,
            nameEn: true,
          },
        },
        skills: {
          include: { skill: true },
        },
      },
      orderBy: [{ roster: { name: "asc" } }, { displayName: "asc" }],
    });

    // Transformer les données pour correspondre au format attendu
    const transformedPositions = positions.map((position) => ({
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
      rosterSlug: position.roster.slug,
      rosterName: isEnglish ? position.roster.nameEn : position.roster.name,
    }));

    res.json({ positions: transformedPositions, ruleset });
  } catch (error: any) {
    console.error("Erreur lors de la récupération des positions:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

/**
 * GET /api/positions/:slug
 * Obtenir une position par son slug
 * Query param: ?lang=en ou ?lang=fr (par défaut: fr)
 */
router.get("/positions/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const lang = (req.query.lang as string) || "fr";
    const isEnglish = lang === "en";
    const ruleset = resolveRuleset(req.query.ruleset as string | undefined);
    
    const position = await prisma.position.findFirst({
      where: {
        slug,
        roster: { ruleset },
      },
      include: {
        roster: {
          select: {
            slug: true,
            name: true,
            nameEn: true,
          },
        },
        skills: {
          include: { skill: true },
        },
      },
    });

    if (!position) {
      if (ruleset !== DEFAULT_RULESET) {
        const fallback = await prisma.position.findFirst({
          where: {
            slug,
            roster: { ruleset: DEFAULT_RULESET },
          },
          include: {
            roster: {
              select: {
                slug: true,
                name: true,
                nameEn: true,
              },
            },
            skills: {
              include: { skill: true },
            },
          },
        });
        if (!fallback) {
          return res.status(404).json({ error: "Position non trouvée" });
        }
        return res.json({ position: transformPosition(fallback, isEnglish), ruleset: DEFAULT_RULESET });
      }
      return res.status(404).json({ error: "Position non trouvée" });
    }

    // Transformer les données
    const transformedPosition = {
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
      rosterSlug: position.roster.slug,
      rosterName: isEnglish ? position.roster.nameEn : position.roster.name,
    };

    res.json({ position: transformedPosition, ruleset });
  } catch (error: any) {
    console.error("Erreur lors de la récupération de la position:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

function transformPosition(position: any, isEnglish: boolean) {
  return {
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
    rosterSlug: position.roster.slug,
    rosterName: isEnglish ? position.roster.nameEn : position.roster.name,
  };
}

export default router;


