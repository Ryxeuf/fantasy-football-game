import { Router } from "express";
import type { Response } from "express";
import { prisma } from "../prisma";
import { authUser, AuthenticatedRequest } from "../middleware/authUser";
import jwt from "jsonwebtoken";
import { acceptAndMaybeStartMatch } from "../services/match-start";
import { cancelMatch } from "../services/match-cancel";
import type { Move } from "@bb/game-engine";
import { validate } from "../middleware/validate";
import { processMove } from "../services/move-processor";
import { getAsyncMatchView } from "../services/async-match";
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
import type { AIDifficulty } from "@bb/game-engine";
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

// Create an online match vs AI (practice mode). (S25.5g — ApiResponse<T>)
// Reuses the ensureAISystemUser / spawnAITeam helpers from the LocalMatch
// practice service, but creates a regular Match so the standard /play/:id
// flow kicks in (same pre-match, same WebSocket broadcasts).
export async function handlePracticeMatch(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const { userTeamId, difficulty, aiRosterSlug, userSide, seed } =
      req.body as {
        userTeamId: string;
        difficulty: AIDifficulty;
        aiRosterSlug?: string;
        userSide?: "A" | "B";
        seed?: string;
      };

    const result = await createOnlinePracticeMatch(prisma as any, {
      creatorId: req.user!.id,
      userTeamId,
      difficulty,
      aiRosterSlug,
      userSide,
      seed,
    });

    const matchToken = jwt.sign(
      { matchId: result.matchId, userId: req.user!.id },
      MATCH_SECRET,
      { expiresIn: "2h" },
    );

    sendSuccess(
      res,
      {
        match: { id: result.matchId },
        matchToken,
        ai: {
          roster: result.aiRoster,
          teamId: result.aiTeamId,
          teamSide: result.aiTeamSide,
          userId: result.aiUserId,
          difficulty,
        },
      },
      201,
    );
  } catch (e: unknown) {
    const message = errorMessage(e);
    const status = message.includes("introuvable")
      ? 404
      : message.includes("proprietaire")
        ? 403
        : message.includes("non autorise")
          ? 400
          : message.includes("est requis")
            ? 400
            : 500;
    if (status >= 500) {
      serverLog.error("Erreur creation match pratique online:", e);
    }
    sendError(res, message, status);
  }
}

router.post(
  "/practice",
  authUser,
  validate(createPracticeOnlineMatchSchema),
  handlePracticeMatch,
);

// Soumettre un coup pendant la phase active du match (S25.5m — ApiResponse<T>).
// La collision entre le `success` du handler et celui de `MoveAckPayload`
// (cote client WS) est resolue en n'exposant cote HTTP que la donnee
// metier ({gameState,isMyTurn,moveCount}) sous `data`. Le client adapte
// l'enveloppe vers `MoveAckPayload` (voir `submitMoveHttp.ts`).
const MOVE_ERROR_STATUS: Record<string, number> = {
  NOT_FOUND: 404,
  INVALID_STATUS: 400,
  NOT_PLAYER: 403,
  NO_STATE: 500,
  NOT_YOUR_TURN: 403,
  ENGINE_ERROR: 400,
};

export async function handleSubmitMove(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const matchId = req.params.id;
    const { move } = req.body as { move: Move };

    const result = await processMove(matchId, req.user!.id, move);

    if (!result.success) {
      sendError(res, result.error, MOVE_ERROR_STATUS[result.code] ?? 500);
      return;
    }

    sendSuccess(res, {
      gameState: result.gameState,
      isMyTurn: result.isMyTurn,
      moveCount: result.moveCount,
    });
  } catch (e: unknown) {
    serverLog.error("Erreur lors de l'application du coup:", e);
    sendError(res, errorMessage(e), 500);
  }
}

router.post("/:id/move", authUser, validate(moveSchema), handleSubmitMove);

// Sprint R lot R.E.1 — vue async d'un match : deadline + isYourTurn +
// countdown. Marche aussi pour realtime (retourne hoursRemaining=null).
// Auth requis pour calculer `isYourTurn` correctement.
export async function handleAsyncMatchStatus(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const matchId = req.params.id;
    const view = await getAsyncMatchView(matchId, req.user!.id);
    if (!view) {
      sendError(res, "Match introuvable", 404);
      return;
    }
    sendSuccess(res, view);
  } catch (e: unknown) {
    serverLog.error("[match/:id/async-status] failed:", e);
    sendError(res, errorMessage(e), 500);
  }
}

router.get("/:id/async-status", authUser, handleAsyncMatchStatus);

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
// S27.8.29 — handleValidateSetup extrait dans
// `routes/match-validate-setup-handler.ts`. Re-export pour preserver
// l'API publique consommee par les tests d'integration.
export { handleValidateSetup } from './match-validate-setup-handler';
import { handleValidateSetup as handleValidateSetupImpl } from './match-validate-setup-handler';

router.post(
  "/:id/validate-setup",
  authUser,
  validate(validateSetupSchema),
  handleValidateSetupImpl,
);

// S27.8.21 — Handlers de la sequence de kickoff (place-ball / kick
// deviation / resolve-event) extraits dans
// `routes/match-kickoff-handlers.ts`. Re-export pour preserver l'API
// publique consommee par les tests d'integration.
export {
  handlePlaceKickoffBall,
  handleCalculateKickDeviation,
  handleResolveKickoffEvent,
} from './match-kickoff-handlers';
import {
  handlePlaceKickoffBall as handlePlaceKickoffBallImpl,
  handleCalculateKickDeviation as handleCalculateKickDeviationImpl,
  handleResolveKickoffEvent as handleResolveKickoffEventImpl,
} from './match-kickoff-handlers';

router.post(
  "/:id/place-kickoff-ball",
  authUser,
  validate(placeKickoffBallSchema),
  handlePlaceKickoffBallImpl,
);

router.post(
  "/:id/calculate-kick-deviation",
  authUser,
  handleCalculateKickDeviationImpl,
);

router.post(
  "/:id/resolve-kickoff-event",
  authUser,
  handleResolveKickoffEventImpl,
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
