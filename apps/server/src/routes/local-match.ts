import { Router } from "express";
import { prisma } from "../prisma";
import { authUser, AuthenticatedRequest } from "../middleware/authUser";
import {
  setupPreMatchWithTeams,
  startPreMatchSequence,
  calculateFanFactor,
  determineWeather,
  addJourneymen,
  processInducementsWithSelection,
  calculatePettyCash,
  processPrayersToNuffle,
  determineKickingTeam,
  enterSetupPhase,
  makeRNG,
  autoSetupAITeam,
  validatePlayerPlacement,
  startKickoffSequence,
  INDUCEMENT_CATALOGUE,
  listAIOpponentAllowedRosters,
  type WeatherType,
  type InducementSelection,
  type InducementContext,
  type ExtendedGameState,
  type TeamId,
} from "@bb/game-engine";
import { randomBytes } from "crypto";
import { hasRole } from "../utils/roles";
import { parsePagination, buildApiMeta } from "../utils/pagination";
import { persistMatchSPP } from "../services/spp-tracking";
import { persistPlayerDeaths } from "../services/player-death";
import { persistPermanentInjuries } from "../services/permanent-injuries";
import { getLinemanStats } from "../services/journeymen";
import { validate, validateQuery } from "../middleware/validate";
import { requireFeatureFlag } from "../middleware/requireFeatureFlag";
import { AI_TRAINING_FLAG } from "../services/featureFlags";
import {
  localMatchListQuerySchema,
  createLocalMatchSchema,
  updateLocalMatchStateSchema,
  completeLocalMatchSchema,
  updateLocalMatchStatusSchema,
  createLocalMatchActionSchema,
  validateShareTokenSchema,
  localMatchInducementsSchema,
} from "../schemas/local-match.schemas";

const router = Router();

