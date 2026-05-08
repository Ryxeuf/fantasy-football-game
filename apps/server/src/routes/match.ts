import { Router } from "express";
import type { Response } from "express";
import { prisma } from "../prisma";
import { authUser, AuthenticatedRequest } from "../middleware/authUser";
import jwt from "jsonwebtoken";
import { acceptAndMaybeStartMatch } from "../services/match-start";
import { cancelMatch } from "../services/match-cancel";
import type { Move } from "@bb/game-engine";
import { getUserTeamSide } from "../services/turn-ownership";
import { ensureSetupPhasePersisted } from "../services/prematch-setup";
import { validate } from "../middleware/validate";
import { processMove } from "../services/move-processor";
import {
  joinMatchSchema,
  acceptMatchSchema,
  moveSchema,
  createMatchSchema,
  validateSetupSchema,
  placeKickoffBallSchema,
  createPracticeOnlineMatchSchema,
} from "../schemas/match.schemas";
import { createOnlinePracticeMatch } from "../services/practice-match";
import { scheduleAILoop } from "../services/ai-loop";
import { runAISetupIfNeeded } from "../services/ai-setup";
import { runAIKickoffIfNeeded } from "../services/ai-kickoff";
import type { AIDifficulty } from "@bb/game-engine";
import { getSpectatorCount } from "../game-spectator";
import { MATCH_SECRET } from "../config";
import { serverLog } from "../utils/server-log";
import { sendError, sendSuccess } from "../utils/api-response";

const router = Router();
const ALLOWED_TEAMS = ["skaven", "lizardmen"] as const;

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Erreur serveur";
}

// S27.8.20 — Handlers de cycle de vie (create / join / accept / cancel)
// extraits dans `routes/match-lifecycle-handlers.ts`. Re-export pour
// preserver l'API publique consommee par les tests d'integration.
export {
  handleCreateMatch,
  handleJoinMatch,
  handleAcceptMatch,
  handleCancelMatch,
} from './match-lifecycle-handlers';
import {
  handleCreateMatch as handleCreateMatchImpl,
  handleJoinMatch as handleJoinMatchImpl,
  handleAcceptMatch as handleAcceptMatchImpl,
  handleCancelMatch as handleCancelMatchImpl,
} from './match-lifecycle-handlers';

router.post("/create", authUser, validate(createMatchSchema), handleCreateMatchImpl);
router.post("/join", authUser, validate(joinMatchSchema), handleJoinMatchImpl);
router.post("/accept", authUser, validate(acceptMatchSchema), handleAcceptMatchImpl);
router.post("/:id/cancel", authUser, handleCancelMatchImpl);

// S27.8.21 — Handlers d'action (`handlePracticeMatch`, `handleSubmitMove`)
// extraits dans `routes/match-action-handlers.ts`. Re-export pour
// preserver l'API publique consommee par les tests d'integration.
export {
  handlePracticeMatch,
  handleSubmitMove,
} from './match-action-handlers';
import {
  handlePracticeMatch as handlePracticeMatchImpl,
  handleSubmitMove as handleSubmitMoveImpl,
} from './match-action-handlers';

router.post(
  "/practice",
  authUser,
  validate(createPracticeOnlineMatchSchema),
  handlePracticeMatchImpl,
);
router.post("/:id/move", authUser, validate(moveSchema), handleSubmitMoveImpl);

export default router;

// S27.8.19 — Handlers de details (5 endpoints lecture seule de
// metadonnees) extraits dans `routes/match-details-handlers.ts`.
// Re-export pour preserver l'API publique consommee par les tests
// d'integration.
export {
  handleGetMatchDetailsByToken,
  handleGetMatchDetails,
  handleGetMatchTeams,
  handleListMyMatches,
  handleGetMatchSummary,
} from './match-details-handlers';
import {
  handleGetMatchDetailsByToken as handleGetMatchDetailsByTokenImpl,
  handleGetMatchDetails as handleGetMatchDetailsImpl,
  handleGetMatchTeams as handleGetMatchTeamsImpl,
  handleListMyMatches as handleListMyMatchesImpl,
  handleGetMatchSummary as handleGetMatchSummaryImpl,
} from './match-details-handlers';

