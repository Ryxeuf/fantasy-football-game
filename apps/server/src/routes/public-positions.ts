/**
 * Route publique pour récupérer les positions
 * Accessible sans authentification
 */

import { Router } from "express";
import { prisma } from "../prisma";

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
    const where: any = {};
    
    if (rosterSlug) {
      where.roster = {
        slug: rosterSlug as string,
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

    res.json({ positions: transformedPositions });
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
    
    const position = await prisma.position.findFirst({
      where: { slug },
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

    res.json({ position: transformedPosition });
  } catch (error: any) {
    console.error("Erreur lors de la récupération de la position:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

export default router;