// GET /local-match - Liste les parties offline visibles pour l'utilisateur
// - Par défaut : uniquement ses propres matchs (créateur ou propriétaire d'une des équipes)
// - scope=mine_and_public : ses matchs + les matchs publics
// - Si l'utilisateur est créateur d'une coupe et cupId fourni : il voit tous les matchs de cette coupe
router.get("/", authUser, validateQuery(localMatchListQuerySchema), async (req: AuthenticatedRequest, res) => {
  try {
    const { status, cupId, all, scope } = req.query;
    const isAdmin = hasRole(req.user!.roles, "admin");
    const showAll = all === "true" && isAdmin;
    const scopeValue =
      typeof scope === "string" && scope === "mine_and_public"
        ? "mine_and_public"
        : "mine";
    
    let whereClause: any = {};

    if (showAll) {
      // Admin avec all=true : peut tout voir, avec filtres éventuels
      if (status && typeof status === "string") {
        whereClause.status = status;
      }
      if (cupId && typeof cupId === "string") {
        whereClause.cupId = cupId;
      }
    } else {
      const filters: any[] = [];

      if (status && typeof status === "string") {
        filters.push({ status });
      }
      if (cupId && typeof cupId === "string") {
        filters.push({ cupId });
      }

      // Si on filtre par coupe, vérifier si l'utilisateur en est le créateur
      let isCupCreator = false;
      if (cupId && typeof cupId === "string") {
        const cup = await prisma.cup.findUnique({
          where: { id: cupId },
          select: { creatorId: true },
        });
        isCupCreator = !!cup && cup.creatorId === req.user!.id;
      }

      if (isCupCreator) {
        // Le créateur de la coupe voit tous les matchs associés à cette coupe
        if (filters.length === 1) {
          whereClause = filters[0];
        } else if (filters.length > 1) {
          whereClause = { AND: filters };
        } else {
          whereClause = {};
        }
      } else {
        // Visibilité standard : ses matchs (créateur ou propriétaire d'une équipe)
        // + éventuellement les matchs publics
        const visibilityOr: any[] = [
          { creatorId: req.user!.id },
          { teamA: { ownerId: req.user!.id } },
          { teamB: { ownerId: req.user!.id } },
        ];

        if (scopeValue === "mine_and_public") {
          visibilityOr.push({ isPublic: true });
        }

        if (filters.length > 0) {
          whereClause = {
            AND: [
              ...(filters.length === 1 ? filters : [{ AND: filters }]),
              { OR: visibilityOr },
            ],
          };
        } else {
          whereClause = { OR: visibilityOr };
        }
      }
    }
    
    const { limit, offset } = parsePagination(
      req.query as Record<string, unknown>,
    );
    const [localMatches, total] = await Promise.all([
      prisma.localMatch.findMany({
        where: whereClause,
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
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.localMatch.count({ where: whereClause }),
    ]);

    res.json({ localMatches, meta: buildApiMeta({ total, limit, offset }) });
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
            creatorId: true,
            status: true,
          },
        },
      },
    });
    
    if (!localMatch) {
      return res.status(404).json({ error: "Partie offline introuvable" });
    }
    
    // Vérifier que l'utilisateur est le créateur, propriétaire d'une des équipes
    // ou créateur de la coupe associée
    const isCreator = localMatch.creatorId === req.user!.id;
    const isTeamOwner = 
      localMatch.teamA.ownerId === req.user!.id || 
      localMatch.teamB.ownerId === req.user!.id;
    const isCupCreator =
      !!localMatch.cup && localMatch.cup.creatorId === req.user!.id;
    const isAdmin = hasRole(req.user!.roles, "admin");
    
    if (!isCreator && !isTeamOwner && !isCupCreator && !isAdmin) {
      return res.status(403).json({ error: "Accès non autorisé" });
    }
    
    res.json({ localMatch });
  } catch (e: any) {
    console.error("Erreur lors de la récupération de la partie offline:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// POST /local-match - Créer une nouvelle partie offline
router.post("/", authUser, validate(createLocalMatchSchema), async (req: AuthenticatedRequest, res) => {
  try {
    const { name, teamAId, teamBId, cupId, isPublic } = req.body;
    
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
        isPublic: isPublic === false ? false : true,
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
    // Paramètres optionnels pour saisie manuelle
    const { 
      manualD3A, 
      manualD3B, 
      weatherType,
      manualWeatherTotal 
    } = req.body;
    
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
    
    // Vérifier si la partie est déjà démarrée
    // Si le gameState existe et que la phase pré-match n'est pas 'idle', la partie est déjà démarrée
    const existingGameState = localMatch.gameState as any;
    const isAlreadyStarted = existingGameState?.preMatch?.phase && 
                             existingGameState.preMatch.phase !== 'idle';
    
    if (localMatch.status !== "pending" || isAlreadyStarted) {
      return res.status(400).json({ error: "La partie a déjà été démarrée ou terminée" });
    }
    
    // Préparer les données des équipes (exclure les joueurs morts)
    const teamAData = localMatch.teamA.players
      .filter((p: any) => !p.dead)
      .map((p: any) => ({
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

    const teamBData = localMatch.teamB.players
      .filter((p: any) => !p.dead)
      .map((p: any) => ({
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
    
    // Récupérer les fans dévoués des équipes
    const dedicatedFansA = localMatch.teamA.dedicatedFans || 1;
    const dedicatedFansB = localMatch.teamB.dedicatedFans || 1;
    
    // Initialiser l'état du jeu en phase pré-match.
    // H.6 — propagate roster slugs so the client renderer can pick per-roster colors.
    let gameState = setupPreMatchWithTeams(
      teamAData,
      teamBData,
      localMatch.teamA.name,
      localMatch.teamB.name,
      {
        teamARoster: localMatch.teamA.roster,
        teamBRoster: localMatch.teamB.roster,
      },
    );
    
    // Démarrer la séquence de pré-match : fans -> weather
    gameState = startPreMatchSequence(gameState);
    
    // Créer un générateur de nombres aléatoires
    const rng = makeRNG(`local-match-${req.params.id}-${Date.now()}`);
    
    // Calculer le Fan Factor et passer en phase weather
    // Utiliser les valeurs manuelles si fournies, sinon générer automatiquement
    gameState = calculateFanFactor(
      gameState,
      rng,
      dedicatedFansA,
      dedicatedFansB,
      manualD3A !== undefined ? Number(manualD3A) : undefined,
      manualD3B !== undefined ? Number(manualD3B) : undefined
    );
    
    // Déterminer la météo
    // Le type de météo est requis, utiliser 'classique' par défaut si non fourni
    const selectedWeatherType = (weatherType || 'classique') as WeatherType;
    gameState = determineWeather(
      gameState, 
      rng,
      selectedWeatherType,
      manualWeatherTotal !== undefined ? Number(manualWeatherTotal) : undefined
    );
    
    // Continuer automatiquement la séquence pré-match jusqu'à la phase setup
    // Journeymen : ajouter les joueurs de passage si nécessaire (11 joueurs par équipe)
    // Utiliser les stats du Lineman du roster de chaque équipe
    if (gameState.preMatch.phase === 'journeymen') {
      const [linemanStatsA, linemanStatsB] = await Promise.all([
        getLinemanStats(prisma as any, localMatch.teamA.roster),
        getLinemanStats(prisma as any, localMatch.teamB.roster),
      ]);
      gameState = addJourneymen(gameState, 11, 11, linemanStatsA, linemanStatsB);
    }
    
    // Inducements : pour les matchs IA, l'adversaire n'a pas d'UI pour choisir,
    // on enchaine automatiquement inducements (selections vides) -> prayers -> kicking-team -> setup.
    // Pour les matchs humain vs humain, on s'arrete ici pour que les joueurs choisissent via l'UI.
    if (localMatch.aiOpponent && gameState.preMatch.phase === 'inducements') {
      const ctvA = localMatch.teamA.players
        .filter((p: any) => !p.dead)
        .reduce((sum: number, p: any) => sum + (p.value || 0), 0);
      const ctvB = localMatch.teamB.players
        .filter((p: any) => !p.dead)
        .reduce((sum: number, p: any) => sum + (p.value || 0), 0);

      const pettyCashInput = {
        ctvTeamA: ctvA,
        ctvTeamB: ctvB,
        treasuryTeamA: (localMatch.teamA as any).treasury || 0,
        treasuryTeamB: (localMatch.teamB as any).treasury || 0,
      };

      const ctxA: InducementContext = {
        teamId: "A",
        regionalRules: [],
        hasApothecary: gameState.apothecaryAvailable?.teamA ?? false,
        rosterSlug: localMatch.teamA.roster,
      };
      const ctxB: InducementContext = {
        teamId: "B",
        regionalRules: [],
        hasApothecary: gameState.apothecaryAvailable?.teamB ?? false,
        rosterSlug: localMatch.teamB.roster,
      };

      const emptySelection: InducementSelection = { items: [] };
      const inducementsResult = processInducementsWithSelection(
        gameState,
        pettyCashInput,
        emptySelection,
        emptySelection,
        ctxA,
        ctxB,
      );
      gameState = inducementsResult.state;

      if (gameState.preMatch.phase === 'prayers') {
        gameState = processPrayersToNuffle(gameState, rng, ctvA - ctvB);
      }
      if (gameState.preMatch.phase === 'kicking-team') {
        gameState = determineKickingTeam(gameState, rng);
      }
      if (gameState.preMatch.phase === 'setup') {
        gameState = enterSetupPhase(gameState, gameState.preMatch.receivingTeam);
      }

      // Auto-place AI players when the AI is the current coach. Without this
      // the match hangs because no client submits placements for the AI side.
      const aiSide: TeamId = (localMatch as any).aiTeamSide === 'A' ? 'A' : 'B';
      for (let iter = 0; iter < 2; iter += 1) {
        if (gameState.preMatch.phase !== 'setup') break;
        if (gameState.preMatch.currentCoach !== aiSide) break;
        const before = gameState.players.filter(p => p.team === aiSide && p.pos.x >= 0).length;
        gameState = autoSetupAITeam(gameState, aiSide);
        const after = gameState.players.filter(p => p.team === aiSide && p.pos.x >= 0).length;
        if (after < 11 || after === before) break;
        gameState = validatePlayerPlacement(gameState);
      }
      if (gameState.preMatch.phase === 'kickoff') {
        gameState = startKickoffSequence(gameState);
      }
    }

    const isPreMatchComplete =
      gameState.preMatch.phase === 'setup' ||
      gameState.preMatch.phase === 'kickoff' ||
      gameState.preMatch.phase === 'kickoff-sequence';
    const matchStatus = isPreMatchComplete ? "in_progress" : "pending";
    
    // Mettre à jour la partie
    const updatedMatch = await prisma.localMatch.update({
      where: { id: req.params.id },
      data: {
        status: matchStatus,
        ...(isPreMatchComplete && { startedAt: new Date() }),
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

// POST /local-match/:id/inducements - Soumettre les sélections d'inducements
router.post("/:id/inducements", authUser, validate(localMatchInducementsSchema), async (req: AuthenticatedRequest, res) => {
  try {
    const localMatch = await prisma.localMatch.findUnique({
      where: { id: req.params.id },
      include: {
        teamA: { include: { players: true } },
        teamB: { include: { players: true } },
      },
    });

    if (!localMatch) {
      return res.status(404).json({ error: "Partie introuvable" });
    }

    let gameState = localMatch.gameState as unknown as ExtendedGameState;
    if (!gameState || gameState.preMatch?.phase !== "inducements") {
      return res.status(400).json({ error: "La partie n'est pas en phase d'inducements" });
    }

    const { selectionA, selectionB } = req.body as {
      selectionA?: InducementSelection;
      selectionB?: InducementSelection;
    };

    // Default to empty selections
    const finalSelectionA: InducementSelection = selectionA ?? { items: [] };
    const finalSelectionB: InducementSelection = selectionB ?? { items: [] };

    // Build inducement contexts
    const rosterA = localMatch.teamA.roster;
    const rosterB = localMatch.teamB.roster;

    const ctxA: InducementContext = {
      teamId: "A",
      regionalRules: [],
      hasApothecary: gameState.apothecaryAvailable?.teamA ?? false,
      rosterSlug: rosterA,
    };
    const ctxB: InducementContext = {
      teamId: "B",
      regionalRules: [],
      hasApothecary: gameState.apothecaryAvailable?.teamB ?? false,
      rosterSlug: rosterB,
    };

    // Calculate CTV for petty cash
    const ctvA = localMatch.teamA.players
      .filter((p: any) => !p.dead)
      .reduce((sum: number, p: any) => sum + (p.value || 0), 0);
    const ctvB = localMatch.teamB.players
      .filter((p: any) => !p.dead)
      .reduce((sum: number, p: any) => sum + (p.value || 0), 0);

    const pettyCashInput = {
      ctvTeamA: ctvA,
      ctvTeamB: ctvB,
      treasuryTeamA: (localMatch.teamA as any).treasury || 0,
      treasuryTeamB: (localMatch.teamB as any).treasury || 0,
    };

    // Process inducements
    const result = processInducementsWithSelection(
      gameState,
      pettyCashInput,
      finalSelectionA,
      finalSelectionB,
      ctxA,
      ctxB,
    );

    if (!result.validationA.valid || !result.validationB.valid) {
      const errors = [...result.validationA.errors, ...result.validationB.errors];
      return res.status(400).json({ error: errors.join("; "), errors });
    }

    gameState = result.state;

    // Continue the pre-match sequence: prayers -> kicking-team -> setup
    const rng = makeRNG(`local-match-${req.params.id}-inducements-${Date.now()}`);

    if (gameState.preMatch.phase === "prayers") {
      const ctvDiff = ctvA - ctvB;
      gameState = processPrayersToNuffle(gameState, rng, ctvDiff);
    }

    if (gameState.preMatch.phase === "kicking-team") {
      gameState = determineKickingTeam(gameState, rng);
    }

    if (gameState.preMatch.phase === "setup") {
      gameState = enterSetupPhase(gameState, gameState.preMatch.receivingTeam);
    }

    // Auto-place AI players if the match is against the AI and the AI is the
    // current coach. Prevents the AI from blocking the setup phase forever.
    if (localMatch.aiOpponent) {
      const aiSide: TeamId = (localMatch as any).aiTeamSide === 'A' ? 'A' : 'B';
      for (let iter = 0; iter < 2; iter += 1) {
        if (gameState.preMatch.phase !== 'setup') break;
        if (gameState.preMatch.currentCoach !== aiSide) break;
        const before = gameState.players.filter(p => p.team === aiSide && p.pos.x >= 0).length;
        gameState = autoSetupAITeam(gameState, aiSide);
        const after = gameState.players.filter(p => p.team === aiSide && p.pos.x >= 0).length;
        if (after < 11 || after === before) break;
        gameState = validatePlayerPlacement(gameState);
      }
      if (gameState.preMatch.phase === 'kickoff') {
        gameState = startKickoffSequence(gameState);
      }
    }

    const isPreMatchComplete =
      gameState.preMatch.phase === "setup" ||
      gameState.preMatch.phase === "kickoff" ||
      gameState.preMatch.phase === "kickoff-sequence";
    const matchStatus = isPreMatchComplete ? "in_progress" : "pending";

    const updatedMatch = await prisma.localMatch.update({
      where: { id: req.params.id },
      data: {
        status: matchStatus,
        ...(isPreMatchComplete && { startedAt: new Date() }),
        gameState: gameState as any,
      },
    });

    res.json({
      localMatch: updatedMatch,
      gameState,
      pettyCash: calculatePettyCash(pettyCashInput),
    });
  } catch (e: any) {
    console.error("Erreur lors du traitement des inducements:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// GET /local-match/:id/inducements-info - Obtenir les infos pour la phase d'inducements
router.get("/:id/inducements-info", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    const localMatch = await prisma.localMatch.findUnique({
      where: { id: req.params.id },
      include: {
        teamA: { include: { players: true } },
        teamB: { include: { players: true } },
      },
    });

    if (!localMatch) {
      return res.status(404).json({ error: "Partie introuvable" });
    }

    const gameState = localMatch.gameState as unknown as ExtendedGameState;
    if (!gameState || gameState.preMatch?.phase !== "inducements") {
      return res.status(400).json({ error: "La partie n'est pas en phase d'inducements" });
    }

    // Calculate CTV and petty cash
    const ctvA = localMatch.teamA.players
      .filter((p: any) => !p.dead)
      .reduce((sum: number, p: any) => sum + (p.value || 0), 0);
    const ctvB = localMatch.teamB.players
      .filter((p: any) => !p.dead)
      .reduce((sum: number, p: any) => sum + (p.value || 0), 0);

    const pettyCashInput = {
      ctvTeamA: ctvA,
      ctvTeamB: ctvB,
      treasuryTeamA: (localMatch.teamA as any).treasury || 0,
      treasuryTeamB: (localMatch.teamB as any).treasury || 0,
    };

    const pettyCash = calculatePettyCash(pettyCashInput);

    // Filter catalogue based on team context
    const catalogue = INDUCEMENT_CATALOGUE.filter((ind) => {
      // Star players are handled separately in the UI
      if (ind.slug === "star_player") return false;
      return true;
    });

    res.json({
      catalogue,
      pettyCash,
      teamA: {
        name: localMatch.teamA.name,
        roster: localMatch.teamA.roster,
        ctv: ctvA,
        budget: pettyCash.teamA.maxBudget,
        hasApothecary: gameState.apothecaryAvailable?.teamA ?? false,
      },
      teamB: {
        name: localMatch.teamB.name,
        roster: localMatch.teamB.roster,
        ctv: ctvB,
        budget: pettyCash.teamB.maxBudget,
        hasApothecary: gameState.apothecaryAvailable?.teamB ?? false,
      },
    });
  } catch (e: any) {
    console.error("Erreur lors de la récupération des infos d'inducements:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// PUT /local-match/:id/state - Sauvegarder l'état du jeu
router.put("/:id/state", authUser, validate(updateLocalMatchStateSchema), async (req: AuthenticatedRequest, res) => {
  try {
    const { gameState, scoreTeamA, scoreTeamB } = req.body;
    
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
router.post("/:id/complete", authUser, validate(completeLocalMatchSchema), async (req: AuthenticatedRequest, res) => {
  try {
    const { scoreTeamA, scoreTeamB } = req.body;
    
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

    // Persist SPP to TeamPlayer records if game state is available
    let sppUpdatedCount = 0;
    let deathsPersistedCount = 0;
    let injuriesPersistedCount = 0;
    if (localMatch.gameState && localMatch.teamAId && localMatch.teamBId) {
      const gameState = localMatch.gameState as any;
      try {
        if (gameState.matchStats && gameState.players) {
          sppUpdatedCount = await persistMatchSPP(
            prisma as any,
            gameState,
            localMatch.teamAId,
            localMatch.teamBId,
          );
        }
      } catch (sppError) {
        console.error("Erreur lors de la persistence des SPP:", sppError);
        // Non-blocking: match completion succeeds even if SPP persistence fails
      }

      // Persist player deaths from casualty results
      try {
        if (gameState.casualtyResults && gameState.players) {
          deathsPersistedCount = await persistPlayerDeaths(
            prisma as any,
            gameState,
            localMatch.teamAId,
            localMatch.teamBId,
          );
        }
      } catch (deathError) {
        console.error("Erreur lors de la persistence des morts:", deathError);
        // Non-blocking: match completion succeeds even if death persistence fails
      }

      // Persist permanent injuries (niggling, stat reductions, miss next match)
      try {
        if (gameState.lastingInjuryDetails && gameState.players) {
          injuriesPersistedCount = await persistPermanentInjuries(
            prisma as any,
            gameState,
            localMatch.teamAId,
            localMatch.teamBId,
          );
        }
      } catch (injuryError) {
        console.error("Erreur lors de la persistence des blessures permanentes:", injuryError);
        // Non-blocking: match completion succeeds even if injury persistence fails
      }
    }

    res.json({ localMatch: updatedMatch, sppUpdatedCount, deathsPersistedCount, injuriesPersistedCount });
  } catch (e: any) {
    console.error("Erreur lors de la finalisation de la partie offline:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// PATCH /local-match/:id/status - Changer le statut d'un match (admin uniquement)
router.patch("/:id/status", authUser, validate(updateLocalMatchStatusSchema), async (req: AuthenticatedRequest, res) => {
  try {
    const { status } = req.body;
    
    const isAdmin = hasRole(req.user!.roles, "admin");
    if (!isAdmin) {
      return res.status(403).json({ error: "Seuls les administrateurs peuvent modifier le statut d'un match" });
    }
    
    const localMatch = await prisma.localMatch.findUnique({
      where: { id: req.params.id },
    });
    
    if (!localMatch) {
      return res.status(404).json({ error: "Partie offline introuvable" });
    }
    
    // Préparer les données de mise à jour
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };
    
    // Si on remet en cours, réinitialiser completedAt
    if (status === "in_progress" && localMatch.status === "completed") {
      updateData.completedAt = null;
      // Si startedAt n'existe pas, le définir maintenant
      if (!localMatch.startedAt) {
        updateData.startedAt = new Date();
      }
    }
    
    // Si on termine le match, définir completedAt
    if (status === "completed" && localMatch.status !== "completed") {
      updateData.completedAt = new Date();
      if (!localMatch.startedAt) {
        updateData.startedAt = new Date();
      }
    }
    
    const updatedMatch = await prisma.localMatch.update({
      where: { id: req.params.id },
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
        creator: {
          select: {
            id: true,
            coachName: true,
            email: true,
          },
        },
      },
    });
    
    res.json({ localMatch: updatedMatch });
  } catch (e: any) {
    console.error("Erreur lors de la modification du statut:", e);
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
    
    const isAdmin = hasRole(req.user!.roles, "admin");
    
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
        cup: { select: { creatorId: true } },
      },
    });
    
    if (!localMatch) {
      return res.status(404).json({ error: "Partie offline introuvable" });
    }
    
    // Vérifier que l'utilisateur est le créateur, propriétaire d'une des équipes
    // ou créateur de la coupe associée
    const isCreator = localMatch.creatorId === req.user!.id;
    const isTeamOwner = 
      localMatch.teamA.ownerId === req.user!.id || 
      (localMatch.teamB && localMatch.teamB.ownerId === req.user!.id);
    const isCupCreator =
      !!localMatch.cup && localMatch.cup.creatorId === req.user!.id;
    const isAdmin = hasRole(req.user!.roles, "admin");
    
    if (!isCreator && !isTeamOwner && !isCupCreator && !isAdmin) {
      return res.status(403).json({ error: "Accès non autorisé" });
    }
    
    // Pagination : un match peut accumuler des centaines d'actions, on borne
    // les retours pour éviter une réponse trop lourde (max 1000, défaut 500).
    const { limit, offset } = parsePagination(
      req.query as Record<string, unknown>,
      { defaultLimit: 500, maxLimit: 1000 },
    );
    const where = { matchId: req.params.id };
    const [actions, total] = await Promise.all([
      prisma.localMatchAction.findMany({
        where,
        orderBy: [
          { half: "asc" },
          { turn: "asc" },
          { createdAt: "asc" },
        ],
        take: limit,
        skip: offset,
      }),
      prisma.localMatchAction.count({ where }),
    ]);

    res.json({ actions, meta: buildApiMeta({ total, limit, offset }) });
  } catch (e: any) {
    console.error("Erreur lors de la récupération des actions:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// POST /local-match/:id/actions - Créer une nouvelle action
router.post("/:id/actions", authUser, validate(createLocalMatchActionSchema), async (req: AuthenticatedRequest, res) => {
  try {
    const { half, turn, actionType, playerId, playerName, playerTeam, opponentId, opponentName, diceResult, fumble, armorBroken, opponentState, passType, playerState } = req.body;

    // Cross-field validation for blitz/blocage
    if (["blitz", "blocage"].includes(actionType)) {
      if (armorBroken === true && opponentState) {
        const validStates = ["sonne", "ko", "elimine"];
        if (!validStates.includes(opponentState)) {
          return res.status(400).json({ error: `opponentState invalide. Doit être l'un de: ${validStates.join(", ")}` });
        }
      }
    }

    // Cross-field validation for fumble + playerState
    const actionsWithoutPlayerState = ["passe", "transmission", "reception", "apothicaire", "interception"];
    if (fumble === true && !actionsWithoutPlayerState.includes(actionType) && playerState) {
      const validPlayerStates = ["sonne", "ko", "elimine"];
      if (!validPlayerStates.includes(playerState)) {
        return res.status(400).json({ error: `playerState invalide. Doit être l'un de: ${validPlayerStates.join(", ")}` });
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
    const isAdmin = hasRole(req.user!.roles, "admin");
    
    if (!isCreator && !isTeamOwner && !isAdmin) {
      return res.status(403).json({ error: "Accès non autorisé" });
    }
    
    // Déterminer si playerState doit être enregistré
    // (actionsWithoutPlayerState est déjà déclarée plus haut)
    const shouldSavePlayerState = fumble === true && !actionsWithoutPlayerState.includes(actionType) && playerState;
    
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
        playerState: shouldSavePlayerState ? playerState : null,
        armorBroken: ["blitz", "blocage"].includes(actionType) ? (armorBroken === true) : false,
        opponentState: ["blitz", "blocage"].includes(actionType) && armorBroken === true && opponentState ? opponentState : null,
        passType: actionType === "passe" && passType ? passType : null,
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
    const isAdmin = hasRole(req.user!.roles, "admin");
    
    if (!isCreator && !isTeamOwner && !isAdmin) {
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
router.post("/share/:token/validate", authUser, validate(validateShareTokenSchema), async (req: AuthenticatedRequest, res) => {
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

// ─────────────────────────────────────────────────────────────────────────────
// Practice vs AI is now served by the online flow (see POST /match/practice).
// We keep GET /local-match/ai/opponents for any remaining UI that queries the
// roster whitelist.
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  "/ai/opponents",
  requireFeatureFlag(AI_TRAINING_FLAG),
  authUser,
  async (_req: AuthenticatedRequest, res) => {
    res.json({ rosters: listAIOpponentAllowedRosters() });
  },
);


export default router;

