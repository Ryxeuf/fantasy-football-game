import { Router } from "express";
import { authUser, AuthenticatedRequest } from "../middleware/authUser";
import { prisma } from "../prisma";
import {
  getAvailableStarPlayers,
  getRegionalRulesForTeam,
  type StarPlayerDefinition,
} from "@bb/game-engine";
import { resolveRuleset, DEFAULT_RULESET } from "../utils/ruleset-helpers";

const router = Router();

/**
 * GET /api/star-players
 * Obtenir la liste complète des star players depuis la base de données
 */
router.get("/", async (req, res) => {
  try {
    const starPlayers = await prisma.starPlayer.findMany({
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

    // Transformer les données pour correspondre au format attendu
    const transformedStarPlayers = starPlayers.map((sp) => ({
      slug: sp.slug,
      displayName: sp.displayName,
      cost: sp.cost,
      ma: sp.ma,
      st: sp.st,
      ag: sp.ag,
      pa: sp.pa,
      av: sp.av,
      specialRule: sp.specialRule,
      imageUrl: sp.imageUrl,
      isMegaStar: sp.isMegaStar,
      skills: sp.skills.map((sps) => sps.skill.slug).join(","),
      hirableBy: sp.hirableBy.map((h) => h.roster?.slug || h.rule),
    }));

    res.json({
      success: true,
      count: transformedStarPlayers.length,
      data: transformedStarPlayers
    });
  } catch (error) {
    console.error("Error fetching star players:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch star players"
    });
  }
});

/**
 * GET /api/star-players/:slug
 * Obtenir les détails d'un star player spécifique depuis la base de données
 */
router.get("/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const starPlayer = await prisma.starPlayer.findUnique({
      where: { slug },
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
      return res.status(404).json({
        success: false,
        error: "Star player not found"
      });
    }

    // Transformer les données
    const transformedStarPlayer = {
      slug: starPlayer.slug,
      displayName: starPlayer.displayName,
      cost: starPlayer.cost,
      ma: starPlayer.ma,
      st: starPlayer.st,
      ag: starPlayer.ag,
      pa: starPlayer.pa,
      av: starPlayer.av,
      specialRule: starPlayer.specialRule,
      imageUrl: starPlayer.imageUrl,
      isMegaStar: starPlayer.isMegaStar,
      skills: starPlayer.skills.map((sps) => sps.skill.slug).join(","),
      hirableBy: starPlayer.hirableBy.map((h) => h.roster?.slug || h.rule),
    };

    res.json({
      success: true,
      data: transformedStarPlayer
    });
  } catch (error) {
    console.error("Error fetching star player:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch star player"
    });
  }
});

/**
 * GET /api/star-players/available/:roster
 * Obtenir les star players disponibles pour un roster d'équipe donné depuis la base de données
 */
