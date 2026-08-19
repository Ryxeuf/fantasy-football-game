import { Router } from "express";
import { authUser, AuthenticatedRequest } from "../middleware/authUser";
import { prisma } from "../prisma";
import {
  getAvailableStarPlayers,
  getRegionalRulesForTeam,
  getStarPlayerKeywords,
  translateKeywordsCsv,
  type StarPlayerDefinition,
} from "@bb/game-engine";
import { resolveRuleset, DEFAULT_RULESET } from "../utils/ruleset-helpers";
import { serverLog } from "../utils/server-log";

const router = Router();

/**
 * Le schéma SQLite (utilisé en CI/E2E) n'inclut pas le modèle StarPlayer
 * — il est réservé au schéma Postgres complet. On expose un accès safe
 * pour ne pas faire crasher les routes (et donc les pages publiques)
 * dans cet environnement réduit.
 */
function getStarPlayerModel(): any | null {
  const model = (prisma as unknown as { starPlayer?: any }).starPlayer;
  return model ?? null;
}

/**
 * Payload public d'un Star Player. Mapper unique partagé par les 4 routes
 * (liste, recherche, détail, disponibles) : toute nouvelle colonne exposée
 * n'est ajoutée qu'ici.
 *
 * `keywords` (lignée + type, ex: "Humain, Blitzer") vient de la colonne DB ;
 * tant que le seed n'a pas tourné après la migration, on retombe sur la table
 * du game-engine (source de vérité) pour ne pas servir un champ vide.
 * `keywordsEn` est toujours calculé (comme pour les positions).
 */
function transformStarPlayer(sp: any) {
  const keywords: string | null = sp.keywords ?? getStarPlayerKeywords(sp.slug);
  return {
    slug: sp.slug,
    displayName: sp.displayName,
    cost: sp.cost,
    ma: sp.ma,
    st: sp.st,
    ag: sp.ag,
    pa: sp.pa,
    av: sp.av,
    keywords,
    keywordsEn: translateKeywordsCsv(keywords, "en"),
    specialRule: sp.specialRule,
    imageUrl: sp.imageUrl,
    isMegaStar: sp.isMegaStar,
    skills: sp.skills.map((sps: any) => sps.skill.slug).join(","),
    hirableBy: sp.hirableBy.map((h: any) => h.roster?.slug || h.rule),
  };
}

/**
 * GET /api/star-players
 * Obtenir la liste complète des star players depuis la base de données
 */
router.get("/", async (req, res) => {
  try {
    const ruleset = resolveRuleset(req.query.ruleset as string | undefined);
    const starPlayerModel = getStarPlayerModel();
    if (!starPlayerModel) {
      return res.json({ success: true, count: 0, data: [] });
    }
    const starPlayers = await starPlayerModel.findMany({
      where: { ruleset },
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
    const transformedStarPlayers = starPlayers.map(transformStarPlayer);

    res.json({
      success: true,
      count: transformedStarPlayers.length,
      data: transformedStarPlayers
    });
  } catch (error) {
    serverLog.error("Error fetching star players:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch star players"
    });
  }
});

/**
 * GET /api/star-players/search
 * Rechercher des star players par nom ou compétences depuis la base de données
 *
 * ATTENTION ORDRE DES ROUTES : toute route littérale à UN seul segment
 * (ex: `/search`) doit être déclarée AVANT `/:slug`, sinon Express la fait
 * matcher le pattern paramétré et elle devient injoignable.
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

    const starPlayerModel = getStarPlayerModel();
    if (!starPlayerModel) {
      return res.json({
        success: true,
        count: 0,
        filters: { q, skill, minCost, maxCost },
        data: [],
      });
    }
    const starPlayers = await starPlayerModel.findMany({
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
    const transformedStarPlayers = starPlayers.map(transformStarPlayer);

    res.json({
      success: true,
      count: transformedStarPlayers.length,
      filters: { q, skill, minCost, maxCost },
      data: transformedStarPlayers
    });
  } catch (error) {
    serverLog.error("Error searching star players:", error);
    res.status(500).json({
      success: false,
      error: "Failed to search star players"
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
    const ruleset = resolveRuleset(req.query.ruleset as string | undefined);
    const starPlayerModel = getStarPlayerModel();
    if (!starPlayerModel) {
      return res.status(404).json({
        success: false,
        error: "Star player not found",
      });
    }

    const include = {
      skills: {
        include: { skill: true },
      },
      hirableBy: {
        include: { roster: true },
      },
    };

    // `slug` seul n'est PAS un selecteur unique : le modele Prisma declare
    // `@@unique([slug, ruleset])`. Un `findUnique({ where: { slug } })` leve
    // donc une PrismaClientValidationError => 500 sur toutes les pages de
    // detail. On passe par `findFirst` + resolution explicite du ruleset.
    let starPlayer = await starPlayerModel.findFirst({
      where: { slug, ruleset },
      include,
    });

    // Fallback ruleset par defaut : les liens publics ne portent pas de
    // `?ruleset=`, un star absent du ruleset demande reste consultable.
    if (!starPlayer && ruleset !== DEFAULT_RULESET) {
      starPlayer = await starPlayerModel.findFirst({
        where: { slug, ruleset: DEFAULT_RULESET },
        include,
      });
    }

    // Dernier recours : le star n'existe que dans un autre ruleset.
    if (!starPlayer) {
      starPlayer = await starPlayerModel.findFirst({
        where: { slug },
        include,
      });
    }

    if (!starPlayer) {
      return res.status(404).json({
        success: false,
        error: "Star player not found"
      });
    }

    // Transformer les données
    const transformedStarPlayer = {
      ...transformStarPlayer(starPlayer),
      ruleset: starPlayer.ruleset,
    };

    res.json({
      success: true,
      data: transformedStarPlayer
    });
  } catch (error) {
    serverLog.error("Error fetching star player:", error);
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

    const starPlayerModel = getStarPlayerModel();
    if (!starPlayerModel) {
      return res.json({
        success: true,
        roster,
        ruleset,
        regionalRules,
        count: 0,
        starPlayers: [],
      });
    }

    // Récupérer tous les star players disponibles pour ce roster
    // Un star player est disponible si :
    // - hirableBy contient "all"
    // - hirableBy contient le slug du roster
    // - hirableBy contient une règle régionale qui correspond au roster
    const starPlayers = await starPlayerModel.findMany({
      where: {
        // Bug latent corrigé : `ruleset` était résolu (L269) mais jamais
        // filtré ici, donc la requête mélangeait season_2 et season_3.
        ruleset,
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

    // Transformer les données. A9 — dédup par slug : la requête Prisma
    // ci-dessus combine plusieurs critères en `OR` (hirableBy "all" + slug
    // roster + règles régionales). Un star éligible par PLUSIEURS critères
    // peut être remonté plusieurs fois → on garde la première occurrence.
    const seenSlugs = new Set<string>();
    const transformedStarPlayers = starPlayers
      .filter((sp: any) => {
        if (seenSlugs.has(sp.slug)) return false;
        seenSlugs.add(sp.slug);
        return true;
      })
      .map(transformStarPlayer);

    res.json({
      success: true,
      roster,
      ruleset,
      regionalRules,
      count: transformedStarPlayers.length,
      starPlayers: transformedStarPlayers
    });
  } catch (error) {
    serverLog.error("Error fetching available star players:", error);
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
    serverLog.error("Error fetching regional rules:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch regional rules"
    });
  }
});

export default router;

