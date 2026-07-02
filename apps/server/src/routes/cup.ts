import { Router } from "express";
import { prisma } from "../prisma";
import { authUser, AuthenticatedRequest } from "../middleware/authUser";
import {
  computeCupStandings,
  type CupWithParticipantsAndScoring,
  type LocalMatchWithRelations,
} from "../cupScoring";
import { hasRole } from "../utils/roles";
import { resolveRuleset } from "../utils/ruleset-helpers";
import { validate, validateQuery } from "../middleware/validate";
import {
  createCupSchema,
  registerCupSchema,
  unregisterCupSchema,
  updateCupStatusSchema,
  updateCupRulesSchema,
  listMonthlyCupsQuerySchema,
  setMatchOfTheWeekSchema,
  type ListMonthlyCupsQuery,
  type SetMatchOfTheWeekBody,
  type CupRulesConfigInput,
} from "../schemas/cup.schemas";
import { listMonthlyCups } from "../services/cup-monthly-listing";
import {
  getCurrentMatchOfTheWeek,
  setMatchOfTheWeek,
} from "../services/match-of-the-week";
import { serverLog } from "../utils/server-log";
import { parseNumberMap, type CupRulesConfig } from "../services/cup-rules";
import {
  computeCupPlayerLeaderboards,
  CUP_LEADERBOARD_CATEGORIES,
  type CupMatchForPlayerStats,
} from "../services/cup-player-stats";
import {
  registerTeamToCup,
  CupRegistrationError,
  type CupRegistrationErrorCode,
} from "../services/cup-registration";

/** Mappe un code d'erreur d'inscription coupe vers un status HTTP. */
function mapCupRegistrationStatus(code: CupRegistrationErrorCode): number {
  switch (code) {
    case "cup_not_found":
    case "team_not_found":
      return 404;
    case "already_engaged":
    case "already_registered":
      return 409;
    case "budget_exceeded":
    case "psp_exceeded":
      return 422;
    default:
      return 400;
  }
}

const router = Router();

/** Champs de config « règles avancées » attendus dans un body de coupe. */
interface CupRulesBody {
  resurrectionMode?: boolean;
  tierBudgets?: Record<string, number>;
  rosterBudgetOverrides?: Record<string, number>;
  tierStartingPsp?: Record<string, number>;
  rosterStartingPspOverrides?: Record<string, number>;
}

/**
 * Sérialise les maps de config coupe en string JSON (ou null) pour un
 * `create`/`update` Prisma compatible PG (Json) + miroir SQLite (String).
 * Les champs absents ne sont pas inclus (patch partiel).
 */
function serializeCupRulesData(body: CupRulesBody): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (body.resurrectionMode !== undefined) {
    data.resurrectionMode = Boolean(body.resurrectionMode);
  }
  if (body.tierBudgets !== undefined) {
    data.tierBudgets = body.tierBudgets ? JSON.stringify(body.tierBudgets) : null;
  }
  if (body.rosterBudgetOverrides !== undefined) {
    data.rosterBudgetOverrides = body.rosterBudgetOverrides
      ? JSON.stringify(body.rosterBudgetOverrides)
      : null;
  }
  if (body.tierStartingPsp !== undefined) {
    data.tierStartingPsp = body.tierStartingPsp
      ? JSON.stringify(body.tierStartingPsp)
      : null;
  }
  if (body.rosterStartingPspOverrides !== undefined) {
    data.rosterStartingPspOverrides = body.rosterStartingPspOverrides
      ? JSON.stringify(body.rosterStartingPspOverrides)
      : null;
  }
  return data;
}

/** Projette la config « règles avancées » d'une coupe pour les réponses API. */
function formatCupRules(cup: {
  resurrectionMode?: boolean | null;
  tierBudgets?: unknown;
  rosterBudgetOverrides?: unknown;
  tierStartingPsp?: unknown;
  rosterStartingPspOverrides?: unknown;
}) {
  return {
    resurrectionMode: Boolean(cup.resurrectionMode),
    tierBudgets: parseNumberMap(cup.tierBudgets),
    rosterBudgetOverrides: parseNumberMap(cup.rosterBudgetOverrides),
    tierStartingPsp: parseNumberMap(cup.tierStartingPsp),
    rosterStartingPspOverrides: parseNumberMap(cup.rosterStartingPspOverrides),
  };
}

/**
 * `true` si la coupe applique un ajustement de composition (budget ou PSP par
 * tier/roster). Le mode résurrection n'est PAS un ajustement de composition.
 * Sert à décider si l'on peut « inscrire tel quel » (aucun ajustement) ou si
 * l'inscription passe forcément par une adaptation.
 */
