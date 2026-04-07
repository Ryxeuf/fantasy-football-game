import { Router } from "express";
import { prisma } from "../prisma";
import { authUser, AuthenticatedRequest } from "../middleware/authUser";
import jwt from "jsonwebtoken";
import { acceptAndMaybeStartMatch } from "../services/match-start";
import { enterSetupPhase, addJourneymen } from "@bb/game-engine";
import type { Move } from "@bb/game-engine";
import { getUserTeamSide } from "../services/turn-ownership";
import { getLinemanStats } from "../services/journeymen";
import { validate } from "../middleware/validate";
import { processMove } from "../services/move-processor";
import {
  joinMatchSchema,
  acceptMatchSchema,
  moveSchema,
} from "../schemas/match.schemas";

const router = Router();
const MATCH_SECRET = process.env.MATCH_SECRET || "dev-match-secret";
const ALLOWED_TEAMS = ["skaven", "lizardmen"] as const;

// Créer une partie, le créateur reçoit un token de match
router.post("/create", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    const seed = `match-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    // Ne pas écrire creatorId pour compatibilité (certains environnements n'ont pas encore la colonne)
    const match = await prisma.match.create({
      data: {
        status: "pending",
        seed,
        players: { connect: { id: req.user!.id } },
      },
    });
    const token = jwt.sign(
      { matchId: match.id, userId: req.user!.id },
      MATCH_SECRET,
      { expiresIn: "2h" },
    );
    return res.status(201).json({ match, matchToken: token });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: e?.message || "Erreur serveur" });
  }
});

// Rejoindre une partie existante, retourne un token de match
router.post("/join", authUser, validate(joinMatchSchema), async (req: AuthenticatedRequest, res) => {
  try {
    const { matchId } = req.body;
    const match = await prisma.match.update({
      where: { id: matchId },
      data: { players: { connect: { id: req.user!.id } } },
    });
    if (!match) return res.status(404).json({ error: "Partie introuvable" });
    const token = jwt.sign(
      { matchId: match.id, userId: req.user!.id },
      MATCH_SECRET,
      { expiresIn: "2h" },
    );
    return res.json({ match, matchToken: token });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: e?.message || "Erreur serveur" });
  }
});

// Accepter le match: chaque coach doit accepter. Au second accept, on lance la séquence de pré-match
router.post("/accept", authUser, validate(acceptMatchSchema), async (req: AuthenticatedRequest, res) => {
  try {
    const { matchId } = req.body as { matchId: string };
    const result = await acceptAndMaybeStartMatch(prisma as any, {
      matchId,
      userId: req.user!.id,
    });
    if (!result.ok && "status" in result && typeof result.status === "number")
      return res.status(result.status).json({ error: result.error });
    return res.json(result);
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: e?.message || "Erreur serveur" });
  }
});

// Soumettre un coup pendant la phase active du match
router.post(
  "/:id/move",
  authUser,
  validate(moveSchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const matchId = req.params.id;
      const { move } = req.body as { move: Move };

      const result = await processMove(matchId, req.user!.id, move);

      if (!result.success) {
        const statusMap: Record<string, number> = {
          NOT_FOUND: 404,
          INVALID_STATUS: 400,
          NOT_PLAYER: 403,
          NO_STATE: 500,
          NOT_YOUR_TURN: 403,
          ENGINE_ERROR: 400,
        };
        return res.status(statusMap[result.code] ?? 500).json({ error: result.error });
      }

      return res.json(result);
    } catch (e: any) {
      console.error("Erreur lors de l'application du coup:", e);
      return res.status(500).json({ error: e?.message || "Erreur serveur" });
    }
  },
);

export default router;

// Détails du match: noms des équipes et coachs (via token de match)
router.get("/details", async (req, res) => {
  try {
    const token = (req.headers["x-match-token"] as string) || "";
    if (!token) return res.status(401).json({ error: "x-match-token requis" });
    let payload: any;
    try {
      payload = jwt.verify(token, MATCH_SECRET) as any;
    } catch {
      return res.status(401).json({ error: "x-match-token invalide" });
    }
    const matchId = payload?.matchId as string | undefined;
    if (!matchId)
      return res.status(400).json({ error: "matchId manquant dans le token" });

    const [match, selections] = await Promise.all([
      prisma.match.findUnique({
        where: { id: matchId },
        select: { id: true, creatorId: true },
      }),
      prisma.teamSelection.findMany({
        where: { matchId },
        orderBy: { createdAt: "asc" },
        include: {
          user: { select: { id: true, name: true, email: true } },
          teamRef: { select: { name: true, roster: true } },
        },
      }),
    ]);

    // Déterminer local/visiteur: par défaut l'utilisateur du token est "local"
    const tokenUserId = (payload as any)?.userId as string | undefined;
    let local = selections.find((s: any) => s.userId === tokenUserId) || null;
    let visitor = selections.find((s: any) => s.userId !== tokenUserId) || null;
    if (!local || !visitor) {
      // Fallback si une des équipes manque
      if (match?.creatorId) {
        local =
          selections.find((s: any) => s.userId === match.creatorId) || selections[0];
        visitor =
          selections.find((s: any) => s.userId !== match.creatorId) ||
          selections[1] ||
          null;
      } else {
        // Pas de creatorId: ordonner simplement
        local = selections[0] || null;
        visitor = selections.length > 1 ? selections[1] : null;
      }
    }

    function teamName(sel: any): string {
      if (!sel) return "";
      return sel.teamRef?.name || sel.teamRef?.roster || sel.team || "";
    }
    function coachName(sel: any): string {
      if (!sel) return "";
      return sel.user?.name || sel.user?.email || "";
    }

    return res.json({
      matchId,
      local: {
        teamName: teamName(local),
        coachName: coachName(local),
        userId: local?.userId || null,
      },
      visitor: {
        teamName: teamName(visitor),
        coachName: coachName(visitor),
        userId: visitor?.userId || null,
      },
    });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// Détails du match (auth) par id
router.get("/:id/details", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    const matchId = req.params.id;
    const [match, selections] = await Promise.all([
      prisma.match.findUnique({
        where: { id: matchId },
        select: { id: true, creatorId: true },
      }),
      prisma.teamSelection.findMany({
        where: { matchId },
        orderBy: { createdAt: "asc" },
        include: {
          user: { select: { id: true, name: true, email: true } },
          teamRef: { select: { name: true, roster: true } },
        },
      }),
    ]);
    if (!match) return res.status(404).json({ error: "Partie introuvable" });
    // Déterminer local/visiteur: l'utilisateur authentifié est local
    const authenticatedUserId = req.user!.id;
    let local =
      selections.find((s: any) => s.userId === authenticatedUserId) || null;
    let visitor =
      selections.find((s: any) => s.userId !== authenticatedUserId) || null;
    if (!local || !visitor) {
      // Fallback: creatorId si présent, sinon ordre de sélection
      if (match.creatorId) {
        local =
          selections.find((s: any) => s.userId === match.creatorId) ||
          selections[0] ||
          null;
        visitor =
          selections.find((s: any) => s.userId !== match.creatorId) ||
          selections[1] ||
          null;
      } else {
        local = selections[0] || null;
        visitor = selections.length > 1 ? selections[1] : null;
      }
    }
    const teamName = (sel: any) =>
      sel?.teamRef?.name || sel?.teamRef?.roster || sel?.team || "";
    const coachName = (sel: any) => sel?.user?.name || sel?.user?.email || "";
    return res.json({
      matchId,
      local: { teamName: teamName(local), coachName: coachName(local) },
      visitor: { teamName: teamName(visitor), coachName: coachName(visitor) },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// Nouvel endpoint pour les équipes et joueurs (auth) par id - pour fallback prematch
// IMPORTANT: retourne une vue absolue A/B, indépendante de l'utilisateur connecté
router.get("/:id/teams", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    const matchId = req.params.id;
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: { id: true },
    });
    if (!match) return res.status(404).json({ error: "Partie introuvable" });

    const selections = await prisma.teamSelection.findMany({
      where: { matchId },
      orderBy: { createdAt: "asc" },
      include: { teamRef: { include: { players: true } } },
    });

    const s1 = selections[0] || null;
    const s2 = selections[1] || null;

    const getTeamData = (sel: any) => {
      const teamName = sel?.teamRef?.name || sel?.team || "Équipe Inconnue";
      const players = (sel?.teamRef?.players || []).map((p: any) => ({
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
      return { teamName, players };
    };

    const teamA = getTeamData(s1);
    const teamB = getTeamData(s2);

    return res.json({ teamA, teamB });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// Liste des matchs de l'utilisateur connecté
router.get("/my-matches", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;

    const matches = await prisma.match.findMany({
      where: {
        players: { some: { id: userId } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        teamSelections: {
          include: {
            user: { select: { id: true, coachName: true } },
            teamRef: { select: { id: true, name: true, roster: true } },
          },
        },
        turns: {
          orderBy: { number: "desc" },
          take: 1,
          select: { payload: true },
        },
      },
    });

    const result = matches.map((m: any) => {
      // Extraire le score depuis le dernier turn si disponible
      const lastTurn = m.turns[0];
      const gameState = (lastTurn?.payload as any)?.gameState;
      const score = gameState?.score || { teamA: 0, teamB: 0 };
      const half = gameState?.half || 0;
      const turn = gameState?.turn || 0;

      // Déterminer le côté de l'utilisateur
      const selections = m.teamSelections.sort(
        (a: any, b: any) => a.createdAt.getTime() - b.createdAt.getTime(),
      );
      const mySelection = selections.find((s: any) => s.userId === userId);
      const opponentSelection = selections.find((s: any) => s.userId !== userId);
      const isMyTurn = m.currentTurnUserId === userId;

      // Align score with user's side: first selection = teamA, second = teamB
      const isTeamA = mySelection === selections[0];
      const myScore = isTeamA ? score.teamA : score.teamB;
      const opponentScore = isTeamA ? score.teamB : score.teamA;

      return {
        id: m.id,
        status: m.status,
        createdAt: m.createdAt,
        lastMoveAt: m.lastMoveAt,
        isMyTurn,
        score,
        myScore,
        opponentScore,
        half,
        turn,
        myTeam: mySelection
          ? {
              coachName: mySelection.user.coachName,
              teamName: mySelection.teamRef?.name || mySelection.team,
              rosterName: mySelection.teamRef?.roster,
            }
          : null,
        opponent: opponentSelection
          ? {
              coachName: opponentSelection.user.coachName,
              teamName: opponentSelection.teamRef?.name || opponentSelection.team,
              rosterName: opponentSelection.teamRef?.roster,
            }
          : null,
      };
    });

    return res.json({ matches: result });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// Résumé d'un match: équipes, coachs, score (approx), tour/mi-temps
router.get("/:id/summary", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    const matchId = req.params.id;
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        status: true,
        seed: true,
        creatorId: true,
        createdAt: true,
      },
    });
    if (!match) return res.status(404).json({ error: "Partie introuvable" });

    const [selections, acceptTurns] = await Promise.all([
      prisma.teamSelection.findMany({
        where: { matchId },
        include: {
          user: { select: { id: true, name: true, email: true } },
          teamRef: { select: { id: true, name: true, roster: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.turn.findMany({ where: { matchId } }),
    ]);
    let local = selections.find((s: any) => s.userId === match.creatorId) || null;
    let visitor = selections.find((s: any) => s.userId !== match.creatorId) || null;
    if (!local || !visitor) {
      if (match.creatorId) {
        local =
          selections.find((s: any) => s.userId === match.creatorId) ||
          selections[0] ||
          null;
        visitor =
          selections.find((s: any) => s.userId !== match.creatorId) ||
          selections[1] ||
          null;
      } else {
        local = selections[0] || null;
        visitor = selections.length > 1 ? selections[1] : null;
      }
    }

    const turnsCount = await prisma.turn.count({ where: { matchId } });
    const half = turnsCount < 16 ? 1 : 2; // approximation
    const turn = (turnsCount % 16) + 1; // approximation

    const pickName = (sel: any) =>
      sel?.teamRef?.name || sel?.teamRef?.roster || sel?.team || "";
    const pickCoach = (sel: any) => sel?.user?.name || sel?.user?.email || "";
    const acceptedUserIds = Array.from(
      new Set(
        (acceptTurns || [])
          .map((t: any) =>
            (t as any)?.payload?.type === "accept"
              ? (t as any)?.payload?.userId
              : null,
          )
          .filter(Boolean),
      ),
    );
    const localAccepted = !!(local && acceptedUserIds.includes(local.userId));
    const visitorAccepted = !!(
      visitor && acceptedUserIds.includes(visitor.userId)
    );

    return res.json({
      id: match.id,
      status: match.status,
      createdAt: match.createdAt,
      teams: {
        local: { name: pickName(local), coach: pickCoach(local) },
        visitor: { name: pickName(visitor), coach: pickCoach(visitor) },
      },
      score: { teamA: 0, teamB: 0 }, // TODO: remplacer par score réel quand disponible
      half,
      turn,
      acceptances: { local: localAccepted, visitor: visitorAccepted },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// Nouvel endpoint pour l'état du jeu
router.get("/:id/state", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    const matchId = req.params.id;
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { turns: { orderBy: { number: "asc" } } },
    });
    if (!match) return res.status(404).json({ error: "Partie introuvable" });

    if (match.status === "pending")
      return res.status(400).json({ error: "Partie pas encore prête" });

    let gameState: any;

    // Pour prematch-setup, chercher d'abord le dernier turn validate-setup (contient l'état le plus récent)
    // puis fallback sur le turn start
    const startTurn = match.turns.find((t: any) => t.payload?.type === "start" || t.payload?.type === "coin-toss");
    if (match.status === "prematch-setup") {
      const lastValidateSetupTurn = [...match.turns]
        .reverse()
        .find((t: any) => t.payload?.type === "validate-setup" && t.payload?.gameState);
      const sourceTurn = lastValidateSetupTurn || startTurn;
      if (sourceTurn) {
        const gs = sourceTurn.payload.gameState;
        gameState = typeof gs === "string" ? JSON.parse(gs) : gs;
      }
    } else if (startTurn) {
      const gs = startTurn.payload.gameState;
      gameState = typeof gs === "string" ? JSON.parse(gs) : gs;
    } else if (match.status === "prematch") {
      // Reconstruire si pas encore de turn start (cas edge)
      const selections = await prisma.teamSelection.findMany({
        where: { matchId },
        include: {
          user: true,
          teamRef: true,
        },
        orderBy: { createdAt: "asc" },
      });
      if (selections.length < 2)
        return res.status(400).json({ error: "Équipes pas prêtes" });

      const [s1, s2] = selections;

      // Fetch teams séparément pour players
      const teamA = s1.teamId
        ? await prisma.team.findUnique({
            where: { id: s1.teamId },
            include: { players: true },
          })
        : null;
      const teamB = s2.teamId
        ? await prisma.team.findUnique({
            where: { id: s2.teamId },
            include: { players: true },
          })
        : null;

      if (!teamA || !teamB) {
        console.log("Teams not found:", s1.teamId, s2.teamId);
        return res.status(400).json({ error: "Équipes non trouvées" });
      }

      const teamAData = teamA.players
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
      const teamBData = teamB.players
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

      console.log(
        "Players loaded for prematch:",
        teamAData.length,
        teamBData.length,
      ); // Trace

      const teamAName = s1.teamRef?.name || s1.team || "Team A";
      const teamBName = s2.teamRef?.name || s2.team || "Team B";

      const { setupPreMatchWithTeams } = await import("@bb/game-engine");
      gameState = setupPreMatchWithTeams(
        teamAData,
        teamBData,
        teamAName,
        teamBName,
      );
    } else {
      // Pour active, dernier turn
      const lastTurn = match.turns[match.turns.length - 1];
      if (!lastTurn.payload?.gameState)
        return res.status(500).json({ error: "État non trouvé" });
      const gs = lastTurn.payload.gameState;
      gameState = typeof gs === "string" ? JSON.parse(gs) : gs;
    }

    // Pour les matchs actifs, enrichir la réponse avec des métadonnées
    if (match.status === "active" && gameState) {
      const userTeamSide = await getUserTeamSide(prisma as any, matchId, req.user!.id);
      const isMyTurn = userTeamSide ? gameState.currentPlayer === userTeamSide : false;
      const moveCount = match.turns.filter(
        (t: any) => t.payload?.type === "gameplay-move",
      ).length;
      const lastMoveTurn = [...match.turns]
        .reverse()
        .find((t: any) => t.payload?.type === "gameplay-move");

      return res.json({
        gameState,
        matchStatus: match.status,
        currentTeam: gameState.currentPlayer,
        isMyTurn,
        myTeamSide: userTeamSide,
        moveCount,
        lastMoveAt: lastMoveTurn?.createdAt || null,
      });
    }

    // Dans /state, après chargement gameState pour prematch-setup
    if (match.status === "prematch-setup") {
      // Entrer en setup si idle
      const lastCoinToss = match.turns.find(
        (t: any) => t.payload?.type === "coin-toss",
      );
      if (lastCoinToss && gameState.preMatch.phase === "idle") {
        // IMPORTANT: déterminer l'équipe receveuse selon le mapping A/B défini par l'ordre des sélections,
        // pas selon l'utilisateur qui appelle la route (sinon chaque client verrait une équipe différente).
        const selections = await prisma.teamSelection.findMany({
          where: { matchId },
          orderBy: { createdAt: "asc" },
          include: { teamRef: { select: { roster: true } } },
        });
        const s1 = selections[0];
        const s2 = selections[1];
        let receivingTeam: "A" | "B" = "A";
        if (s1 && s2) {
          receivingTeam =
            lastCoinToss.payload.receivingUserId === s1.userId ? "A" : "B";
        }

        // D.8 — Add journeymen if teams have < 11 alive players
        const rosterA = (s1 as any)?.teamRef?.roster;
        const rosterB = (s2 as any)?.teamRef?.roster;
        if (rosterA && rosterB) {
          const [linemanStatsA, linemanStatsB] = await Promise.all([
            getLinemanStats(prisma as any, rosterA),
            getLinemanStats(prisma as any, rosterB),
          ]);
          // Temporarily set phase to 'journeymen' for addJourneymen to work
          gameState = {
            ...gameState,
            preMatch: { ...gameState.preMatch, phase: 'journeymen' },
          };
          gameState = addJourneymen(gameState, 11, 11, linemanStatsA, linemanStatsB);
          // Reset phase to 'idle' so enterSetupPhase can proceed
          gameState = {
            ...gameState,
            preMatch: { ...gameState.preMatch, phase: 'idle' },
          };
        }

        gameState = enterSetupPhase(gameState, receivingTeam);
      }

      const userTeamSide = await getUserTeamSide(prisma as any, matchId, req.user!.id);
      return res.json({
        gameState,
        matchStatus: match.status,
        myTeamSide: userTeamSide,
        isMyTurn: userTeamSide ? gameState.preMatch?.currentCoach === userTeamSide : false,
      });
    }

    res.json({ gameState });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Valider le placement des joueurs en phase setup
router.post(
  "/:id/validate-setup",
  authUser,
  async (req: AuthenticatedRequest, res) => {
    try {
      const matchId = req.params.id;
      const { placedPlayers, playerPositions } = req.body;

      if (!placedPlayers || !playerPositions) {
        return res
          .status(400)
          .json({ error: "placedPlayers et playerPositions requis" });
      }

      // Vérifier que le match existe et est en phase setup
      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: { turns: { orderBy: { number: "asc" } } },
      });

      if (!match) {
        return res.status(404).json({ error: "Partie introuvable" });
      }

      if (match.status !== "prematch-setup") {
        return res
          .status(400)
          .json({ error: "La partie n'est pas en phase de setup" });
      }

      // Vérifier que l'utilisateur est bien un des joueurs de la partie
      const selections = await prisma.teamSelection.findMany({
        where: { matchId },
        select: { userId: true },
      });

      const userIds = selections.map((s: any) => s.userId);
      if (!userIds.includes(req.user!.id)) {
        return res
          .status(403)
          .json({ error: "Vous n'êtes pas un joueur de cette partie" });
      }

      // Créer un nouveau turn pour sauvegarder le placement
      const newTurn = await prisma.turn.create({
        data: {
          matchId,
          number: match.turns.length + 1,
          payload: {
            type: "validate-setup",
            userId: req.user!.id,
            placedPlayers,
            playerPositions,
            timestamp: new Date().toISOString(),
          },
        },
      });

      // Charger l'état du jeu le plus récent (validate-setup > coin-toss)
      const lastValidateSetup = [...match.turns]
        .reverse()
        .find((t: any) => t.payload?.type === "validate-setup" && t.payload?.gameState);
      const coinTossTurn = match.turns.find((t: any) => t.payload?.type === "coin-toss");
      const sourceTurn = lastValidateSetup || coinTossTurn;
      let gameState = sourceTurn?.payload?.gameState;
      if (typeof gameState === "string") {
        gameState = JSON.parse(gameState);
      }

      // Mettre à jour les positions des joueurs dans l'état du jeu
      if (gameState && gameState.players) {
        gameState.players.forEach((player: any) => {
          const newPosition = playerPositions.find(
            (pos: any) => pos.playerId === player.id,
          );
          if (newPosition) {
            player.pos = { x: newPosition.x, y: newPosition.y };
          }
        });
      }

      // S'assurer que l'état est en phase setup (transition idle→setup si nécessaire)
      if (gameState.preMatch?.phase === 'idle') {
        // Déterminer l'équipe receveuse depuis le coin-toss
        const coinToss = match.turns.find((t: any) => t.payload?.type === "coin-toss");
        const selections = await prisma.teamSelection.findMany({
          where: { matchId },
          orderBy: { createdAt: "asc" },
        });
        let receivingTeam: "A" | "B" = "A";
        if (coinToss && selections.length >= 2) {
          receivingTeam = coinToss.payload.receivingUserId === selections[0].userId ? "A" : "B";
        }
        gameState = enterSetupPhase(gameState, receivingTeam);
      }

      // Vérifier que l'utilisateur est bien le coach actuel
      const userTeamSide = await getUserTeamSide(prisma as any, matchId, req.user!.id);
      const currentCoach = gameState.preMatch?.currentCoach;
      if (userTeamSide !== currentCoach) {
        return res.status(403).json({ error: "Ce n'est pas votre tour de placer" });
      }

      const playersOnField = gameState.players?.filter(
        (p: any) => p.team === currentCoach && p.pos.x >= 0
      ).length || 0;

      // Si 11 joueurs sont placés, utiliser la fonction de validation explicite
      if (playersOnField === 11) {
        const { validatePlayerPlacement, startKickoffSequence } = await import("@bb/game-engine");

        // Valider le placement et passer à la phase suivante
        gameState = validatePlayerPlacement(gameState);

        // Si on arrive en phase kickoff, commencer la séquence
        if (gameState.preMatch.phase === 'kickoff') {
          gameState = startKickoffSequence(gameState);
        }
      }

      // Sauvegarder l'état mis à jour dans le nouveau turn
      await prisma.turn.update({
        where: { id: newTurn.id },
        data: {
          payload: {
            ...newTurn.payload,
            gameState,
          },
        },
      });

      // Notifier l'adversaire via WebSocket
      try {
        const { broadcastGameState } = await import("../services/game-broadcast");
        broadcastGameState(matchId, gameState, { type: "validate-setup" }, req.user!.id);
      } catch {}

      // Déterminer le message approprié
      let message = "Placement validé et sauvegardé";
      if (playersOnField === 11) {
        if (gameState.preMatch?.phase === 'kickoff' || gameState.preMatch?.phase === 'kickoff-sequence') {
          message = "Placement validé - Le match commence !";
        } else {
          message = "Placement validé - Passage au coach suivant";
        }
      }

      return res.json({
        success: true,
        gameState,
        message,
        isMyTurn: gameState.preMatch?.currentCoach === userTeamSide,
        myTeamSide: userTeamSide,
      });
    } catch (e: any) {
      console.error("Erreur lors de la validation du setup:", e);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  },
);

// Placer le ballon pour le kickoff
router.post(
  "/:id/place-kickoff-ball",
  authUser,
  async (req: AuthenticatedRequest, res) => {
    try {
      const matchId = req.params.id;
      const { position } = req.body;

      if (!position || typeof position.x !== "number" || typeof position.y !== "number") {
        return res.status(400).json({ error: "Position requise" });
      }

      // Vérifier que le match existe et est en phase kickoff-sequence
      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: { turns: { orderBy: { number: "asc" } } },
      });

      if (!match) {
        return res.status(404).json({ error: "Partie introuvable" });
      }

      if (match.status !== "prematch-setup") {
        return res.status(400).json({ error: "La partie n'est pas en phase de kickoff" });
      }

      // Récupérer l'état du jeu
      const lastTurn = match.turns[match.turns.length - 1];
      let gameState = lastTurn?.payload?.gameState;
      if (typeof gameState === "string") {
        gameState = JSON.parse(gameState);
      }

      if (gameState.preMatch?.phase !== "kickoff-sequence") {
        return res.status(400).json({ error: "Pas en phase de séquence de kickoff" });
      }

      // Placer le ballon
      const { placeKickoffBall } = await import("@bb/game-engine");
      const newState = placeKickoffBall(gameState, position);

      // Sauvegarder le nouvel état
      const newTurn = await prisma.turn.create({
        data: {
          matchId,
          number: match.turns.length + 1,
          payload: {
            type: "place-kickoff-ball",
            userId: req.user!.id,
            position,
            gameState: newState,
            timestamp: new Date().toISOString(),
          },
        },
      });

      return res.json({
        success: true,
        gameState: newState,
        message: "Ballon placé pour le kickoff",
      });
    } catch (e: any) {
      console.error("Erreur lors du placement du ballon:", e);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  }
);

// Calculer la déviation du kickoff
router.post(
  "/:id/calculate-kick-deviation",
  authUser,
  async (req: AuthenticatedRequest, res) => {
    try {
      const matchId = req.params.id;

      // Vérifier que le match existe
      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: { turns: { orderBy: { number: "asc" } } },
      });

      if (!match) {
        return res.status(404).json({ error: "Partie introuvable" });
      }

      // Récupérer l'état du jeu
      const lastTurn = match.turns[match.turns.length - 1];
      let gameState = lastTurn?.payload?.gameState;
      if (typeof gameState === "string") {
        gameState = JSON.parse(gameState);
      }

      if (gameState.preMatch?.phase !== "kickoff-sequence" || gameState.preMatch?.kickoffStep !== "kick-deviation") {
        return res.status(400).json({ error: "Pas en phase de calcul de déviation" });
      }

      // Calculer la déviation avec un RNG déterministe
      const { calculateKickDeviation } = await import("@bb/game-engine");
      const deviationRng = makeRNG(`${match.seed}-kick-deviation`);
      const newState = calculateKickDeviation(gameState, deviationRng);

      // Sauvegarder le nouvel état
      const newTurn = await prisma.turn.create({
        data: {
          matchId,
          number: match.turns.length + 1,
          payload: {
            type: "calculate-kick-deviation",
            userId: req.user!.id,
            deviation: newState.preMatch.kickDeviation,
            gameState: newState,
            timestamp: new Date().toISOString(),
          },
        },
      });

      return res.json({
        success: true,
        gameState: newState,
        message: "Déviation du kickoff calculée",
      });
    } catch (e: any) {
      console.error("Erreur lors du calcul de déviation:", e);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  }
);

// Résoudre l'événement de kickoff
router.post(
  "/:id/resolve-kickoff-event",
  authUser,
  async (req: AuthenticatedRequest, res) => {
    try {
      const matchId = req.params.id;

      // Vérifier que le match existe
      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: { turns: { orderBy: { number: "asc" } } },
      });

      if (!match) {
        return res.status(404).json({ error: "Partie introuvable" });
      }

      // Récupérer l'état du jeu
      const lastTurn = match.turns[match.turns.length - 1];
      let gameState = lastTurn?.payload?.gameState;
      if (typeof gameState === "string") {
        gameState = JSON.parse(gameState);
      }

      if (gameState.preMatch?.phase !== "kickoff-sequence" || gameState.preMatch?.kickoffStep !== "kickoff-event") {
        return res.status(400).json({ error: "Pas en phase d'événement de kickoff" });
      }

      // Résoudre l'événement avec un RNG déterministe
      const { resolveKickoffEvent, startMatchFromKickoff } = await import("@bb/game-engine");
      const kickoffRng = makeRNG(`${match.seed}-kickoff-event`);
      let newState = resolveKickoffEvent(gameState, kickoffRng);

      // Démarrer le match après résolution de l'événement
      const matchState = startMatchFromKickoff(newState);

      // Déterminer qui joue en premier (l'équipe receveuse = currentPlayer)
      const selections = await prisma.teamSelection.findMany({
        where: { matchId },
        orderBy: { createdAt: "asc" },
        select: { userId: true },
      });
      const firstPlayerUserId = matchState.currentPlayer === "A"
        ? selections[0]?.userId
        : selections[1]?.userId;

      // Passer le match en statut "active" pour autoriser les coups
      await prisma.match.update({
        where: { id: matchId },
        data: {
          status: "active",
          currentTurnUserId: firstPlayerUserId || null,
          lastMoveAt: new Date(),
        },
      });

      // Sauvegarder le nouvel état
      const newTurn = await prisma.turn.create({
        data: {
          matchId,
          number: match.turns.length + 1,
          payload: {
            type: "resolve-kickoff-event",
            userId: req.user!.id,
            kickoffEvent: gameState.preMatch.kickoffEvent,
            gameState: matchState,
            timestamp: new Date().toISOString(),
          },
        },
      });

      return res.json({
        success: true,
        gameState: matchState,
        message: "Événement de kickoff résolu - Le match commence !",
      });
    } catch (e: any) {
      console.error("Erreur lors de la résolution de l'événement:", e);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  }
);

// Historique des turns d'un match
router.get("/:id/turns", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    const matchId = req.params.id;
    const userId = req.user!.id;

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: { id: true, status: true, players: { select: { id: true } } },
    });

    if (!match) {
      return res.status(404).json({ error: "Partie introuvable" });
    }

    // Vérifier que l'utilisateur est un joueur du match
    const isPlayer = match.players.some((p: { id: string }) => p.id === userId);
    if (!isPlayer) {
      return res.status(403).json({ error: "Vous n'etes pas un joueur de cette partie" });
    }

    const turns = await prisma.turn.findMany({
      where: { matchId },
      orderBy: { number: "asc" },
      select: {
        id: true,
        number: true,
        createdAt: true,
        payload: true,
      },
    });

    // Retourner un résumé léger de chaque turn (sans le gameState complet)
    const turnSummaries = turns.map((t: any) => {
      const payload = t.payload || {};
      const rawGs = payload.gameState;
      const gs = typeof rawGs === "string" ? JSON.parse(rawGs) : rawGs;
      return {
        id: t.id,
        number: t.number,
        createdAt: t.createdAt,
        type: payload.type || "unknown",
        userId: payload.userId || null,
        half: gs?.half || null,
        turn: gs?.turn || null,
        score: gs?.score || null,
        moveType: payload.move?.type || null,
      };
    });

    return res.json({ matchId, turns: turnSummaries });
  } catch (e: any) {
    console.error("Erreur lors de la récupération des turns:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});