router.get("/details", handleGetMatchDetailsByTokenImpl);
router.get("/:id/details", authUser, handleGetMatchDetailsImpl);
router.get("/:id/teams", authUser, handleGetMatchTeamsImpl);
router.get("/my-matches", authUser, handleListMyMatchesImpl);
router.get("/:id/summary", authUser, handleGetMatchSummaryImpl);

// S27.8.18 — `handleGetMatchState` extrait dans
// `routes/match-state-handler.ts`. Re-export pour preserver l'API
// publique consommee par les tests d'integration.
export { handleGetMatchState } from './match-state-handler';
import { handleGetMatchState as handleGetMatchStateImpl } from './match-state-handler';

router.get("/:id/state", authUser, handleGetMatchStateImpl);

// Valider le placement des joueurs en phase setup
router.post(
  "/:id/validate-setup",
  authUser,
  validate(validateSetupSchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const matchId = req.params.id;
      const { placedPlayers, playerPositions } = req.body;

      // Vérifier que le match existe et est en phase setup
      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: { turns: { orderBy: { number: "asc" } } },
      });

      if (!match) {
        return res.status(404).json({ error: "Partie introuvable" });
      }

      if (match.status !== "prematch-setup" && match.status !== "active") {
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

      // Idempotently persist the idle → setup transition before doing anything
      // else. The returned `gameState` is the canonical post-bypass state
      // (preferring `setup-init`/`validate-setup` over a stale
      // `pre-match-sequence` written by the parallel automation).
      const ensured = await ensureSetupPhasePersisted(matchId, prisma as any);

      // Re-read turns after the potential setup-init insert.
      const refreshedTurns = await prisma.turn.findMany({
        where: { matchId },
        orderBy: { number: "asc" },
      });

      // Créer un nouveau turn pour sauvegarder le placement
      const newTurn = await prisma.turn.create({
        data: {
          matchId,
          number: refreshedTurns.length + 1,
          payload: {
            type: "validate-setup",
            userId: req.user!.id,
            placedPlayers,
            playerPositions,
            timestamp: new Date().toISOString(),
          },
        },
      });

      // Build the working gameState. Prefer the most recent `validate-setup`
      // (carries player placements), then fall back to the canonical state
      // returned by `ensureSetupPhasePersisted` (skips a stale
      // `pre-match-sequence` written by the parallel automation).
      const lastValidateSetupTurn = [...refreshedTurns]
        .reverse()
        .find(
          (t: any) =>
            t.payload?.type === "validate-setup" && t.payload?.gameState,
        );
      let gameState: any = lastValidateSetupTurn
        ? lastValidateSetupTurn.payload.gameState
        : ensured?.gameState;
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

      // Si apres validation l'IA doit placer ses joueurs, on le fait cote serveur.
      // Sans ceci, le match reste bloque en phase setup pour les matchs pratique online.
      const aiMatchForSetup = await prisma.match.findUnique({
        where: { id: matchId },
        select: { aiOpponent: true, aiTeamSide: true },
      });
      if (
        aiMatchForSetup?.aiOpponent &&
        aiMatchForSetup.aiTeamSide &&
        gameState.preMatch?.phase === "setup" &&
        gameState.preMatch?.currentCoach === aiMatchForSetup.aiTeamSide
      ) {
        const report = await runAISetupIfNeeded(matchId, prisma as any);
        if (report.ran && report.gameState) {
          gameState = report.gameState;
        }
      }

      // Mettre à jour le statut du match si kickoff atteint
      if (gameState.preMatch?.phase === 'kickoff' || gameState.preMatch?.phase === 'kickoff-sequence') {
        await prisma.match.update({
          where: { id: matchId },
          data: { status: "active" },
        });
        // If the active player is the AI, kick off the loop.
        const postMatch = await prisma.match.findUnique({
          where: { id: matchId },
          select: { aiOpponent: true, aiTeamSide: true },
        });
        if (
          postMatch?.aiOpponent &&
          postMatch.aiTeamSide &&
          gameState.currentPlayer === postMatch.aiTeamSide
        ) {
          scheduleAILoop(matchId);
        }
        // Si l'IA est l'equipe qui frappe, placer immediatement le ballon pour
        // eviter que le match reste bloque sur l'etape `place-ball` du kickoff.
        if (
          postMatch?.aiOpponent &&
          postMatch.aiTeamSide &&
          gameState.preMatch?.phase === 'kickoff-sequence' &&
          gameState.preMatch?.kickoffStep === 'place-ball' &&
          gameState.preMatch?.kickingTeam === postMatch.aiTeamSide
        ) {
          const kickoffReport = await runAIKickoffIfNeeded(matchId, prisma as any);
          if (kickoffReport.ran && kickoffReport.gameState) {
            gameState = kickoffReport.gameState;
          }
        }
      }

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
      serverLog.error("Erreur lors de la validation du setup:", e);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  },
);

