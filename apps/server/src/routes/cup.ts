import { Router } from "express";
import { prisma } from "../prisma";
import { authUser, AuthenticatedRequest } from "../middleware/authUser";
import {
  computeCupStandings,
  type CupWithParticipantsAndScoring,
  type LocalMatchWithRelations,
} from "../cupScoring";
import {
  computeCupStandings,
  type CupWithParticipantsAndScoring,
  type LocalMatchWithRelations,
} from "../cupScoring";

const router = Router();

// GET /cup - Liste les coupes visibles par l'utilisateur
// Règles : coupes publiques ET ouvertes, OU coupes auxquelles l'utilisateur participe
router.get("/", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { publicOnly } = req.query;
    const showAll = publicOnly === "false"; // Si publicOnly=false, on montre toutes les coupes (pour l'admin)
    
    // Récupérer les équipes de l'utilisateur pour vérifier sa participation
    const userTeams = await prisma.team.findMany({
      where: { ownerId: req.user!.id },
      select: { id: true },
    });
    const userTeamIds = userTeams.map((t) => t.id);

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
            email: true,
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
                    email: true,
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
    const formattedCups = cups.map((cup) => ({
      id: cup.id,
      name: cup.name,
      creator: cup.creator,
      creatorId: cup.creatorId,
      validated: cup.validated,
      isPublic: cup.isPublic,
      status: cup.status,
      participantCount: cup.participants.length,
      participants: cup.participants.map((p) => ({
        id: p.team.id,
        name: p.team.name,
        roster: p.team.roster,
        owner: p.team.owner,
      })),
      createdAt: cup.createdAt,
      updatedAt: cup.updatedAt,
    }));

    res.json({ cups: formattedCups });
  } catch (e: any) {
    console.error("Erreur lors de la récupération des coupes:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// GET /cup/archived - Liste les coupes archivées auxquelles l'utilisateur participe ou qu'il a créées
router.get("/archived", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    // Récupérer les équipes de l'utilisateur pour vérifier sa participation
    const userTeams = await prisma.team.findMany({
      where: { ownerId: req.user!.id },
      select: { id: true },
    });
    const userTeamIds = userTeams.map((t) => t.id);

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
            email: true,
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
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formattedCups = cups.map((cup) => ({
      id: cup.id,
      name: cup.name,
      creator: cup.creator,
      creatorId: cup.creatorId,
      validated: cup.validated,
      isPublic: cup.isPublic,
      status: cup.status,
      participantCount: cup.participants.length,
      participants: cup.participants.map((p) => ({
        id: p.team.id,
        name: p.team.name,
        roster: p.team.roster,
        owner: p.team.owner,
      })),
      createdAt: cup.createdAt,
      updatedAt: cup.updatedAt,
    }));

    res.json({ cups: formattedCups });
  } catch (e: any) {
    console.error("Erreur lors de la récupération des coupes archivées:", e);
    return res.status(500).json({ error: "Erreur serveur" });
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
            email: true,
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
                    email: true,
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
              email: true,
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
                      email: true,
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
      where: { ownerId: req.user!.id },
      select: { id: true },
    });
    const userTeamIds = new Set(userTeams.map((t) => t.id));

    // Trouver les équipes de l'utilisateur qui participent à cette coupe
    const userParticipatingTeamIds = cup.participants
      .filter((p) => userTeamIds.has(p.team.id))
      .map((p) => p.team.id);

    // Calculer le classement de la coupe à partir des matchs terminés
    const standingsResult = computeCupStandings(
      cup as unknown as CupWithParticipantsAndScoring,
      (cup.localMatches || []) as unknown as LocalMatchWithRelations[],
    );

    const formattedCup = {
      id: cup.id,
      name: cup.name,
      creator: cup.creator,
      creatorId: cup.creatorId,
      validated: cup.validated,
      isPublic: cup.isPublic,
      status: cup.status,
      participantCount: cup.participants.length,
      participants: cup.participants.map((p) => ({
        id: p.team.id,
        name: p.team.name,
        roster: p.team.roster,
        owner: p.team.owner,
      })),
      createdAt: cup.createdAt,
      updatedAt: cup.updatedAt,
      isCreator: cup.creatorId === req.user!.id,
      hasTeamParticipating: cup.participants.some((p) => userTeamIds.has(p.team.id)),
      userParticipatingTeamIds, // Liste des IDs des équipes de l'utilisateur qui participent
      scoringConfig: standingsResult.scoringConfig,
      standings: standingsResult.teamStats,
      actionAwards: standingsResult.awards,
      matches: (cup.localMatches || []).map((m: any) => ({
        id: m.id,
        name: m.name,
        status: m.status,
        isPublic: m.isPublic ?? true,
        teamA: {
          id: m.teamA.id,
          name: m.teamA.name,
          roster: m.teamA.roster,
        },
        teamB: m.teamB
          ? {
              id: m.teamB.id,
              name: m.teamB.name,
              roster: m.teamB.roster,
            }
          : null,
        scoreTeamA: m.scoreTeamA ?? null,
        scoreTeamB: m.scoreTeamB ?? null,
        createdAt: m.createdAt,
      })),
    };

    res.json({ cup: formattedCup });
  } catch (e: any) {
    console.error("Erreur lors de la récupération de la coupe:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// POST /cup - Créer une nouvelle coupe
router.post("/", authUser, async (req: AuthenticatedRequest, res) => {
  const body = (req.body ?? {}) as {
    name?: string;
    isPublic?: boolean;
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
    // Compatibilité : on accepte aussi les champs à plat
    winPoints?: number;
    drawPoints?: number;
    lossPoints?: number;
    forfeitPoints?: number;
    touchdownPoints?: number;
    blockCasualtyPoints?: number;
    foulCasualtyPoints?: number;
    passPoints?: number;
  };

  const { name, isPublic } = body;

  if (!name || typeof name !== "string" || name.trim() === "") {
    return res.status(400).json({ error: "Le nom de la coupe est requis" });
  }

  if (name.trim().length > 100) {
    return res
      .status(400)
      .json({ error: "Le nom de la coupe ne peut pas dépasser 100 caractères" });
  }

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
        creatorId: req.user!.id,
        validated: false,
        isPublic: cupIsPublic,
        ...finalScoring,
      },
      include: {
        creator: {
          select: {
            id: true,
            coachName: true,
            email: true,
          },
        },
        participants: true,
      },
    });

    const formattedCup = {
      id: cup.id,
      name: cup.name,
      creator: cup.creator,
      creatorId: cup.creatorId,
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
    };

    res.status(201).json({ cup: formattedCup });
  } catch (e: any) {
    console.error("Erreur lors de la création de la coupe:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// POST /cup/:id/register - Inscrire une équipe à une coupe
router.post(
  "/:id/register",
  authUser,
  async (req: AuthenticatedRequest, res) => {
    const cupId = req.params.id;
    const { teamId } = req.body ?? ({} as { teamId?: string });

    if (!teamId || typeof teamId !== "string") {
      return res.status(400).json({ error: "teamId requis" });
    }

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

      // Vérifier que la coupe est ouverte aux inscriptions
      if (cup.status !== "ouverte" || cup.validated) {
        return res
          .status(400)
          .json({ error: "Cette coupe est fermée aux inscriptions" });
      }

      // Vérifier que l'équipe existe et appartient à l'utilisateur
      const team = await prisma.team.findFirst({
        where: { id: teamId, ownerId: req.user!.id },
      });

      if (!team) {
        return res.status(404).json({ error: "Équipe introuvable ou vous n'en êtes pas le propriétaire" });
      }

      // Vérifier que l'équipe n'est pas déjà inscrite
      const alreadyParticipant = cup.participants.some(
        (p) => p.teamId === teamId,
      );
      if (alreadyParticipant) {
        return res
          .status(400)
          .json({ error: "Cette équipe est déjà inscrite à cette coupe" });
      }

      // Ajouter le participant (l'équipe)
      await prisma.cupParticipant.create({
        data: {
          cupId: cupId,
          teamId: teamId,
        },
      });

      // Récupérer la coupe mise à jour
      const updatedCup = await prisma.cup.findUnique({
        where: { id: cupId },
        include: {
          creator: {
            select: {
              id: true,
              coachName: true,
              email: true,
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
                      email: true,
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
        participants: updatedCup!.participants.map((p) => ({
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
      console.error("Erreur lors de l'inscription à la coupe:", e);
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
  async (req: AuthenticatedRequest, res) => {
    const cupId = req.params.id;
    const { teamId, force } = req.body ?? ({} as { teamId?: string; force?: boolean });
    const isAdmin = req.user!.role === "admin";
    const forceRemove = force === true && isAdmin;

    if (!teamId || typeof teamId !== "string") {
      return res.status(400).json({ error: "teamId requis" });
    }

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
      const participant = cup.participants.find((p) => p.teamId === teamId);
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
              email: true,
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
                      email: true,
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
        participants: updatedCup!.participants.map((p) => ({
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
      console.error("Erreur lors du retrait de l'équipe:", e);
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
              email: true,
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
                      email: true,
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
        participants: updatedCup.participants.map((p) => ({
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
      console.error("Erreur lors de la validation de la coupe:", e);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  },
);

// POST /cup/:id/status - Mettre à jour le statut d'une coupe (créateur uniquement)
router.post(
  "/:id/status",
  authUser,
  async (req: AuthenticatedRequest, res) => {
    const cupId = req.params.id;
    const { status } = req.body ?? ({} as { status?: string });

    const validStatuses = ["ouverte", "en_cours", "terminee", "archivee"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: `Statut invalide. Statuts valides: ${validStatuses.join(", ")}` 
      });
    }

    try {
      // Vérifier que la coupe existe et que l'utilisateur est le créateur
      const cup = await prisma.cup.findUnique({
        where: { id: cupId },
      });

      if (!cup) {
        return res.status(404).json({ error: "Coupe introuvable" });
      }

      const isAdmin = req.user!.role === "admin";
      
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
              email: true,
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
                      email: true,
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
        participants: updatedCup.participants.map((p) => ({
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
      console.error("Erreur lors de la mise à jour du statut:", e);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  },
);

export default router;

