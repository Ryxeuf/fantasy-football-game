/**
 * S27.8.21 — Module dedie aux 2 handlers d'action sur un match
 * (practice creation + submit move) extraits depuis `routes/match.ts`.
 *
 * Endpoints couverts :
 *  - `POST /practice` — `handlePracticeMatch` : creer un match online
 *    contre l'IA (delegate au service `createOnlinePracticeMatch`),
 *    avec mapping d'erreurs HTTP par mot-cle (404/403/400/500).
 *  - `POST /:id/move` — `handleSubmitMove` : appliquer un coup pendant
 *    la phase active du match (delegate a `processMove` qui retourne
 *    un code d'erreur normalise mappe via `MOVE_ERROR_STATUS`).
 *
 * Apres extraction, `match.ts` re-exporte ces handlers pour preserver
 * l'API publique consommee par les tests d'integration.
 */

import type { Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma';
import { AuthenticatedRequest } from '../middleware/authUser';
import type { Move, AIDifficulty } from '@bb/game-engine';
import { createOnlinePracticeMatch } from '../services/practice-match';
import { processMove } from '../services/move-processor';
import { MATCH_SECRET } from '../config';
import { serverLog } from '../utils/server-log';
import { sendError, sendSuccess } from '../utils/api-response';

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Erreur serveur';
}

/**
 * S25.5g / S27.8.21 — `POST /match/practice`
 *
 * Cree un match online contre l'IA. Reuse les helpers
 * `ensureAISystemUser` / `spawnAITeam` du service practice-match,
 * mais cree un Match standard pour que le flow `/play/:id` standard
 * s'applique (memes pre-match et broadcasts WebSocket). Mappe les
 * erreurs metier sur des codes HTTP via leurs mots-cles
 * (404 introuvable / 403 proprietaire / 400 non autorise / 500 autre).
 */
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
        userSide?: 'A' | 'B';
        seed?: string;
      };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      { expiresIn: '2h' },
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
    const status = message.includes('introuvable')
      ? 404
      : message.includes('proprietaire')
        ? 403
        : message.includes('non autorise')
          ? 400
          : message.includes('est requis')
            ? 400
            : 500;
    if (status >= 500) {
      serverLog.error('Erreur creation match pratique online:', e);
    }
    sendError(res, message, status);
  }
}

/**
 * Map des codes d'erreur metier de `processMove` vers les statuts HTTP.
 */
const MOVE_ERROR_STATUS: Record<string, number> = {
  NOT_FOUND: 404,
  INVALID_STATUS: 400,
  NOT_PLAYER: 403,
  NO_STATE: 500,
  NOT_YOUR_TURN: 403,
  ENGINE_ERROR: 400,
};

/**
 * S25.5m / S27.8.21 — `POST /match/:id/move`
 *
 * Soumettre un coup pendant la phase active du match. Delegate au
 * service `processMove` qui valide la legalite, applique l'engine,
 * persiste le turn, et broadcast aux clients WebSocket. La collision
 * entre le `success` du handler et celui de `MoveAckPayload` (cote
 * client WS) est resolue en n'exposant cote HTTP que la donnee
 * metier (`gameState`, `isMyTurn`, `moveCount`) sous `data` ; le
 * client adapte l'enveloppe vers `MoveAckPayload`.
 */
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