// Placer le ballon pour le kickoff
router.post(
  "/:id/place-kickoff-ball",
  authUser,
  validate(placeKickoffBallSchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const matchId = req.params.id;
      const { position } = req.body;

      // Vérifier que le match existe et est en phase kickoff-sequence
      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: { turns: { orderBy: { number: "asc" } } },
      });

      if (!match) {
        return res.status(404).json({ error: "Partie introuvable" });
      }

      if (match.status !== "prematch-setup" && match.status !== "active") {
        return res.status(400).json({ error: "La partie n'est pas en phase de kickoff" });
      }

      // Récupérer le dernier état du jeu
      const lastStateTurn = [...match.turns].reverse().find((t: any) => t.payload?.gameState);
      let gameState = lastStateTurn?.payload?.gameState;
      if (typeof gameState === "string") {
        gameState = JSON.parse(gameState);
      }

      if (gameState.preMatch?.phase !== "kickoff-sequence") {
        return res.status(400).json({ error: "Pas en phase de séquence de kickoff" });
      }

      // Placer le ballon
      const { placeKickoffBall } = await import("@bb/game-engine");
      let newState = placeKickoffBall(gameState, position);

      // Exposer la position du ballon pour le rendu frontend
      if (newState.preMatch?.ballPosition) {
        newState = { ...newState, ball: newState.preMatch.ballPosition };
      }

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

      // Notifier l'adversaire via WebSocket
      try {
        const { broadcastGameState } = await import("../services/game-broadcast");
        broadcastGameState(matchId, newState, { type: "place-kickoff-ball" }, req.user!.id);
      } catch {}

      return res.json({
        success: true,
        gameState: newState,
        message: "Ballon placé pour le kickoff",
      });
    } catch (e: any) {
      serverLog.error("Erreur lors du placement du ballon:", e);
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

      // Récupérer le dernier état du jeu
      const lastStateTurn2 = [...match.turns].reverse().find((t: any) => t.payload?.gameState);
      let gameState = lastStateTurn2?.payload?.gameState;
      if (typeof gameState === "string") {
        gameState = JSON.parse(gameState);
      }

      if (gameState.preMatch?.phase !== "kickoff-sequence" || gameState.preMatch?.kickoffStep !== "kick-deviation") {
        return res.status(400).json({ error: "Pas en phase de calcul de déviation" });
      }

      // Calculer la déviation avec un RNG déterministe
      const { calculateKickDeviation, makeRNG } = await import("@bb/game-engine");
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

      // Notifier l'adversaire via WebSocket
      try {
        const { broadcastGameState } = await import("../services/game-broadcast");
        broadcastGameState(matchId, newState, { type: "calculate-kick-deviation" }, req.user!.id);
      } catch {}

      return res.json({
        success: true,
        gameState: newState,
        message: "Déviation du kickoff calculée",
      });
    } catch (e: any) {
      serverLog.error("Erreur lors du calcul de déviation:", e);
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

      // Récupérer le dernier état du jeu
      const lastStateTurn3 = [...match.turns].reverse().find((t: any) => t.payload?.gameState);
      let gameState = lastStateTurn3?.payload?.gameState;
      if (typeof gameState === "string") {
        gameState = JSON.parse(gameState);
      }

      if (gameState.preMatch?.phase !== "kickoff-sequence" || gameState.preMatch?.kickoffStep !== "kickoff-event") {
        return res.status(400).json({ error: "Pas en phase d'événement de kickoff" });
      }

      // Résoudre l'événement avec un RNG déterministe
      const { resolveKickoffEvent, startMatchFromKickoff, makeRNG: makeRNG2 } = await import("@bb/game-engine");
      const kickoffRng = makeRNG2(`${match.seed}-kickoff-event`);
      let newState = resolveKickoffEvent(gameState, kickoffRng);

      // Démarrer le match après résolution de l'événement (avec RNG pour effets météo)
      const matchState = startMatchFromKickoff(newState, kickoffRng);

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

      // Practice vs AI — if the first player is the AI, start the loop.
      const postKickoffMatch = await prisma.match.findUnique({
        where: { id: matchId },
        select: { aiOpponent: true, aiTeamSide: true, aiUserId: true },
      });
      if (
        postKickoffMatch?.aiOpponent &&
        postKickoffMatch.aiTeamSide &&
        postKickoffMatch.aiUserId &&
        firstPlayerUserId === postKickoffMatch.aiUserId
      ) {
        scheduleAILoop(matchId);
      }

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

      // Notifier les deux joueurs via WebSocket que le match commence
      try {
        const { broadcastGameState } = await import("../services/game-broadcast");
        broadcastGameState(matchId, matchState, { type: "resolve-kickoff-event" }, req.user!.id);
      } catch {}

      return res.json({
        success: true,
        gameState: matchState,
        message: "Événement de kickoff résolu - Le match commence !",
      });
    } catch (e: any) {
      serverLog.error("Erreur lors de la résolution de l'événement:", e);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  }
);

