/**
 * Règle spéciale d'équipe "Capitaine" (Saison 3) — endpoints coach.
 *
 * Endpoints couverts :
 *  - `GET /team/:id/captain` — `handleGetCaptainStatus` : statut capitaine
 *    de l'équipe (règle présente, capitaine actif/perdu, joueurs
 *    éligibles, droit de désignation). Consommé par le panneau capitaine
 *    de la page équipe.
 *  - `POST /team/:id/captain` — `handleDesignateCaptain` : désigne un
 *    joueur capitaine (création de la liste) ou son successeur si le
 *    capitaine précédent est mort/licencié (ligue). Le capitaine gagne
 *    Pro sans augmentation de valeur d'équipe.
 *
 * La logique vit dans `services/team-captain.ts` (erreurs typées
 * `CaptainError` mappées ici sur les status HTTP).
 */

import type { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authUser';
import { sendError, sendSuccess } from '../utils/api-response';
import { serverLog } from '../utils/server-log';
import type { DesignateCaptainBody } from '../schemas/team.schemas';
import {
  CaptainError,
  designateCaptain,
  getCaptainStatus,
} from '../services/team-captain';

/** Mapping code d'erreur métier → status HTTP. */
function captainErrorStatus(code: CaptainError['code']): number {
  switch (code) {
    case 'team_not_found':
    case 'player_not_found':
      return 404;
    case 'captain_already_active':
      return 409;
    default:
      return 400;
  }
}

/** `GET /team/:id/captain` — statut capitaine pour l'UI. */
export async function handleGetCaptainStatus(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const status = await getCaptainStatus(req.params.id, req.user!.id);
    sendSuccess(res, status);
  } catch (e: unknown) {
    if (e instanceof CaptainError) {
      sendError(res, e.message, captainErrorStatus(e.code));
      return;
    }
    serverLog.error('Erreur lors de la lecture du statut capitaine:', e);
    sendError(res, 'Erreur serveur', 500);
  }
}

/** `POST /team/:id/captain` — désigne le capitaine de l'équipe. */
export async function handleDesignateCaptain(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const body: DesignateCaptainBody = req.body;
  try {
    const result = await designateCaptain(
      req.params.id,
      req.user!.id,
      body.playerId,
    );
    sendSuccess(res, result, 201);
  } catch (e: unknown) {
    if (e instanceof CaptainError) {
      sendError(res, e.message, captainErrorStatus(e.code));
      return;
    }
    serverLog.error('Erreur lors de la désignation du capitaine:', e);
    sendError(res, 'Erreur serveur', 500);
  }
}
