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
import { resolveRuleset } from "../utils/ruleset-helpers";

const router = Router();

router.use(authUser, adminOnly);

// =============================================================================
// SKILLS (Compétences)
// =============================================================================

router.get("/skills", async (req, res) => {
  try {
    const { category, search, ruleset } = req.query;
    const where: any = {};
    
    if (category) {
      where.category = category;
    }

    if (ruleset && ruleset !== "all") {
      where.ruleset = resolveRuleset(ruleset as string);
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
      orderBy: [{ ruleset: "asc" }, { category: "asc" }, { nameFr: "asc" }],
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
    const { slug, nameFr, nameEn, description, descriptionEn, category, ruleset: rawRuleset } = req.body;
    
    if (!slug || !nameFr || !nameEn || !description || !category) {
      return res.status(400).json({ error: "Tous les champs sont requis" });
    }

    const ruleset = resolveRuleset(rawRuleset);

    const skill = await prisma.skill.create({
      data: { slug, ruleset, nameFr, nameEn, description, descriptionEn: descriptionEn || null, category },
    });
    res.status(201).json({ skill });
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Cette compétence existe déjà pour ce ruleset" });
    }
    console.error("Erreur lors de la création de la compétence:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

router.put("/skills/:id", async (req, res) => {
  try {
    const { nameFr, nameEn, description, descriptionEn, category, ruleset: rawRuleset } = req.body;
    
    const data: any = { 
      nameFr, 
      nameEn, 
      description, 
      descriptionEn: descriptionEn || null, 
      category 
    };

    if (rawRuleset) {
      data.ruleset = resolveRuleset(rawRuleset);
    }

    const skill = await prisma.skill.update({
      where: { id: req.params.id },
      data,
    });
    res.json({ skill });
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Compétence non trouvée" });
    }
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Ce slug existe déjà pour ce ruleset" });
    }
    console.error("Erreur lors de la mise à jour de la compétence:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

router.post("/skills/:id/duplicate", async (req, res) => {
  try {
    const sourceSkill = await prisma.skill.findUnique({
      where: { id: req.params.id },
    });

    if (!sourceSkill) {
      return res.status(404).json({ error: "Compétence source non trouvée" });
    }

    const { targetRuleset } = req.body;
    const newRuleset = resolveRuleset(targetRuleset);

    // Vérifier si la compétence existe déjà pour ce ruleset
    const existing = await prisma.skill.findFirst({
      where: {
        slug: sourceSkill.slug,
        ruleset: newRuleset,
      },
    });

    if (existing) {
      return res.status(409).json({ 
        error: `La compétence "${sourceSkill.slug}" existe déjà pour le ruleset ${newRuleset}` 
      });
    }

    // Dupliquer la compétence
    const newSkill = await prisma.skill.create({
      data: {
        slug: sourceSkill.slug,
        ruleset: newRuleset,
        nameFr: sourceSkill.nameFr,
        nameEn: sourceSkill.nameEn,
        description: sourceSkill.description,
        descriptionEn: sourceSkill.descriptionEn,
        category: sourceSkill.category,
        isElite: sourceSkill.isElite,
        isPassive: sourceSkill.isPassive,
        isModified: sourceSkill.isModified,
      },
    });

    res.status(201).json({ 
      skill: newSkill,
      message: `Compétence dupliquée avec succès vers ${newRuleset}`,
    });
  } catch (error: any) {
    console.error("Erreur lors de la duplication de la compétence:", error);
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
    const { ruleset } = req.query;
    const where: any = {};

    if (ruleset && ruleset !== "all") {
      where.ruleset = resolveRuleset(ruleset as string);
    }

    const rosters = await prisma.roster.findMany({
      where,
      select: {
        id: true,
        slug: true,
        ruleset: true,
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
      orderBy: [
        { slug: "asc" },
        { ruleset: "asc" },
        { name: "asc" },
      ],
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
        ruleset: true,
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
    const {
      slug,
      name,
      nameEn,
      descriptionFr,
      descriptionEn,
      budget,
      tier,
      regionalRules,
      specialRules,
      naf,
      ruleset: rawRuleset,
    } = req.body;
    
    if (!slug || !name || !nameEn || budget === undefined || !tier) {
      return res.status(400).json({ error: "Tous les champs sont requis (slug, name, nameEn, budget, tier)" });
    }

    const ruleset = resolveRuleset(rawRuleset);
    const regionalRulesJson = regionalRules ? JSON.stringify(regionalRules) : null;

    const roster = await prisma.roster.create({
      data: { 
        slug, 
        ruleset,
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
      return res.status(409).json({ error: "Ce roster existe déjà pour ce ruleset" });
    }
    console.error("Erreur lors de la création du roster:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

router.put("/rosters/:id", async (req, res) => {
  try {
    const {
      name,
      nameEn,
      descriptionFr,
      descriptionEn,
      budget,
      tier,
      regionalRules,
      specialRules,
      naf,
      ruleset: rawRuleset,
    } = req.body;
    
    if (!name || !nameEn) {
      return res.status(400).json({ error: "Les champs name et nameEn sont requis" });
    }
    
    const regionalRulesJson = regionalRules ? JSON.stringify(regionalRules) : null;
    const data: any = {
      name, 
      nameEn, 
      descriptionFr: descriptionFr || null,
      descriptionEn: descriptionEn || null,
      budget, 
      tier, 
      regionalRules: regionalRulesJson,
      specialRules: specialRules || null,
      naf,
    };

    if (rawRuleset) {
      data.ruleset = resolveRuleset(rawRuleset);
    }

    const roster = await prisma.roster.update({
      where: { id: req.params.id },
      data,
    });
    res.json({ roster });
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Roster non trouvé" });
    }
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Slug déjà utilisé pour ce ruleset" });
    }
    console.error("Erreur lors de la mise à jour du roster:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

router.post("/rosters/:id/duplicate", async (req, res) => {
  try {
    const sourceRoster = await prisma.roster.findUnique({
      where: { id: req.params.id },
      include: {
        positions: {
          include: {
            skills: {
              include: { skill: true },
            },
          },
        },
      },
    });

    if (!sourceRoster) {
      return res.status(404).json({ error: "Roster source non trouvé" });
    }

    const { targetRuleset } = req.body;
    const newRuleset = resolveRuleset(targetRuleset);

    // Vérifier si le roster existe déjà pour ce ruleset
    const existing = await prisma.roster.findFirst({
      where: {
        slug: sourceRoster.slug,
        ruleset: newRuleset,
      },
    });

    if (existing) {
      return res.status(409).json({ 
        error: `Le roster "${sourceRoster.slug}" existe déjà pour le ruleset ${newRuleset}` 
      });
    }

    // Dupliquer le roster
    const newRoster = await prisma.roster.create({
      data: {
        slug: sourceRoster.slug,
        ruleset: newRuleset,
        name: sourceRoster.name,
        nameEn: sourceRoster.nameEn,
        descriptionFr: sourceRoster.descriptionFr,
        descriptionEn: sourceRoster.descriptionEn,
        budget: sourceRoster.budget,
        tier: sourceRoster.tier,
        regionalRules: sourceRoster.regionalRules,
        specialRules: sourceRoster.specialRules,
        naf: sourceRoster.naf,
      },
    });

    // Dupliquer les positions
    for (const position of sourceRoster.positions) {
      const newPosition = await prisma.position.create({
        data: {
          rosterId: newRoster.id,
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
          keywords: position.keywords,
        },
      });

      // Dupliquer les skills de la position
      for (const positionSkill of position.skills) {
        await prisma.positionSkill.create({
          data: {
            positionId: newPosition.id,
            skillId: positionSkill.skillId,
          },
        });
      }
    }

    res.status(201).json({ 
      roster: newRoster,
      message: `Roster dupliqué avec succès vers ${newRuleset}`,
    });
  } catch (error: any) {
    console.error("Erreur lors de la duplication du roster:", error);
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
    const { rosterId, ruleset } = req.query;
    const where: any = {};
    
    if (rosterId) {
      where.rosterId = rosterId;
    }
    if (ruleset && ruleset !== "all") {
      where.roster = {
        ...(where.roster || {}),
        ruleset: resolveRuleset(ruleset as string),
      };
    }

    const positions = await prisma.position.findMany({
      where,
      include: {
        roster: {
          select: {
            id: true,
            slug: true,
            name: true,
            nameEn: true,
            ruleset: true,
          },
        },
        skills: {
          include: { skill: true },
        },
      },
      orderBy: [{ roster: { slug: "asc" } }, { displayName: "asc" }],
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
        roster: {
          select: {
            id: true,
            slug: true,
            name: true,
            nameEn: true,
            ruleset: true,
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

router.post("/positions/:id/duplicate", async (req, res) => {
  try {
    const sourcePosition = await prisma.position.findUnique({
      where: { id: req.params.id },
      include: {
        roster: true,
        skills: {
          include: { skill: true },
        },
      },
    });

    if (!sourcePosition) {
      return res.status(404).json({ error: "Position source non trouvée" });
    }

    const { targetRosterId } = req.body;

    if (!targetRosterId) {
      return res.status(400).json({ error: "Le roster cible est requis" });
    }

    // Vérifier que le roster cible existe
    const targetRoster = await prisma.roster.findUnique({
      where: { id: targetRosterId },
    });

    if (!targetRoster) {
      return res.status(404).json({ error: "Roster cible non trouvé" });
    }

    // Dupliquer la position
    const newPosition = await prisma.position.create({
      data: {
        rosterId: targetRosterId,
        slug: sourcePosition.slug,
        displayName: sourcePosition.displayName,
        cost: sourcePosition.cost,
        min: sourcePosition.min,
        max: sourcePosition.max,
        ma: sourcePosition.ma,
        st: sourcePosition.st,
        ag: sourcePosition.ag,
        pa: sourcePosition.pa,
        av: sourcePosition.av,
        keywords: sourcePosition.keywords,
      },
    });

    // Dupliquer les skills
    for (const positionSkill of sourcePosition.skills) {
      await prisma.positionSkill.create({
        data: {
          positionId: newPosition.id,
          skillId: positionSkill.skillId,
        },
      });
    }

    const result = await prisma.position.findUnique({
      where: { id: newPosition.id },
      include: {
        roster: true,
        skills: {
          include: { skill: true },
        },
      },
    });

    res.status(201).json({ 
      position: result,
      message: `Position dupliquée avec succès vers le roster ${targetRoster.name}`,
    });
  } catch (error: any) {
    console.error("Erreur lors de la duplication de la position:", error);
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