// S27.8.17 — `handleListMatchTurns`, `handleGetMatchResults`,
// `handleListLiveMatches` extraits dans
// `routes/match-readonly-handlers.ts`. Re-export pour preserver
// l'API publique consommee par les tests d'integration.
export {
  handleListMatchTurns,
  handleGetMatchResults,
  handleListLiveMatches,
} from './match-readonly-handlers';
import {
  handleListMatchTurns as handleListMatchTurnsImpl,
  handleGetMatchResults as handleGetMatchResultsImpl,
  handleListLiveMatches as handleListLiveMatchesImpl,
} from './match-readonly-handlers';

router.get('/:id/turns', authUser, handleListMatchTurnsImpl);
router.get('/:id/results', authUser, handleGetMatchResultsImpl);

// ─── Spectator Mode ──────────────────────────────────────────────
router.get('/live', authUser, handleListLiveMatchesImpl);

// S27.8.16 — `handleSpectateMatch` et `handleReplayMatch` extraits dans
// `routes/match-spectate-replay-handlers.ts` pour reduire la taille de
// ce fichier. Re-export pour preserver l'API publique consommee par
// les tests d'integration et tout consommateur externe.
export {
  handleSpectateMatch,
  handleReplayMatch,
} from './match-spectate-replay-handlers';
import {
  handleSpectateMatch as handleSpectateMatchImpl,
  handleReplayMatch as handleReplayMatchImpl,
} from './match-spectate-replay-handlers';

router.get("/:id/spectate", authUser, handleSpectateMatchImpl);
router.get("/:id/replay", authUser, handleReplayMatchImpl);
