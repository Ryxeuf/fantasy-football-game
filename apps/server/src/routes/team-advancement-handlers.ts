/**
 * Handlers de l'édition avancée d'une équipe déjà créée : pool de PSP de
 * construction et annulation d'une amélioration.
 *
 * Endpoints couverts :
 *  - `GET    /team/:id/psp-pool` — état du pool (total / dépensé / restant,
 *    verrouillage coupe, règlement de tournoi applicable) ;
 *  - `PUT    /team/:id/psp-pool` — réglage du pool ;
 *  - `DELETE /team/:id/players/:playerId/advancements/:index` — annulation
 *    d'une amélioration (les PSP retournent à leur source).
 *
 * Toute la logique vit dans `services/team-advancement-editing.ts` ; ces
 * handlers ne font que mapper `TeamAdvancementError.code` vers un status.
 */

import type { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authUser';
import { sendError, sendSuccess } from '../utils/api-response';
import { serverLog } from '../utils/server-log';
import {
  getTeamPspPoolState,
  removePlayerAdvancement,
  setStartingPspPool,
  TeamAdvancementError,
  type TeamAdvancementErrorCode,
} from '../services/team-advancement-editing';
import type { UpdateStartingPspPoolBody } from '../schemas/team.schemas';

/** Status HTTP par code d'erreur métier. */
const STATUS_BY_CODE: Record<TeamAdvancementErrorCode, number> = {
  'team-not-found': 404,
  'player-not-found': 404,
  'advancement-not-found': 404,
  'team-frozen': 409,
  'pool-locked': 409,
  'pool-below-spent': 409,
  'pool-out-of-range': 400,
  'tournament-rules': 400,
};

function fail(res: Response, e: unknown, context: string): void {
  if (e instanceof TeamAdvancementError) {
    sendError(res, e.message, STATUS_BY_CODE[e.code] ?? 400);
    return;
  }
  serverLog.error(`[team-advancement] ${context}`, e);
  sendError(res, 'Erreur serveur', 500);
}

/** `GET /team/:id/psp-pool` */
export async function handleGetTeamPspPool(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    sendSuccess(res, await getTeamPspPoolState(req.params.id, req.user!.id));
  } catch (e) {
    fail(res, e, 'get pool');
  }
}

/** `PUT /team/:id/psp-pool` */
export async function handleUpdateTeamPspPool(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const body: UpdateStartingPspPoolBody = req.body;
  try {
    sendSuccess(
      res,
      await setStartingPspPool(
        req.params.id,
        req.user!.id,
        body.startingPspPool,
      ),
    );
  } catch (e) {
    fail(res, e, 'set pool');
  }
}

/** `DELETE /team/:id/players/:playerId/advancements/:index` */
export async function handleRemovePlayerAdvancement(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const index = Number.parseInt(req.params.index, 10);
  if (!Number.isInteger(index) || index < 0) {
    sendError(res, "Index d'amélioration invalide", 400);
    return;
  }
  try {
    const result = await removePlayerAdvancement({
      teamId: req.params.id,
      ownerId: req.user!.id,
      playerId: req.params.playerId,
      index,
    });
    sendSuccess(res, result);
  } catch (e) {
    fail(res, e, 'remove advancement');
  }
}
