/**
 * Routes d'administration pour gérer les données statiques en base de données
 * - Skills (compétences)
 * - Rosters (équipes)
 * - Positions
 * - Star Players
 */

import { Router } from "express";
import { prisma } from "../prisma";
import { adminOnly } from "../middleware/adminOnly";
import { authUser } from "../middleware/authUser";

const router = Router();

router.use(authUser, adminOnly);

// =============================================================================
// SKILLS (Compétences)
// =============================================================================

router.get("/skills", async (req, res) => {
  try {
    const { category, search } = req.query;
    const where: any = {};
    
    if (category) {
      where.category = category;
    }
    
    if (search) {
      where.OR = [
        { slug: { contains: search as string, mode: "insensitive" } },
        { nameFr: { contains: search as string, mode: "insensitive" } },
        { nameEn: { contains: search as string, mode: "insensitive" } },
      ];
    }

    const skills = await prisma.skill.findMany({
      where,
      orderBy: [{ category: "asc" }, { nameFr: "asc" }],
    });
    res.json({ skills });
  } catch (error: any) {
    console.error("Erreur lors de la récupération des compétences:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

router.get("/skills/:id", async (req, res) => {
  try {
    const skill = await prisma.skill.findUnique({
      where: { id: req.params.id },
      include: {
        positionSkills: {
          include: { position: { include: { roster: true } } },
        },
        starPlayerSkills: {
          include: { starPlayer: true },
        },
      },
    });
    if (!skill) {
      return res.status(404).json({ error: "Compétence non trouvée" });
    }
    res.json({ skill });
  } catch (error: any) {
    console.error("Erreur lors de la récupération de la compétence:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

router.post("/skills", async (req, res) => {
  try {
    const { slug, nameFr, nameEn, description, descriptionEn, category } = req.body;
    
    if (!slug || !nameFr || !nameEn || !description || !category) {
      return res.status(400).json({ error: "Tous les champs sont requis" });
    }

    const skill = await prisma.skill.create({
      data: { slug, nameFr, nameEn, description, descriptionEn: descriptionEn || null, category },
    });
    res.status(201).json({ skill });
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Cette compétence existe déjà" });
    }
    console.error("Erreur lors de la création de la compétence:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

router.put("/skills/:id", async (req, res) => {
  try {
    const { nameFr, nameEn, description, descriptionEn, category } = req.body;
    
    const skill = await prisma.skill.update({
      where: { id: req.params.id },
      data: { nameFr, nameEn, description, descriptionEn: descriptionEn || null, category },
    });
    res.json({ skill });
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Compétence non trouvée" });
    }
    console.error("Erreur lors de la mise à jour de la compétence:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

router.delete("/skills/:id", async (req, res) => {
  try {
    await prisma.skill.delete({
      where: { id: req.params.id },
    });
    res.json({ success: true });
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Compétence non trouvée" });
    }
    console.error("Erreur lors de la suppression de la compétence:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

// =============================================================================
// ROSTERS (Équipes)
// =============================================================================

router.get("/rosters", async (req, res) => {
  try {
    const rosters = await prisma.roster.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        nameEn: true,
        descriptionFr: true,
        descriptionEn: true,
        budget: true,
        tier: true,
        regionalRules: true,
        specialRules: true,
        naf: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { positions: true },
        },
      },
      orderBy: { name: "asc" },
    });
    // Parse regionalRules JSON string to array for each roster
    const rostersWithParsedRules = rosters.map((roster: any) => ({
      ...roster,
      regionalRules: roster.regionalRules ? JSON.parse(roster.regionalRules) : null,
    }));
    res.json({ rosters: rostersWithParsedRules });
  } catch (error: any) {
    console.error("Erreur lors de la récupération des rosters:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

router.get("/rosters/:id", async (req, res) => {
  try {
    const roster = await prisma.roster.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        slug: true,
        name: true,
        nameEn: true,
        descriptionFr: true,
        descriptionEn: true,
        budget: true,
        tier: true,
        regionalRules: true,
        specialRules: true,
        naf: true,
        createdAt: true,
        updatedAt: true,
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
    // Parse regionalRules JSON string to array
    const rosterWithParsedRules = {
      ...roster,
      regionalRules: roster.regionalRules ? JSON.parse(roster.regionalRules) : null,
    };
    res.json({ roster: rosterWithParsedRules });
  } catch (error: any) {
    console.error("Erreur lors de la récupération du roster:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

router.post("/rosters", async (req, res) => {
  try {
    const { slug, name, nameEn, descriptionFr, descriptionEn, budget, tier, regionalRules, specialRules, naf } = req.body;
    
    if (!slug || !name || !nameEn || budget === undefined || !tier) {
      return res.status(400).json({ error: "Tous les champs sont requis (slug, name, nameEn, budget, tier)" });
    }

    const regionalRulesJson = regionalRules ? JSON.stringify(regionalRules) : null;

    const roster = await prisma.roster.create({
      data: { 
        slug, 
        name, 
        nameEn, 
        descriptionFr: descriptionFr || null,
        descriptionEn: descriptionEn || null,
        budget, 
        tier, 
        regionalRules: regionalRulesJson,
        specialRules: specialRules || null,
        naf: naf || false 
      },
    });
    res.status(201).json({ roster });
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Ce roster existe déjà" });
    }
    console.error("Erreur lors de la création du roster:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

router.put("/rosters/:id", async (req, res) => {
  try {
    const { name, nameEn, descriptionFr, descriptionEn, budget, tier, regionalRules, specialRules, naf } = req.body;
    
    if (!name || !nameEn) {
      return res.status(400).json({ error: "Les champs name et nameEn sont requis" });
    }
    
    const regionalRulesJson = regionalRules ? JSON.stringify(regionalRules) : null;

    const roster = await prisma.roster.update({
      where: { id: req.params.id },
      data: { 
        name, 
        nameEn, 
        descriptionFr: descriptionFr || null,
        descriptionEn: descriptionEn || null,
        budget, 
        tier, 
        regionalRules: regionalRulesJson,
        specialRules: specialRules || null,
        naf 
      },
    });
    res.json({ roster });
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Roster non trouvé" });
    }
    console.error("Erreur lors de la mise à jour du roster:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

router.delete("/rosters/:id", async (req, res) => {
  try {
    await prisma.roster.delete({
      where: { id: req.params.id },
    });
    res.json({ success: true });
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Roster non trouvé" });
    }
    console.error("Erreur lors de la suppression du roster:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

// =============================================================================
// POSITIONS
// =============================================================================

router.get("/positions", async (req, res) => {
  try {
    const { rosterId } = req.query;
    const where: any = {};
    
    if (rosterId) {
      where.rosterId = rosterId;
    }

    const positions = await prisma.position.findMany({
      where,
      include: {
        roster: true,
        skills: {
          include: { skill: true },
        },
      },
      orderBy: [{ roster: { name: "asc" } }, { displayName: "asc" }],
    });
    res.json({ positions });
  } catch (error: any) {
    console.error("Erreur lors de la récupération des positions:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

router.get("/positions/:id", async (req, res) => {
  try {
    const position = await prisma.position.findUnique({
      where: { id: req.params.id },
      include: {
        roster: true,
        skills: {
          include: { skill: true },
        },
      },
    });
    if (!position) {
      return res.status(404).json({ error: "Position non trouvée" });
    }
    res.json({ position });
  } catch (error: any) {
    console.error("Erreur lors de la récupération de la position:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

router.post("/positions", async (req, res) => {
  try {
    const { rosterId, slug, displayName, cost, min, max, ma, st, ag, pa, av, keywords, skillSlugs } = req.body;
    
    if (!rosterId || !slug || !displayName || cost === undefined || min === undefined || 
        max === undefined || ma === undefined || st === undefined || ag === undefined || 
        pa === undefined || av === undefined) {
      return res.status(400).json({ error: "Tous les champs sont requis" });
    }

    const position = await prisma.position.create({
      data: {
        rosterId,
        slug,
        displayName,
        cost,
        min,
        max,
        ma,
        st,
        ag,
        pa,
        av,
        keywords: keywords || null,
        skills: {
          create: skillSlugs?.map((skillSlug: string) => ({
            skill: {
              connect: { slug: skillSlug }
            }
          })) || [],
        },
      },
      include: {
        skills: {
          include: { skill: true },
        },
      },
    });
    res.status(201).json({ position });
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Cette position existe déjà pour ce roster" });
    }
    console.error("Erreur lors de la création de la position:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

router.put("/positions/:id", async (req, res) => {
  try {
    const { displayName, cost, min, max, ma, st, ag, pa, av, keywords, skillSlugs } = req.body;
    
    // Supprimer les anciennes relations de compétences
    await prisma.positionSkill.deleteMany({
      where: { positionId: req.params.id },
    });

    // Créer les nouvelles relations
    const position = await prisma.position.update({
      where: { id: req.params.id },
      data: {
        displayName,
        cost,
        min,
        max,
        ma,
        st,
        ag,
        pa,
        av,
        keywords: keywords || null,
        skills: {
          create: skillSlugs?.map((skillSlug: string) => ({
            skill: {
              connect: { slug: skillSlug }
            }
          })) || [],
        },
      },
      include: {
        skills: {
          include: { skill: true },
        },
      },
    });
    res.json({ position });
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Position non trouvée" });
    }
    console.error("Erreur lors de la mise à jour de la position:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

router.delete("/positions/:id", async (req, res) => {
  try {
    await prisma.position.delete({
      where: { id: req.params.id },
    });
    res.json({ success: true });
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Position non trouvée" });
    }
    console.error("Erreur lors de la suppression de la position:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

// =============================================================================
// STAR PLAYERS
// =============================================================================

router.get("/star-players", async (req, res) => {
  try {
    const { search } = req.query;
    const where: any = {};
    
    if (search) {
      where.OR = [
        { slug: { contains: search as string, mode: "insensitive" } },
        { displayName: { contains: search as string, mode: "insensitive" } },
      ];
    }

    const starPlayers = await prisma.starPlayer.findMany({
      where,
      include: {
        skills: {
          include: { skill: true },
        },
        hirableBy: {
          include: { roster: true },
        },
      },
      orderBy: { displayName: "asc" },
    });
    res.json({ starPlayers });
  } catch (error: any) {
    console.error("Erreur lors de la récupération des Star Players:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

router.get("/star-players/:id", async (req, res) => {
  try {
    const starPlayer = await prisma.starPlayer.findUnique({
      where: { id: req.params.id },
      include: {
        skills: {
          include: { skill: true },
        },
        hirableBy: {
          include: { roster: true },
        },
      },
    });
    if (!starPlayer) {
      return res.status(404).json({ error: "Star Player non trouvé" });
    }
    res.json({ starPlayer });
  } catch (error: any) {
    console.error("Erreur lors de la récupération du Star Player:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

router.post("/star-players", async (req, res) => {
  try {
    const { slug, displayName, cost, ma, st, ag, pa, av, specialRule, imageUrl, skillSlugs, hirableBy } = req.body;
    
    if (!slug || !displayName || cost === undefined || ma === undefined || 
        st === undefined || ag === undefined || av === undefined) {
      return res.status(400).json({ error: "Tous les champs requis sont manquants" });
    }

    const starPlayer = await prisma.starPlayer.create({
      data: {
        slug,
        displayName,
        cost,
        ma,
        st,
        ag,
        pa: pa ?? null,
        av,
        specialRule: specialRule || null,
        imageUrl: imageUrl || null,
        skills: {
          create: skillSlugs?.map((skillSlug: string) => ({
            skill: {
              connect: { slug: skillSlug }
            }
          })) || [],
        },
        hirableBy: {
          create: hirableBy?.map((rule: string | { rule: string; rosterId?: string }) => {
            if (typeof rule === "string") {
              return { rule, rosterId: null };
            }
            return { rule: rule.rule, rosterId: rule.rosterId || null };
          }) || [],
        },
      },
      include: {
        skills: {
          include: { skill: true },
        },
        hirableBy: {
          include: { roster: true },
        },
      },
    });
    res.status(201).json({ starPlayer });
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Ce Star Player existe déjà" });
    }
    console.error("Erreur lors de la création du Star Player:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

router.put("/star-players/:id", async (req, res) => {
  try {
    const { displayName, cost, ma, st, ag, pa, av, specialRule, imageUrl, skillSlugs, hirableBy } = req.body;
    
    // Supprimer les anciennes relations
    await prisma.starPlayerSkill.deleteMany({
      where: { starPlayerId: req.params.id },
    });
    await prisma.starPlayerHirableBy.deleteMany({
      where: { starPlayerId: req.params.id },
    });

    // Mettre à jour et créer les nouvelles relations
    const starPlayer = await prisma.starPlayer.update({
      where: { id: req.params.id },
      data: {
        displayName,
        cost,
        ma,
        st,
        ag,
        pa: pa ?? null,
        av,
        specialRule: specialRule || null,
        imageUrl: imageUrl || null,
        skills: {
          create: skillSlugs?.map((skillSlug: string) => ({
            skill: {
              connect: { slug: skillSlug }
            }
          })) || [],
        },
        hirableBy: {
          create: hirableBy?.map((rule: string | { rule: string; rosterId?: string }) => {
            if (typeof rule === "string") {
              return { rule, rosterId: null };
            }
            return { rule: rule.rule, rosterId: rule.rosterId || null };
          }) || [],
        },
      },
      include: {
        skills: {
          include: { skill: true },
        },
        hirableBy: {
          include: { roster: true },
        },
      },
    });
    res.json({ starPlayer });
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Star Player non trouvé" });
    }
    console.error("Erreur lors de la mise à jour du Star Player:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

router.delete("/star-players/:id", async (req, res) => {
  try {
    await prisma.starPlayer.delete({
      where: { id: req.params.id },
    });
    res.json({ success: true });
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Star Player non trouvé" });
    }
    console.error("Erreur lors de la suppression du Star Player:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

export default router;

