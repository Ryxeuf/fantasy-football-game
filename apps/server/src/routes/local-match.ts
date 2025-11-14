import { Router } from "express";
import { prisma } from "../prisma";
import { authUser, AuthenticatedRequest } from "../middleware/authUser";
import { setupPreMatchWithTeams } from "@bb/game-engine";
import { randomBytes } from "crypto";

const router = Router();

// GET /local-match - Liste les parties offline de l'utilisateur (ou toutes si admin)
router.get("/", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { status, cupId, all } = req.query;
    const isAdmin = req.user!.role === "admin";
    const showAll = all === "true" && isAdmin;
    
    // Construire la condition where
    const whereClause: any = showAll ? {} : { creatorId: req.user!.id };
    
    if (status && typeof status === "string") {
      whereClause.status = status;
    }
    
    if (cupId && typeof cupId === "string") {
      whereClause.cupId = cupId;
    }
    
    const localMatches = await prisma.localMatch.findMany({
      where: whereClause,
      include: {
        creator: showAll ? {
          select: {
            id: true,
            coachName: true,
            email: true,
          },
        } : undefined,
        teamA: {
          select: {
            id: true,
            name: true,
            roster: true,
            owner: {
              select: {
                id: true,
                coachName: true,
              },
            },
          },
        },
        teamB: {
          select: {
            id: true,
            name: true,
            roster: true,
            owner: {
              select: {
                id: true,
                coachName: true,
              },
            },
          },
        },
        cup: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    
    res.json({ localMatches });
  } catch (e: any) {
    console.error("Erreur lors de la récupération des parties offline:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// GET /local-match/:id - Détails d'une partie offline
router.get("/:id", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    const localMatch = await prisma.localMatch.findUnique({
      where: { id: req.params.id },
      include: {
        creator: {
          select: {
            id: true,
            coachName: true,
            email: true,
          },
        },
        teamA: {
          include: {
            players: true,
            owner: {
              select: {
                id: true,
                coachName: true,
              },
            },
          },
        },
        teamB: {
          include: {
            players: true,
            owner: {
              select: {
                id: true,
                coachName: true,
              },
            },
          },
        },
        cup: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });
    
    if (!localMatch) {
      return res.status(404).json({ error: "Partie offline introuvable" });
    }
    
    // Vérifier que l'utilisateur est le créateur ou propriétaire d'une des équipes
    const isCreator = localMatch.creatorId === req.user!.id;
    const isTeamOwner = 
      localMatch.teamA.ownerId === req.user!.id || 
      localMatch.teamB.ownerId === req.user!.id;
    
    if (!isCreator && !isTeamOwner) {
      return res.status(403).json({ error: "Accès non autorisé" });
    }
    
    res.json({ localMatch });
  } catch (e: any) {
    console.error("Erreur lors de la récupération de la partie offline:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// POST /local-match - Créer une nouvelle partie offline
router.post("/", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { name, teamAId, teamBId, cupId } = req.body;
    
    if (!teamAId) {
      return res.status(400).json({ error: "teamAId est requis" });
    }
    
    // Si une coupe est fournie, teamBId est requis
    if (cupId && !teamBId) {
      return res.status(400).json({ error: "teamBId est requis lorsque cupId est fourni" });
    }
    
    // Si pas de coupe, teamBId peut être null (sera rempli par le second joueur)
    // Si coupe, teamBId est requis
    if (teamBId && teamAId === teamBId) {
      return res.status(400).json({ error: "Les deux équipes doivent être différentes" });
    }
    
    // Vérifier que l'équipe A existe
    const teamA = await prisma.team.findUnique({
      where: { id: teamAId },
      include: { players: true },
    });
    
    if (!teamA) {
      return res.status(404).json({ error: "Équipe A introuvable" });
    }
    
    // Vérifier que le créateur possède l'équipe A
    const isTeamAOwner = teamA.ownerId === req.user!.id;
    if (!isTeamAOwner) {
      return res.status(403).json({ error: "Vous devez être propriétaire de l'équipe A" });
    }
    
    let teamB = null;
    let isTeamBOwner = false;
    
    // Si teamBId est fourni, vérifier qu'il existe
    if (teamBId) {
      teamB = await prisma.team.findUnique({
        where: { id: teamBId },
        include: { players: true },
      });
      
      if (!teamB) {
        return res.status(404).json({ error: "Équipe B introuvable" });
      }
      
      // Vérifier que les deux équipes n'appartiennent pas au même joueur
      if (teamA.ownerId === teamB.ownerId) {
        return res.status(400).json({ error: "Les deux équipes ne peuvent pas appartenir au même joueur" });
      }
      
      isTeamBOwner = teamB.ownerId === req.user!.id;
    }
    
    // Vérifier la coupe si fournie
    if (cupId) {
      const cup = await prisma.cup.findUnique({
        where: { id: cupId },
        include: { participants: true },
      });
      
      if (!cup) {
        return res.status(404).json({ error: "Coupe introuvable" });
      }
      
      // Vérifier que l'équipe A participe à la coupe
      const teamAParticipates = cup.participants.some((p: any) => p.teamId === teamAId);
      if (!teamAParticipates) {
        return res.status(400).json({ error: "L'équipe A doit participer à la coupe" });
      }
      
      // Si teamBId est fourni, vérifier qu'il participe aussi à la coupe
      if (teamBId) {
        const teamBParticipates = cup.participants.some((p: any) => p.teamId === teamBId);
        if (!teamBParticipates) {
          return res.status(400).json({ error: "L'équipe B doit participer à la coupe" });
        }
      }
    }
    
    // Déterminer le statut initial et générer le shareToken si nécessaire
    let status = "pending";
    let shareToken: string | null = null;
    let teamAOwnerValidated = false;
    let teamBOwnerValidated = false;
    
    // Si aucune coupe n'est saisie, le match est en attente de joueur
    if (!cupId) {
      status = "waiting_for_player";
      // Générer un token unique pour le lien de partage
      shareToken = randomBytes(32).toString("hex");
      
      // Marquer le créateur comme validé selon l'équipe qu'il possède
      if (isTeamAOwner) {
        teamAOwnerValidated = true;
      }
      if (isTeamBOwner) {
        teamBOwnerValidated = true;
      }
    } else {
      // Si une coupe est saisie, le créateur valide automatiquement sa participation
      if (isTeamAOwner) {
        teamAOwnerValidated = true;
      }
      if (isTeamBOwner) {
        teamBOwnerValidated = true;
      }
    }
    
    // Créer la partie offline
    // Note: teamBId peut être null si pas de coupe (sera rempli par le second joueur)
    const localMatch = await prisma.localMatch.create({
      data: {
        name: name?.trim() || null,
        creatorId: req.user!.id,
        teamAId,
        teamBId: teamBId || null,
        cupId: cupId || null,
        status,
        shareToken,
        teamAOwnerValidated,
        teamBOwnerValidated,
      },
      include: {
        teamA: {
          select: {
            id: true,
            name: true,
            roster: true,
            owner: {
              select: {
                id: true,
                coachName: true,
              },
            },
          },
        },
        teamB: {
          select: {
            id: true,
            name: true,
            roster: true,
            owner: {
              select: {
                id: true,
                coachName: true,
              },
            },
          },
        },
        cup: cupId ? {
          select: {
            id: true,
            name: true,
          },
        } : undefined,
      },
    });
    
    res.status(201).json({ localMatch });
  } catch (e: any) {
    console.error("Erreur lors de la création de la partie offline:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// POST /local-match/:id/start - Démarrer une partie offline
router.post("/:id/start", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    const localMatch = await prisma.localMatch.findUnique({
      where: { id: req.params.id },
      include: {
        teamA: {
          include: { players: true },
        },
        teamB: {
          include: { players: true },
        },
      },
    });
    
    if (!localMatch) {
      return res.status(404).json({ error: "Partie offline introuvable" });
    }
    
    // Vérifier que l'utilisateur est le créateur ou propriétaire d'une des équipes
    const isCreator = localMatch.creatorId === req.user!.id;
    const isTeamOwner = 
      localMatch.teamA.ownerId === req.user!.id || 
      localMatch.teamB.ownerId === req.user!.id;
    
    if (!isCreator && !isTeamOwner) {
      return res.status(403).json({ error: "Accès non autorisé" });
    }
    
    if (localMatch.status !== "pending") {
      return res.status(400).json({ error: "La partie a déjà été démarrée ou terminée" });
    }
    
    // Préparer les données des équipes
    const teamAData = localMatch.teamA.players.map((p: any) => ({
      id: p.id,
      name: p.name,
      position: p.position,
      number: p.number,
      ma: p.ma,
      st: p.st,
      ag: p.ag,
      pa: p.pa,
      av: p.av,
      skills: p.skills || "",
    }));
    
    const teamBData = localMatch.teamB.players.map((p: any) => ({
      id: p.id,
      name: p.name,
      position: p.position,
      number: p.number,
      ma: p.ma,
      st: p.st,
      ag: p.ag,
      pa: p.pa,
      av: p.av,
      skills: p.skills || "",
    }));
    
    // Initialiser l'état du jeu en phase pré-match
    const gameState = setupPreMatchWithTeams(
      teamAData,
      teamBData,
      localMatch.teamA.name,
      localMatch.teamB.name,
    );
    
    // Mettre à jour la partie
    const updatedMatch = await prisma.localMatch.update({
      where: { id: req.params.id },
      data: {
        status: "in_progress",
        startedAt: new Date(),
        gameState: gameState as any,
      },
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
      },
    });
    
    res.json({ 
      localMatch: updatedMatch,
      gameState,
    });
  } catch (e: any) {
    console.error("Erreur lors du démarrage de la partie offline:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// PUT /local-match/:id/state - Sauvegarder l'état du jeu
router.put("/:id/state", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { gameState, scoreTeamA, scoreTeamB } = req.body;
    
    if (!gameState) {
      return res.status(400).json({ error: "gameState est requis" });
    }
    
    const localMatch = await prisma.localMatch.findUnique({
      where: { id: req.params.id },
    });
    
    if (!localMatch) {
      return res.status(404).json({ error: "Partie offline introuvable" });
    }
    
    // Vérifier que l'utilisateur est le créateur ou propriétaire d'une des équipes
    const isCreator = localMatch.creatorId === req.user!.id;
    if (!isCreator) {
      // Vérifier si l'utilisateur est propriétaire d'une des équipes
      const [teamA, teamB] = await Promise.all([
        prisma.team.findUnique({ where: { id: localMatch.teamAId }, select: { ownerId: true } }),
        prisma.team.findUnique({ where: { id: localMatch.teamBId }, select: { ownerId: true } }),
      ]);
      
      const isTeamOwner = 
        teamA?.ownerId === req.user!.id || 
        teamB?.ownerId === req.user!.id;
      
      if (!isTeamOwner) {
        return res.status(403).json({ error: "Accès non autorisé" });
      }
    }
    
    if (localMatch.status === "completed" || localMatch.status === "cancelled") {
      return res.status(400).json({ error: "Impossible de modifier une partie terminée ou annulée" });
    }
    
    // Mettre à jour l'état
    const updateData: any = {
      gameState: gameState as any,
      updatedAt: new Date(),
    };
    
    if (scoreTeamA !== undefined && scoreTeamB !== undefined) {
      updateData.scoreTeamA = scoreTeamA;
      updateData.scoreTeamB = scoreTeamB;
    }
    
    const updatedMatch = await prisma.localMatch.update({
      where: { id: req.params.id },
      data: updateData,
    });
    
    res.json({ localMatch: updatedMatch });
  } catch (e: any) {
    console.error("Erreur lors de la sauvegarde de l'état:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// POST /local-match/:id/complete - Terminer une partie offline
router.post("/:id/complete", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { scoreTeamA, scoreTeamB } = req.body;
    
    if (scoreTeamA === undefined || scoreTeamB === undefined) {
      return res.status(400).json({ error: "scoreTeamA et scoreTeamB sont requis" });
    }
    
    const localMatch = await prisma.localMatch.findUnique({
      where: { id: req.params.id },
    });
    
    if (!localMatch) {
      return res.status(404).json({ error: "Partie offline introuvable" });
    }
    
    // Vérifier que l'utilisateur est le créateur ou propriétaire d'une des équipes
    const isCreator = localMatch.creatorId === req.user!.id;
    if (!isCreator) {
      const [teamA, teamB] = await Promise.all([
        prisma.team.findUnique({ where: { id: localMatch.teamAId }, select: { ownerId: true } }),
        prisma.team.findUnique({ where: { id: localMatch.teamBId }, select: { ownerId: true } }),
      ]);
      
      const isTeamOwner = 
        teamA?.ownerId === req.user!.id || 
        teamB?.ownerId === req.user!.id;
      
      if (!isTeamOwner) {
        return res.status(403).json({ error: "Accès non autorisé" });
      }
    }
    
    if (localMatch.status === "completed" || localMatch.status === "cancelled") {
      return res.status(400).json({ error: "La partie est déjà terminée ou annulée" });
    }
    
    // Terminer la partie
    const updatedMatch = await prisma.localMatch.update({
      where: { id: req.params.id },
      data: {
        status: "completed",
        completedAt: new Date(),
        scoreTeamA,
        scoreTeamB,
      },
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
        cup: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    
    res.json({ localMatch: updatedMatch });
  } catch (e: any) {
    console.error("Erreur lors de la finalisation de la partie offline:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// DELETE /local-match/:id - Supprimer une partie offline
router.delete("/:id", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    const localMatch = await prisma.localMatch.findUnique({
      where: { id: req.params.id },
    });
    
    if (!localMatch) {
      return res.status(404).json({ error: "Partie offline introuvable" });
    }
    
    const isAdmin = req.user!.role === "admin";
    
    // Seul le créateur ou un admin peut supprimer
    if (localMatch.creatorId !== req.user!.id && !isAdmin) {
      return res.status(403).json({ error: "Seul le créateur ou un administrateur peut supprimer cette partie" });
    }
    
    await prisma.localMatch.delete({
      where: { id: req.params.id },
    });
    
    res.json({ message: "Partie offline supprimée avec succès" });
  } catch (e: any) {
    console.error("Erreur lors de la suppression de la partie offline:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// GET /local-match/:id/actions - Récupérer toutes les actions d'un match
router.get("/:id/actions", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    const localMatch = await prisma.localMatch.findUnique({
      where: { id: req.params.id },
      include: {
        teamA: { select: { ownerId: true } },
        teamB: { select: { ownerId: true } },
      },
    });
    
    if (!localMatch) {
      return res.status(404).json({ error: "Partie offline introuvable" });
    }
    
    // Vérifier que l'utilisateur est le créateur ou propriétaire d'une des équipes
    const isCreator = localMatch.creatorId === req.user!.id;
    const isTeamOwner = 
      localMatch.teamA.ownerId === req.user!.id || 
      (localMatch.teamB && localMatch.teamB.ownerId === req.user!.id);
    
    if (!isCreator && !isTeamOwner && req.user!.role !== "admin") {
      return res.status(403).json({ error: "Accès non autorisé" });
    }
    
    const actions = await prisma.localMatchAction.findMany({
      where: { matchId: req.params.id },
      orderBy: [
        { half: "asc" },
        { turn: "asc" },
        { createdAt: "asc" },
      ],
    });
    
    res.json({ actions });
  } catch (e: any) {
    console.error("Erreur lors de la récupération des actions:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// POST /local-match/:id/actions - Créer une nouvelle action
router.post("/:id/actions", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { half, turn, actionType, playerId, playerName, playerTeam, opponentId, opponentName, diceResult, fumble } = req.body;
    
    // Validation
    if (!half || !turn || !actionType || !playerId || !playerName || !playerTeam) {
      return res.status(400).json({ error: "Paramètres manquants" });
    }
    
    if (half < 1 || half > 2) {
      return res.status(400).json({ error: "La mi-temps doit être 1 ou 2" });
    }
    
    if (turn < 1 || turn > 8) {
      return res.status(400).json({ error: "Le tour doit être entre 1 et 8" });
    }
    
    const validActionTypes = ["passe", "reception", "td", "blocage", "blitz", "elimination", "aggression", "sprint", "esquive", "apothicaire"];
    if (!validActionTypes.includes(actionType)) {
      return res.status(400).json({ error: `Type d'action invalide. Doit être l'un de: ${validActionTypes.join(", ")}` });
    }
    
    if (!["A", "B"].includes(playerTeam)) {
      return res.status(400).json({ error: "L'équipe du joueur doit être A ou B" });
    }
    
    // Validation du résultat du dé si fourni (2D6 = 2 à 12, mais on accepte n'importe quel nombre)
    if (diceResult !== undefined && diceResult !== null) {
      if (typeof diceResult !== "number" || diceResult < 1) {
        return res.status(400).json({ error: "Le résultat du dé doit être un nombre positif" });
      }
    }
    
    const localMatch = await prisma.localMatch.findUnique({
      where: { id: req.params.id },
      include: {
        teamA: { select: { ownerId: true } },
        teamB: { select: { ownerId: true } },
      },
    });
    
    if (!localMatch) {
      return res.status(404).json({ error: "Partie offline introuvable" });
    }
    
    // Vérifier que l'utilisateur est le créateur ou propriétaire d'une des équipes
    const isCreator = localMatch.creatorId === req.user!.id;
    const isTeamOwner = 
      localMatch.teamA.ownerId === req.user!.id || 
      (localMatch.teamB && localMatch.teamB.ownerId === req.user!.id);
    
    if (!isCreator && !isTeamOwner && req.user!.role !== "admin") {
      return res.status(403).json({ error: "Accès non autorisé" });
    }
    
    const action = await prisma.localMatchAction.create({
      data: {
        matchId: req.params.id,
        half,
        turn,
        actionType,
        playerId,
        playerName,
        playerTeam,
        opponentId: opponentId || null,
        opponentName: opponentName || null,
        diceResult: diceResult !== undefined && diceResult !== null ? diceResult : null,
        fumble: fumble === true,
      },
    });
    
    res.json({ action });
  } catch (e: any) {
    console.error("Erreur lors de la création de l'action:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// DELETE /local-match/:id/actions/:actionId - Supprimer une action
router.delete("/:id/actions/:actionId", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { id, actionId } = req.params;
    
    const localMatch = await prisma.localMatch.findUnique({
      where: { id },
      include: {
        teamA: { select: { ownerId: true } },
        teamB: { select: { ownerId: true } },
      },
    });
    
    if (!localMatch) {
      return res.status(404).json({ error: "Partie offline introuvable" });
    }
    
    // Vérifier que l'action existe
    const action = await prisma.localMatchAction.findUnique({
      where: { id: actionId },
    });
    
    if (!action || action.matchId !== id) {
      return res.status(404).json({ error: "Action introuvable" });
    }
    
    // Vérifier que l'utilisateur est le créateur ou propriétaire d'une des équipes
    const isCreator = localMatch.creatorId === req.user!.id;
    const isTeamOwner = 
      localMatch.teamA.ownerId === req.user!.id || 
      (localMatch.teamB && localMatch.teamB.ownerId === req.user!.id);
    
    if (!isCreator && !isTeamOwner && req.user!.role !== "admin") {
      return res.status(403).json({ error: "Accès non autorisé" });
    }
    
    await prisma.localMatchAction.delete({
      where: { id: actionId },
    });
    
    res.json({ message: "Action supprimée avec succès" });
  } catch (e: any) {
    console.error("Erreur lors de la suppression de l'action:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// GET /local-match/share/:token - Récupérer les détails d'un match via le token de partage
router.get("/share/:token", async (req, res) => {
  try {
    const { token } = req.params;
    
    const localMatch = await prisma.localMatch.findUnique({
      where: { shareToken: token },
      include: {
        creator: {
          select: {
            id: true,
            coachName: true,
            email: true,
          },
        },
        teamA: {
          select: {
            id: true,
            name: true,
            roster: true,
            owner: {
              select: {
                id: true,
                coachName: true,
              },
            },
          },
        },
        teamB: {
          select: {
            id: true,
            name: true,
            roster: true,
            owner: {
              select: {
                id: true,
                coachName: true,
              },
            },
          },
        },
        cup: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });
    
    if (!localMatch) {
      return res.status(404).json({ error: "Lien de partage invalide" });
    }
    
    if (localMatch.status !== "waiting_for_player") {
      return res.status(400).json({ error: "Ce match n'est plus en attente de joueur" });
    }
    
    res.json({ localMatch });
  } catch (e: any) {
    console.error("Erreur lors de la récupération du match via le token:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// POST /local-match/share/:token/validate - Valider la participation d'un joueur via le lien de partage
router.post("/share/:token/validate", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { token } = req.params;
    const { teamBId } = req.body; // Optionnel : équipe du second joueur si teamBId était null
    
    const localMatch = await prisma.localMatch.findUnique({
      where: { shareToken: token },
      include: {
        teamA: {
          select: {
            ownerId: true,
          },
        },
        teamB: {
          select: {
            ownerId: true,
          },
        },
      },
    });
    
    if (!localMatch) {
      return res.status(404).json({ error: "Lien de partage invalide" });
    }
    
    if (localMatch.status !== "waiting_for_player") {
      return res.status(400).json({ error: "Ce match n'est plus en attente de joueur" });
    }
    
    // Vérifier que l'utilisateur est propriétaire de l'équipe A
    const isTeamAOwner = localMatch.teamA.ownerId === req.user!.id;
    
    // Si teamBId est null, le second joueur doit fournir son équipe
    if (!localMatch.teamBId) {
      if (isTeamAOwner) {
        return res.status(400).json({ error: "Vous êtes déjà le propriétaire de l'équipe A. Attendez qu'un autre joueur valide sa participation." });
      }
      
      if (!teamBId) {
        return res.status(400).json({ error: "teamBId est requis pour compléter le match" });
      }
      
      // Vérifier que l'équipe B existe et appartient à l'utilisateur
      const teamB = await prisma.team.findUnique({
        where: { id: teamBId },
      });
      
      if (!teamB) {
        return res.status(404).json({ error: "Équipe B introuvable" });
      }
      
      if (teamB.ownerId !== req.user!.id) {
        return res.status(403).json({ error: "Vous devez être propriétaire de l'équipe B" });
      }
      
      // Vérifier que les deux équipes n'appartiennent pas au même joueur
      if (localMatch.teamA.ownerId === teamB.ownerId) {
        return res.status(400).json({ error: "Les deux équipes ne peuvent pas appartenir au même joueur" });
      }
      
      // Mettre à jour le match avec l'équipe B et valider la participation
      const updateData: any = {
        teamBId: teamBId,
        teamBOwnerValidated: true,
      };
      
      // Si l'équipe A est déjà validée, passer en "in_progress"
      if (localMatch.teamAOwnerValidated) {
        updateData.status = "in_progress";
      }
      
      const updatedMatch = await prisma.localMatch.update({
        where: { id: localMatch.id },
        data: updateData,
        include: {
          teamA: {
            select: {
              id: true,
              name: true,
              roster: true,
              owner: {
                select: {
                  id: true,
                  coachName: true,
                },
              },
            },
          },
          teamB: {
            select: {
              id: true,
              name: true,
              roster: true,
              owner: {
                select: {
                  id: true,
                  coachName: true,
                },
              },
            },
          },
          cup: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      });
      
      return res.json({ localMatch: updatedMatch });
    }
    
    // Si teamBId existe déjà, vérifier que l'utilisateur est propriétaire d'une des équipes
    const isTeamBOwner = localMatch.teamB && localMatch.teamB.ownerId === req.user!.id;
    
    if (!isTeamAOwner && !isTeamBOwner) {
      return res.status(403).json({ error: "Vous n'êtes pas propriétaire d'une des équipes de ce match" });
    }
    
    // Mettre à jour la validation
    const updateData: any = {};
    if (isTeamAOwner && !localMatch.teamAOwnerValidated) {
      updateData.teamAOwnerValidated = true;
    }
    if (isTeamBOwner && !localMatch.teamBOwnerValidated) {
      updateData.teamBOwnerValidated = true;
    }
    
    // Si les deux joueurs ont validé, passer le match en "in_progress"
    const willBeFullyValidated = 
      (isTeamAOwner ? true : localMatch.teamAOwnerValidated) &&
      (isTeamBOwner ? true : localMatch.teamBOwnerValidated);
    
    if (willBeFullyValidated) {
      updateData.status = "in_progress";
    }
    
    const updatedMatch = await prisma.localMatch.update({
      where: { id: localMatch.id },
      data: updateData,
      include: {
        teamA: {
          select: {
            id: true,
            name: true,
            roster: true,
            owner: {
              select: {
                id: true,
                coachName: true,
              },
            },
          },
        },
        teamB: {
          select: {
            id: true,
            name: true,
            roster: true,
            owner: {
              select: {
                id: true,
                coachName: true,
              },
            },
          },
        },
        cup: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });
    
    res.json({ localMatch: updatedMatch });
  } catch (e: any) {
    console.error("Erreur lors de la validation de la participation:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;

