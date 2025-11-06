/**
 * Route publique pour récupérer les rosters
 * Accessible sans authentification
 */

import { Router } from "express";
import { prisma } from "../prisma";

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
    
    const rosters = await prisma.roster.findMany({
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
      _count: roster._count,
    }));
    
    res.json({ rosters: transformedRosters });
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
      return res.status(404).json({ error: "Roster non trouvé" });
    }

    // Transformer les données pour correspondre au format attendu
    const transformedRoster = {
      slug: roster.slug,
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

    res.json({ roster: transformedRoster });
  } catch (error: any) {
    console.error("Erreur lors de la récupération du roster:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

export default router;


