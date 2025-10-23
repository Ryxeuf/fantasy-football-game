import { Router } from "express";
import { authUser, AuthenticatedRequest } from "../middleware/authUser";
import { 
  STAR_PLAYERS, 
  getStarPlayerBySlug, 
  getAvailableStarPlayers, 
  TEAM_REGIONAL_RULES,
  type StarPlayerDefinition 
} from "@bb/game-engine";

const router = Router();

/**
 * GET /api/star-players
 * Obtenir la liste complète des star players
 */
router.get("/", (req, res) => {
  try {
    const starPlayers = Object.values(STAR_PLAYERS);
    res.json({
      success: true,
      count: starPlayers.length,
      data: starPlayers
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
 * Obtenir les détails d'un star player spécifique
 */
router.get("/:slug", (req, res) => {
  try {
    const { slug } = req.params;
    const starPlayer = getStarPlayerBySlug(slug);

    if (!starPlayer) {
      return res.status(404).json({
        success: false,
        error: "Star player not found"
      });
    }

    res.json({
      success: true,
      data: starPlayer
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
 * Obtenir les star players disponibles pour un roster d'équipe donné
 */
router.get("/available/:roster", (req, res) => {
  try {
    const { roster } = req.params;
    
    // Vérifier que le roster existe dans TEAM_REGIONAL_RULES
    const regionalRules = TEAM_REGIONAL_RULES[roster];
    
    if (!regionalRules) {
      return res.status(404).json({
        success: false,
        error: "Unknown team roster"
      });
    }

    const availablePlayers = getAvailableStarPlayers(roster, regionalRules);

    res.json({
      success: true,
      roster,
      regionalRules,
      count: availablePlayers.length,
      data: availablePlayers
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
    const regionalRules = TEAM_REGIONAL_RULES[roster];

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
 * Rechercher des star players par nom ou compétences
 */
router.get("/search", (req, res) => {
  try {
    const { q, skill, minCost, maxCost } = req.query;
    let starPlayers = Object.values(STAR_PLAYERS);

    // Filtrer par nom
    if (q && typeof q === 'string') {
      const query = q.toLowerCase();
      starPlayers = starPlayers.filter(sp => 
        sp.displayName.toLowerCase().includes(query) ||
        sp.slug.toLowerCase().includes(query)
      );
    }

    // Filtrer par compétence
    if (skill && typeof skill === 'string') {
      const skillQuery = skill.toLowerCase();
      starPlayers = starPlayers.filter(sp => 
        sp.skills.toLowerCase().includes(skillQuery)
      );
    }

    // Filtrer par coût minimum
    if (minCost && !isNaN(Number(minCost))) {
      starPlayers = starPlayers.filter(sp => sp.cost >= Number(minCost));
    }

    // Filtrer par coût maximum
    if (maxCost && !isNaN(Number(maxCost))) {
      starPlayers = starPlayers.filter(sp => sp.cost <= Number(maxCost));
    }

    res.json({
      success: true,
      count: starPlayers.length,
      filters: { q, skill, minCost, maxCost },
      data: starPlayers
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