router.get("/available/:roster", async (req, res) => {
  try {
    const { roster } = req.params;
    const ruleset = resolveRuleset(req.query.ruleset as string | undefined);
    
    // Vérifier que le roster existe
    const rosterExists = await prisma.roster.findFirst({
      where: { slug: roster, ruleset },
    });
    
    if (!rosterExists) {
      if (ruleset !== DEFAULT_RULESET) {
        const fallback = await prisma.roster.findFirst({
          where: { slug: roster, ruleset: DEFAULT_RULESET },
        });
        if (!fallback) {
          return res.status(404).json({
            success: false,
            error: "Unknown team roster",
          });
        }
      } else {
        return res.status(404).json({
          success: false,
          error: "Unknown team roster",
        });
      }
    }

    // Récupérer les règles régionales depuis le game-engine (pour l'instant)
    const regionalRules = getRegionalRulesForTeam(roster, ruleset);
    
    // Récupérer tous les star players disponibles pour ce roster
    // Un star player est disponible si :
    // - hirableBy contient "all"
    // - hirableBy contient le slug du roster
    // - hirableBy contient une règle régionale qui correspond au roster
    const starPlayers = await prisma.starPlayer.findMany({
      where: {
        OR: [
          { hirableBy: { some: { rule: "all" } } },
          { hirableBy: { some: { roster: { slug: roster } } } },
          ...(regionalRules ? regionalRules.map((rule) => ({
            hirableBy: { some: { rule } },
          })) : []),
        ],
      },
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

    // Transformer les données
    const transformedStarPlayers = starPlayers.map((sp) => ({
      slug: sp.slug,
      displayName: sp.displayName,
      cost: sp.cost,
      ma: sp.ma,
      st: sp.st,
      ag: sp.ag,
      pa: sp.pa,
      av: sp.av,
      specialRule: sp.specialRule,
      imageUrl: sp.imageUrl,
      isMegaStar: sp.isMegaStar,
      skills: sp.skills.map((sps) => sps.skill.slug).join(","),
      hirableBy: sp.hirableBy.map((h) => h.roster?.slug || h.rule),
    }));

    res.json({
      success: true,
      roster,
      ruleset,
      regionalRules,
      count: transformedStarPlayers.length,
      starPlayers: transformedStarPlayers
    });
  } catch (error) {
    console.error("Error fetching available star players:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch available star players"
    });
  }
});

/**
 * GET /api/star-players/regional-rules/:roster
 * Obtenir les règles régionales d'un roster d'équipe
 */
router.get("/regional-rules/:roster", (req, res) => {
  try {
    const { roster } = req.params;
    const ruleset = resolveRuleset(req.query.ruleset as string | undefined);
    const regionalRules = getRegionalRulesForTeam(roster, ruleset);

    if (!regionalRules) {
      return res.status(404).json({
        success: false,
        error: "Unknown team roster"
      });
    }

    res.json({
      success: true,
      roster,
      regionalRules
    });
  } catch (error) {
    console.error("Error fetching regional rules:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch regional rules"
    });
  }
});

/**
 * GET /api/star-players/search
 * Rechercher des star players par nom ou compétences depuis la base de données
 */
router.get("/search", async (req, res) => {
  try {
    const { q, skill, minCost, maxCost } = req.query;
    const where: any = {};

    // Filtrer par nom
    if (q && typeof q === 'string') {
      where.OR = [
        { displayName: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
      ];
    }

    // Filtrer par compétence
    if (skill && typeof skill === 'string') {
      where.skills = {
        some: {
          skill: {
            OR: [
              { slug: { contains: skill, mode: "insensitive" } },
              { nameFr: { contains: skill, mode: "insensitive" } },
              { nameEn: { contains: skill, mode: "insensitive" } },
            ],
          },
        },
      };
    }

    // Filtrer par coût minimum
    if (minCost && !isNaN(Number(minCost))) {
      where.cost = { ...where.cost, gte: Number(minCost) };
    }

    // Filtrer par coût maximum
    if (maxCost && !isNaN(Number(maxCost))) {
      where.cost = { ...where.cost, lte: Number(maxCost) };
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

    // Transformer les données
    const transformedStarPlayers = starPlayers.map((sp) => ({
      slug: sp.slug,
      displayName: sp.displayName,
      cost: sp.cost,
      ma: sp.ma,
      st: sp.st,
      ag: sp.ag,
      pa: sp.pa,
      av: sp.av,
      specialRule: sp.specialRule,
      imageUrl: sp.imageUrl,
      isMegaStar: sp.isMegaStar,
      skills: sp.skills.map((sps) => sps.skill.slug).join(","),
      hirableBy: sp.hirableBy.map((h) => h.roster?.slug || h.rule),
    }));

    res.json({
      success: true,
      count: transformedStarPlayers.length,
      filters: { q, skill, minCost, maxCost },
      data: transformedStarPlayers
    });
  } catch (error) {
    console.error("Error searching star players:", error);
    res.status(500).json({
      success: false,
      error: "Failed to search star players"
    });
  }
});

export default router;

