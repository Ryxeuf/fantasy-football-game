/**
 * Route publique pour récupérer les compétences
 * Accessible sans authentification
 */

import { Router } from "express";
import { prisma } from "../prisma";
import { resolveRuleset } from "../utils/ruleset-helpers";

const router = Router();

router.get("/skills", async (req, res) => {
  try {
    const { category, search, ruleset } = req.query;
    const where: any = {};
    
    if (category) {
      where.category = category;
    }

    // Filtre obligatoire par ruleset (par défaut season_2)
    where.ruleset = resolveRuleset(ruleset as string | undefined);
    
    if (search) {
      where.OR = [
        { slug: { contains: search as string, mode: "insensitive" } },
        { nameFr: { contains: search as string, mode: "insensitive" } },
        { nameEn: { contains: search as string, mode: "insensitive" } },
        { description: { contains: search as string, mode: "insensitive" } },
        { descriptionEn: { contains: search as string, mode: "insensitive" } },
      ];
    }

    const skills = await prisma.skill.findMany({
      where,
      orderBy: [{ category: "asc" }, { nameFr: "asc" }],
      select: {
        id: true,
        slug: true,
        ruleset: true,
        nameFr: true,
        nameEn: true,
        description: true,
        descriptionEn: true,
        category: true,
      },
    });
    res.json({ skills });
  } catch (error: any) {
    console.error("Erreur lors de la récupération des compétences publiques:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

export default router;