function isCupAdjusted(cup: CupRulesConfig): boolean {
  const rc = formatCupRules(cup);
  return (
    Object.keys(rc.tierBudgets).length > 0 ||
    Object.keys(rc.rosterBudgetOverrides).length > 0 ||
    Object.keys(rc.tierStartingPsp).length > 0 ||
    Object.keys(rc.rosterStartingPspOverrides).length > 0
  );
}

// GET /cup - Liste les coupes visibles par l'utilisateur
// Règles : coupes publiques ET ouvertes, OU coupes auxquelles l'utilisateur participe
router.get("/", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { publicOnly } = req.query;
    const showAll = publicOnly === "false"; // Si publicOnly=false, on montre toutes les coupes (pour l'admin)
    
    // Récupérer les équipes de l'utilisateur pour vérifier sa participation
    const userTeams = await prisma.team.findMany({
      where: { ownerId: req.user!.id, deletedAt: null },
      select: { id: true },
    });
    const userTeamIds = userTeams.map((t: typeof userTeams[number]) => t.id);

    // Construire la condition where
    let whereClause: any = {};

    if (!showAll) {
      // Pour les utilisateurs normaux : coupes publiques ET ouvertes, OU coupes auxquelles ils participent
      // Si userTeamIds est vide, on ne peut pas participer, donc on ne montre que les coupes publiques ouvertes
      if (userTeamIds.length === 0) {
        whereClause = {
          status: "ouverte",
          isPublic: true,
        };
      } else {
        whereClause = {
          status: { not: "archivee" }, // Exclure les coupes archivées
          OR: [
            // Coupes publiques ET ouvertes (inscriptions ouvertes)
            {
              isPublic: true,
              status: "ouverte",
            },
            // OU coupes auxquelles l'utilisateur participe (via ses équipes) - peu importe le statut
            {
              participants: {
                some: {
                  teamId: { in: userTeamIds },
                },
              },
            },
          ],
        };
      }
    } else {
      // Pour l'admin : toutes les coupes (y compris archivées)
      whereClause = {};
    }

    const cups = await prisma.cup.findMany({
      where: whereClause,
      include: {
        creator: {
          select: {
            id: true,
            coachName: true,
            // Audit round 7 (CRITICAL/PII) : email retire du select public.
          },
        },
        participants: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
                roster: true,
            ruleset: true,
                owner: {
                  select: {
                    id: true,
                    coachName: true,
                    // Audit round 7 (CRITICAL/PII) : email retire du select public.
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Corriger les incohérences : si une coupe est validée mais le statut est "ouverte", la mettre à jour
    for (const cup of cups) {
      if (cup.validated && cup.status === "ouverte") {
        await prisma.cup.update({
          where: { id: cup.id },
          data: { status: "en_cours" },
        });
        cup.status = "en_cours";
      }
    }

    // Formater la réponse pour inclure le nombre de participants
    const formattedCups = cups.map((cup: typeof cups[number]) => ({
      id: cup.id,
      name: cup.name,
      description: cup.description,
      creator: cup.creator,
      creatorId: cup.creatorId,
      ruleset: cup.ruleset,
      format: cup.format,
      isAdjusted: isCupAdjusted(cup as unknown as CupRulesConfig),
      validated: cup.validated,
      isPublic: cup.isPublic,
      status: cup.status,
      participantCount: cup.participants.length,
      participants: cup.participants.map((p: typeof cup.participants[number]) => ({
        id: p.team.id,
        name: p.team.name,
        roster: p.team.roster,
        ruleset: p.team.ruleset,
        owner: p.team.owner,
      })),
      createdAt: cup.createdAt,
      updatedAt: cup.updatedAt,
    }));

    res.json({ cups: formattedCups });
  } catch (e: any) {
    serverLog.error("Erreur lors de la récupération des coupes:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// GET /cup/archived - Liste les coupes archivées auxquelles l'utilisateur participe ou qu'il a créées
router.get("/archived", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    // Récupérer les équipes de l'utilisateur pour vérifier sa participation
    const userTeams = await prisma.team.findMany({
      where: { ownerId: req.user!.id, deletedAt: null },
      select: { id: true },
    });
    const userTeamIds = userTeams.map((t: typeof userTeams[number]) => t.id);

    const cups = await prisma.cup.findMany({
      where: {
        status: "archivee",
        OR: [
          // Coupes créées par l'utilisateur
          { creatorId: req.user!.id },
          // OU coupes auxquelles l'utilisateur participe (via ses équipes)
          {
            participants: {
              some: {
                teamId: { in: userTeamIds },
              },
            },
          },
        ],
      },
      include: {
        creator: {
          select: {
            id: true,
            coachName: true,
            // Audit round 7 (CRITICAL/PII) : email retire du select public.
          },
        },
        participants: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
                roster: true,
            ruleset: true,
                owner: {
                  select: {
                    id: true,
                    coachName: true,
                    // Audit round 7 (CRITICAL/PII) : email retire du select public.
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formattedCups = cups.map((cup: typeof cups[number]) => ({
      id: cup.id,
      name: cup.name,
      description: cup.description,
      creator: cup.creator,
      creatorId: cup.creatorId,
      ruleset: cup.ruleset,
      format: cup.format,
      isAdjusted: isCupAdjusted(cup as unknown as CupRulesConfig),
      validated: cup.validated,
      isPublic: cup.isPublic,
      status: cup.status,
      participantCount: cup.participants.length,
      participants: cup.participants.map((p: typeof cup.participants[number]) => ({
        id: p.team.id,
        name: p.team.name,
        roster: p.team.roster,
        ruleset: p.team.ruleset,
        owner: p.team.owner,
      })),
      createdAt: cup.createdAt,
      updatedAt: cup.updatedAt,
    }));

    res.json({ cups: formattedCups });
  } catch (e: any) {
    serverLog.error("Erreur lors de la récupération des coupes archivées:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// S27.1b — GET /cup/monthly : liste publique des Nuffle Cup mensuelles
// (filtres optionnels year/month). Pas d'auth : contenu public, indispensable
// au bracket visuel `/cups/{slug}` et au calendrier esport SEO.
// IMPORTANT : monter avant `/:id` pour eviter le pattern matching `/:id`
// qui capturerait "monthly".
router.get(
  "/monthly",
  validateQuery(listMonthlyCupsQuerySchema),
  async (req, res) => {
    const query = req.query as unknown as ListMonthlyCupsQuery;
    try {
      const { items, total, limit, offset } = await listMonthlyCups({
        year: query.year,
        month: query.month,
        limit: query.limit,
        offset: query.offset,
      });
      res.status(200).json({
        success: true,
        data: { cups: items },
        meta: { total, limit, page: Math.floor(offset / limit) },
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      const status = /year|month/i.test(msg) ? 400 : 500;
      res.status(status).json({ success: false, error: msg });
    }
  },
);

// S27.1g — POST /cup/match-of-the-week/:matchId : pick admin du match
// du moment. Auth + adminOnly inline (pas de middleware adminOnly
// global ici car les autres routes /cup ne sont pas admin).
router.post(
  "/match-of-the-week/:matchId",
  authUser,
  validate(setMatchOfTheWeekSchema),
  async (req: AuthenticatedRequest, res) => {
    if (!hasRole(req.user!.roles, "admin")) {
      return res
        .status(403)
        .json({ success: false, error: "Action reservee aux administrateurs" });
    }
    const body: SetMatchOfTheWeekBody = req.body;
    try {
      const match = await setMatchOfTheWeek({
        matchId: req.params.matchId,
        note: body.note ?? null,
      });
      res.status(200).json({ success: true, data: { match } });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      const status = /introuvable/i.test(msg) ? 404 : 400;
      res.status(status).json({ success: false, error: msg });
    }
  },
);

// S27.1f — GET /cup/match-of-the-week : match du moment pick par un admin.
// Pas d'auth : teaser public consomme par la home / la page cups landing.
// Monte avant `/:id` pour eviter le pattern matching.
router.get("/match-of-the-week", async (_req, res) => {
  try {
    const match = await getCurrentMatchOfTheWeek();
    res.status(200).json({ success: true, data: { match } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    serverLog.error("[GET /cup/match-of-the-week] error:", msg);
    res.status(500).json({ success: false, error: msg });
  }
});

// GET /cup/:id - Détails d'une coupe
router.get("/:id", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    let cup = await prisma.cup.findUnique({
      where: { id: req.params.id },
      include: {
        creator: {
          select: {
            id: true,
            coachName: true,
            // Audit round 7 (CRITICAL/PII) : email retire du select public.
          },
        },
        participants: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
                roster: true,
            ruleset: true,
                owner: {
                  select: {
                    id: true,
                    coachName: true,
                    // Audit round 7 (CRITICAL/PII) : email retire du select public.
                  },
                },
              },
            },
          },
        },
        localMatches: {
          where: { status: "completed" },
          include: {
            teamA: {
              select: {
                id: true,
                name: true,
                roster: true,
            ruleset: true,
              },
            },
            teamB: {
              select: {
                id: true,
                name: true,
                roster: true,
            ruleset: true,
              },
            },
            actions: true,
          },
        },
      },
    });

    if (!cup) {
      return res.status(404).json({ error: "Coupe introuvable" });
    }

    // Corriger l'incohérence : si la coupe est validée mais le statut est "ouverte", la mettre à jour
    if (cup.validated && cup.status === "ouverte") {
      cup = await prisma.cup.update({
        where: { id: cup.id },
        data: { status: "en_cours" },
        include: {
          creator: {
            select: {
              id: true,
              coachName: true,
              // Audit round 7 (CRITICAL/PII) : email retire du select public.
            },
          },
          participants: {
            include: {
              team: {
                select: {
                  id: true,
                  name: true,
                  roster: true,
                  owner: {
                    select: {
                      id: true,
                      coachName: true,
                      // Audit round 7 (CRITICAL/PII) : email retire du select public.
                    },
                  },
                },
              },
            },
          },
          localMatches: {
            where: { status: "completed" },
            include: {
              teamA: {
                select: {
                  id: true,
                  name: true,
                  roster: true,
                },
              },
              teamB: {
                select: {
                  id: true,
                  name: true,
                  roster: true,
                },
              },
              actions: true,
            },
          },
        },
      });
    }

    // Récupérer les équipes de l'utilisateur pour vérifier s'il a une équipe inscrite
    const userTeams = await prisma.team.findMany({
      where: { ownerId: req.user!.id, deletedAt: null },
      select: { id: true },
    });
    const userTeamIds = new Set(userTeams.map((t: typeof userTeams[number]) => t.id));

    // Trouver les équipes de l'utilisateur qui participent à cette coupe
    const userParticipatingTeamIds = cup.participants
      .filter((p: any) => userTeamIds.has(p.team.id))
      .map((p: any) => p.team.id);

    // Calculer le classement de la coupe à partir des matchs terminés
    const standingsResult = computeCupStandings(
      cup as unknown as CupWithParticipantsAndScoring,
      (cup.localMatches || []) as unknown as LocalMatchWithRelations[],
    );

    // Classements individuels (par joueur) — équivalent leaderboards de ligue,
    // sans « future star » (PSP) ni « MVP » (indisponibles en coupe).
    const playerLeaderboards = computeCupPlayerLeaderboards(
      (cup.localMatches || []) as unknown as CupMatchForPlayerStats[],
    );

    const formattedCup = {
      id: cup.id,
      name: cup.name,
      description: cup.description,
      creator: cup.creator,
      creatorId: cup.creatorId,
      ruleset: cup.ruleset,
      format: cup.format,
      isAdjusted: isCupAdjusted(cup as unknown as CupRulesConfig),
      validated: cup.validated,
      isPublic: cup.isPublic,
      status: cup.status,
      participantCount: cup.participants.length,
      participants: cup.participants.map((p: any) => ({
        id: p.team.id,
        name: p.team.name,
        roster: p.team.roster,
        ruleset: p.team.ruleset,
        owner: p.team.owner,
      })),
      createdAt: cup.createdAt,
      updatedAt: cup.updatedAt,
      isCreator: cup.creatorId === req.user!.id,
      hasTeamParticipating: cup.participants.some((p: any) => userTeamIds.has(p.team.id)),
      userParticipatingTeamIds, // Liste des IDs des équipes de l'utilisateur qui participent
      scoringConfig: standingsResult.scoringConfig,
      rulesConfig: formatCupRules(cup as unknown as CupRulesConfig),
      standings: standingsResult.teamStats,
      actionAwards: standingsResult.awards,
      playerLeaderboards,
      playerLeaderboardCategories: CUP_LEADERBOARD_CATEGORIES,
      matches: (cup.localMatches || []).map((m: any) => ({
        id: m.id,
        name: m.name,
        status: m.status,
        isPublic: m.isPublic ?? true,
        teamA: {
          id: m.teamA.id,
          name: m.teamA.name,
          roster: m.teamA.roster,
          ruleset: m.teamA.ruleset,
        },
        teamB: m.teamB
          ? {
              id: m.teamB.id,
              name: m.teamB.name,
              roster: m.teamB.roster,
              ruleset: m.teamB.ruleset,
            }
          : null,
        scoreTeamA: m.scoreTeamA ?? null,
        scoreTeamB: m.scoreTeamB ?? null,
        createdAt: m.createdAt,
      })),
    };

    res.json({ cup: formattedCup });
  } catch (e: any) {
    serverLog.error("Erreur lors de la récupération de la coupe:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// POST /cup - Créer une nouvelle coupe
router.post("/", authUser, validate(createCupSchema), async (req: AuthenticatedRequest, res) => {
  const body: {
    name: string;
    description?: string | null;
    isPublic?: boolean;
    ruleset?: string;
    format?: "bb11" | "sevens";
    scoringConfig?: Partial<{
      winPoints: number;
      drawPoints: number;
      lossPoints: number;
      forfeitPoints: number;
      touchdownPoints: number;
      blockCasualtyPoints: number;
      foulCasualtyPoints: number;
      passPoints: number;
    }>;
    winPoints?: number;
    drawPoints?: number;
    lossPoints?: number;
    forfeitPoints?: number;
    touchdownPoints?: number;
    blockCasualtyPoints?: number;
    foulCasualtyPoints?: number;
    passPoints?: number;
    monthlyYear?: number;
    monthlyMonth?: number;
    resurrectionMode?: boolean;
    tierBudgets?: Record<string, number>;
    rosterBudgetOverrides?: Record<string, number>;
    tierStartingPsp?: Record<string, number>;
  } = req.body;

  // S27.1i — La creation d'une cup mensuelle (avec slot canonique) est
  // reservee aux admins. Les coachs reguliers peuvent creer des cups
  // privees / non programmees comme avant.
  const wantsMonthly =
    body.monthlyYear !== undefined && body.monthlyMonth !== undefined;
  if (wantsMonthly && !hasRole(req.user!.roles, "admin")) {
    return res.status(403).json({
      error: "Seuls les administrateurs peuvent creer une cup mensuelle",
    });
  }

  const { name, isPublic } = body;
  const ruleset = resolveRuleset(body.ruleset);
  const format = body.format === "sevens" ? "sevens" : "bb11";

  // Par défaut, la coupe est publique
  const cupIsPublic = isPublic !== undefined ? Boolean(isPublic) : true;

  // Configuration de points : on part des valeurs par défaut et on applique
  // ce qui est fourni soit dans scoringConfig, soit à plat.
  const scoringFromBody = {
    ...(body.scoringConfig ?? {}),
    winPoints: body.winPoints ?? body.scoringConfig?.winPoints,
    drawPoints: body.drawPoints ?? body.scoringConfig?.drawPoints,
    lossPoints: body.lossPoints ?? body.scoringConfig?.lossPoints,
    forfeitPoints: body.forfeitPoints ?? body.scoringConfig?.forfeitPoints,
    touchdownPoints: body.touchdownPoints ?? body.scoringConfig?.touchdownPoints,
    blockCasualtyPoints:
      body.blockCasualtyPoints ?? body.scoringConfig?.blockCasualtyPoints,
    foulCasualtyPoints:
      body.foulCasualtyPoints ?? body.scoringConfig?.foulCasualtyPoints,
    passPoints: body.passPoints ?? body.scoringConfig?.passPoints,
  };

  const defaultScoring = {
    winPoints: 1000,
    drawPoints: 400,
    lossPoints: 0,
    forfeitPoints: -100,
    touchdownPoints: 5,
    blockCasualtyPoints: 3,
    foulCasualtyPoints: 2,
    passPoints: 2,
  };

  const finalScoring = {
    winPoints: Number.isFinite(Number(scoringFromBody.winPoints))
      ? Number(scoringFromBody.winPoints)
      : defaultScoring.winPoints,
    drawPoints: Number.isFinite(Number(scoringFromBody.drawPoints))
      ? Number(scoringFromBody.drawPoints)
      : defaultScoring.drawPoints,
    lossPoints: Number.isFinite(Number(scoringFromBody.lossPoints))
      ? Number(scoringFromBody.lossPoints)
      : defaultScoring.lossPoints,
    forfeitPoints: Number.isFinite(Number(scoringFromBody.forfeitPoints))
      ? Number(scoringFromBody.forfeitPoints)
      : defaultScoring.forfeitPoints,
    touchdownPoints: Number.isFinite(Number(scoringFromBody.touchdownPoints))
      ? Number(scoringFromBody.touchdownPoints)
      : defaultScoring.touchdownPoints,
    blockCasualtyPoints: Number.isFinite(
      Number(scoringFromBody.blockCasualtyPoints),
    )
      ? Number(scoringFromBody.blockCasualtyPoints)
      : defaultScoring.blockCasualtyPoints,
    foulCasualtyPoints: Number.isFinite(
      Number(scoringFromBody.foulCasualtyPoints),
    )
      ? Number(scoringFromBody.foulCasualtyPoints)
      : defaultScoring.foulCasualtyPoints,
    passPoints: Number.isFinite(Number(scoringFromBody.passPoints))
      ? Number(scoringFromBody.passPoints)
      : defaultScoring.passPoints,
  };

  try {
    const cup = await prisma.cup.create({
      data: {
        name: name.trim(),
        description: body.description?.trim() || null,
        creatorId: req.user!.id,
        ruleset,
        format,
        validated: false,
        isPublic: cupIsPublic,
        ...finalScoring,
        // Règles avancées de composition (mode coupe). Maps JSON sérialisées
        // en string pour rester compatibles PG (Json) + miroir SQLite (String).
        ...serializeCupRulesData(body),
        // Mode résurrection : seul mode disponible actuellement en coupe.
        resurrectionMode: true,
        // S27.1i — slot mensuel admin (couple deja valide par Zod).
        ...(wantsMonthly
          ? {
              monthlyYear: body.monthlyYear,
              monthlyMonth: body.monthlyMonth,
            }
          : {}),
      },
      include: {
        creator: {
          select: {
            id: true,
            coachName: true,
            // Audit round 7 (CRITICAL/PII) : email retire du select public.
          },
        },
        participants: true,
      },
    });

    const formattedCup = {
      id: cup.id,
      name: cup.name,
      description: cup.description,
      creator: cup.creator,
      creatorId: cup.creatorId,
      ruleset: cup.ruleset,
      format: cup.format,
      isAdjusted: isCupAdjusted(cup as unknown as CupRulesConfig),
      validated: cup.validated,
      isPublic: cup.isPublic,
      status: cup.status || "ouverte",
      participantCount: cup.participants.length,
      participants: [],
      createdAt: cup.createdAt,
      updatedAt: cup.updatedAt,
      scoringConfig: {
        winPoints: cup.winPoints,
        drawPoints: cup.drawPoints,
        lossPoints: cup.lossPoints,
        forfeitPoints: cup.forfeitPoints,
        touchdownPoints: cup.touchdownPoints,
        blockCasualtyPoints: cup.blockCasualtyPoints,
        foulCasualtyPoints: cup.foulCasualtyPoints,
        passPoints: cup.passPoints,
      },
      rulesConfig: formatCupRules(cup),
    };

    res.status(201).json({ cup: formattedCup });
  } catch (e: any) {
    serverLog.error("Erreur lors de la création de la coupe:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// PATCH /cup/:id/rules - Met à jour les règles avancées de composition
// (résurrection, budgets par tier, overrides roster, PSP par tier).
// Réservé au créateur de la coupe ou à un admin. Tant que la coupe n'est
// pas validée (inscriptions ouvertes) pour éviter de changer les règles
// sous les pieds des équipes déjà inscrites.
router.patch(
  "/:id/rules",
  authUser,
  validate(updateCupRulesSchema),
  async (req: AuthenticatedRequest, res) => {
    const cupId = req.params.id;
    const body: CupRulesConfigInput = req.body;
    try {
      const cup = await prisma.cup.findUnique({
        where: { id: cupId },
        select: { id: true, creatorId: true, validated: true },
      });
      if (!cup) {
        return res.status(404).json({ error: "Coupe introuvable" });
      }
      const isAdmin = hasRole(req.user!.roles, "admin");
      if (cup.creatorId !== req.user!.id && !isAdmin) {
        return res
          .status(403)
          .json({ error: "Seul le commissaire de la coupe peut modifier ses règles" });
      }
      if (cup.validated && !isAdmin) {
        return res.status(400).json({
          error:
            "Les inscriptions sont closes : les règles ne sont plus modifiables",
        });
      }

      const updated = await prisma.cup.update({
        where: { id: cupId },
        data: serializeCupRulesData(body),
        select: {
          resurrectionMode: true,
          tierBudgets: true,
          rosterBudgetOverrides: true,
          tierStartingPsp: true,
          rosterStartingPspOverrides: true,
        },
      });

      res.json({ rulesConfig: formatCupRules(updated as unknown as CupRulesConfig) });
    } catch (e: any) {
      serverLog.error("Erreur lors de la mise à jour des règles de coupe:", e);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  },
);

// POST /cup/:id/register - Inscrire une équipe à une coupe
router.post(
  "/:id/register",
  authUser,
  validate(registerCupSchema),
  async (req: AuthenticatedRequest, res) => {
    const cupId = req.params.id;
    const { teamId } = req.body;

    try {
      // Toute la logique d'inscription est centralisée (réutilisée par
      // l'acceptation d'invitation). Les erreurs typées sont mappées ci-dessous.
      await registerTeamToCup({ cupId, teamId, userId: req.user!.id });

      // Récupérer la coupe mise à jour
      const updatedCup = await prisma.cup.findUnique({
        where: { id: cupId },
        include: {
          creator: {
            select: {
              id: true,
              coachName: true,
              // Audit round 7 (CRITICAL/PII) : email retire du select public.
            },
          },
          participants: {
            include: {
              team: {
                select: {
                  id: true,
                  name: true,
                  roster: true,
                  owner: {
                    select: {
                      id: true,
                      coachName: true,
                      // Audit round 7 (CRITICAL/PII) : email retire du select public.
                    },
                  },
                },
              },
            },
          },
        },
      });

      const formattedCup = {
        id: updatedCup!.id,
        name: updatedCup!.name,
        creator: updatedCup!.creator,
        creatorId: updatedCup!.creatorId,
        validated: updatedCup!.validated,
        isPublic: updatedCup!.isPublic,
        status: updatedCup!.status,
        participantCount: updatedCup!.participants.length,
        participants: updatedCup!.participants.map((p: any) => ({
          id: p.team.id,
          name: p.team.name,
          roster: p.team.roster,
          owner: p.team.owner,
        })),
        createdAt: updatedCup!.createdAt,
        updatedAt: updatedCup!.updatedAt,
      };

      res.status(201).json({
        cup: formattedCup,
        message: "Équipe inscrite avec succès",
      });
    } catch (e: any) {
      if (e instanceof CupRegistrationError) {
        return res.status(mapCupRegistrationStatus(e.code)).json({ error: e.message });
      }
      serverLog.error("Erreur lors de l'inscription à la coupe:", e);
      if (e?.code === "P2002") {
        return res
          .status(409)
          .json({ error: "Cette équipe est déjà inscrite à cette coupe" });
      }
      return res.status(500).json({ error: "Erreur serveur" });
    }
  },
);

// POST /cup/:id/unregister - Retirer une équipe d'une coupe
router.post(
  "/:id/unregister",
  authUser,
  validate(unregisterCupSchema),
  async (req: AuthenticatedRequest, res) => {
    const cupId = req.params.id;
    const { teamId, force } = req.body;
    const isAdmin = hasRole(req.user!.roles, "admin");
    const forceRemove = force === true && isAdmin;

    try {
      // Vérifier que la coupe existe
      const cup = await prisma.cup.findUnique({
        where: { id: cupId },
        include: {
          participants: true,
        },
      });

      if (!cup) {
        return res.status(404).json({ error: "Coupe introuvable" });
      }

      // Vérifier que la coupe est ouverte aux inscriptions (sauf si admin force)
      if (!forceRemove && (cup.status !== "ouverte" || cup.validated)) {
        return res
          .status(400)
          .json({ error: "Impossible de retirer une équipe d'une coupe fermée" });
      }

      // Vérifier que l'équipe existe (et appartient à l'utilisateur si ce n'est pas un admin)
      const team = await prisma.team.findFirst({
        where: isAdmin ? { id: teamId } : { id: teamId, ownerId: req.user!.id },
      });

      if (!team) {
        return res.status(404).json({ error: "Équipe introuvable ou vous n'en êtes pas le propriétaire" });
      }

      // Vérifier que l'équipe est bien inscrite
      const participant = cup.participants.find((p: any) => p.teamId === teamId);
      if (!participant) {
        return res
          .status(400)
          .json({ error: "Cette équipe n'est pas inscrite à cette coupe" });
      }

      // Retirer l'équipe de la coupe
      await prisma.cupParticipant.delete({
        where: { id: participant.id },
      });

      // Récupérer la coupe mise à jour
      const updatedCup = await prisma.cup.findUnique({
        where: { id: cupId },
        include: {
          creator: {
            select: {
              id: true,
              coachName: true,
              // Audit round 7 (CRITICAL/PII) : email retire du select public.
            },
          },
          participants: {
            include: {
              team: {
                select: {
                  id: true,
                  name: true,
                  roster: true,
                  owner: {
                    select: {
                      id: true,
                      coachName: true,
                      // Audit round 7 (CRITICAL/PII) : email retire du select public.
                    },
                  },
                },
              },
            },
          },
        },
      });

      const formattedCup = {
        id: updatedCup!.id,
        name: updatedCup!.name,
        creator: updatedCup!.creator,
        creatorId: updatedCup!.creatorId,
        validated: updatedCup!.validated,
        isPublic: updatedCup!.isPublic,
        status: updatedCup!.status,
        participantCount: updatedCup!.participants.length,
        participants: updatedCup!.participants.map((p: any) => ({
          id: p.team.id,
          name: p.team.name,
          roster: p.team.roster,
          owner: p.team.owner,
        })),
        createdAt: updatedCup!.createdAt,
        updatedAt: updatedCup!.updatedAt,
      };

      res.json({
        cup: formattedCup,
        message: "Équipe retirée avec succès",
      });
    } catch (e: any) {
      serverLog.error("Erreur lors du retrait de l'équipe:", e);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  },
);

// POST /cup/:id/validate - Valider une coupe (fermer les inscriptions) - créateur uniquement
router.post(
  "/:id/validate",
  authUser,
  async (req: AuthenticatedRequest, res) => {
    const cupId = req.params.id;

    try {
      // Vérifier que la coupe existe et que l'utilisateur est le créateur
      const cup = await prisma.cup.findUnique({
        where: { id: cupId },
      });

      if (!cup) {
        return res.status(404).json({ error: "Coupe introuvable" });
      }

      if (cup.creatorId !== req.user!.id) {
        return res
          .status(403)
          .json({ error: "Seul le créateur peut valider cette coupe" });
      }

      if (cup.validated) {
        return res
          .status(400)
          .json({ error: "Cette coupe est déjà validée" });
      }

      // Valider la coupe (fermer les inscriptions et passer en "en_cours")
      const updatedCup = await prisma.cup.update({
        where: { id: cupId },
        data: { 
          validated: true,
          status: "en_cours", // Passer automatiquement en "en_cours" quand on ferme les inscriptions
        },
        include: {
          creator: {
            select: {
              id: true,
              coachName: true,
              // Audit round 7 (CRITICAL/PII) : email retire du select public.
            },
          },
          participants: {
            include: {
              team: {
                select: {
                  id: true,
                  name: true,
                  roster: true,
                  owner: {
                    select: {
                      id: true,
                      coachName: true,
                      // Audit round 7 (CRITICAL/PII) : email retire du select public.
                    },
                  },
                },
              },
            },
          },
        },
      });

      const formattedCup = {
        id: updatedCup.id,
        name: updatedCup.name,
        creator: updatedCup.creator,
        creatorId: updatedCup.creatorId,
        validated: updatedCup.validated,
        isPublic: updatedCup.isPublic,
        status: updatedCup.status,
        participantCount: updatedCup.participants.length,
        participants: updatedCup.participants.map((p: any) => ({
          id: p.team.id,
          name: p.team.name,
          roster: p.team.roster,
          owner: p.team.owner,
        })),
        createdAt: updatedCup.createdAt,
        updatedAt: updatedCup.updatedAt,
      };

      res.json({
        cup: formattedCup,
        message: "Coupe validée avec succès",
      });
    } catch (e: any) {
      serverLog.error("Erreur lors de la validation de la coupe:", e);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  },
);

// POST /cup/:id/status - Mettre à jour le statut d'une coupe (créateur uniquement)
router.post(
  "/:id/status",
  authUser,
  validate(updateCupStatusSchema),
  async (req: AuthenticatedRequest, res) => {
    const cupId = req.params.id;
    const { status } = req.body;

    try {
      // Vérifier que la coupe existe et que l'utilisateur est le créateur
      const cup = await prisma.cup.findUnique({
        where: { id: cupId },
      });

      if (!cup) {
        return res.status(404).json({ error: "Coupe introuvable" });
      }

      const isAdmin = hasRole(req.user!.roles, "admin");
      
      // Seul le créateur ou un admin peut modifier le statut
      if (cup.creatorId !== req.user!.id && !isAdmin) {
        return res
          .status(403)
          .json({ error: "Seul le créateur ou un administrateur peut modifier le statut de cette coupe" });
      }

      // Vérifier les règles de transition de statut (sauf pour les admins)
      if (!isAdmin) {
        if (cup.status === "archivee") {
          return res.status(400).json({ 
            error: "Une coupe archivée ne peut plus changer de statut" 
          });
        }

        if (cup.status === "terminee" && status !== "archivee") {
          return res.status(400).json({ 
            error: "Une coupe terminée ne peut être que archivée" 
          });
        }

        if (cup.status === "en_cours" && status === "ouverte") {
          return res.status(400).json({ 
            error: "Une coupe en cours ne peut pas revenir à ouverte" 
          });
        }
      }

      // Mettre à jour le statut
      const updatedCup = await prisma.cup.update({
        where: { id: cupId },
        data: { status },
        include: {
          creator: {
            select: {
              id: true,
              coachName: true,
              // Audit round 7 (CRITICAL/PII) : email retire du select public.
            },
          },
          participants: {
            include: {
              team: {
                select: {
                  id: true,
                  name: true,
                  roster: true,
                  owner: {
                    select: {
                      id: true,
                      coachName: true,
                      // Audit round 7 (CRITICAL/PII) : email retire du select public.
                    },
                  },
                },
              },
            },
          },
        },
      });

      const formattedCup = {
        id: updatedCup.id,
        name: updatedCup.name,
        creator: updatedCup.creator,
        creatorId: updatedCup.creatorId,
        validated: updatedCup.validated,
        isPublic: updatedCup.isPublic,
        status: updatedCup.status,
        participantCount: updatedCup.participants.length,
        participants: updatedCup.participants.map((p: any) => ({
          id: p.team.id,
          name: p.team.name,
          roster: p.team.roster,
          owner: p.team.owner,
        })),
        createdAt: updatedCup.createdAt,
        updatedAt: updatedCup.updatedAt,
      };

      res.json({
        cup: formattedCup,
        message: "Statut mis à jour avec succès",
      });
    } catch (e: any) {
      serverLog.error("Erreur lors de la mise à jour du statut:", e);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  },
);

export default router;

