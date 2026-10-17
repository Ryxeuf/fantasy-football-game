/**
 * Fiche de roster d'une équipe inscrite à une coupe, en lecture seule.
 * Monté sur `/cup` AVANT `cupRoutes` (dont le `GET /:id` ne la capte pas,
 * mais l'ordre suit celui des autres sous-routeurs de coupe).
 *
 *   GET /cup/:id/teams/:teamId/roster-view
 *
 * Même porte que `GET /cup/:id` : tout compte connecté qui voit la coupe voit
 * les rosters de ses inscrits — c'est ce que sert déjà la coupe (noms,
 * classement, tops par joueur). Une équipe non inscrite est un 404.
 */

import { Router } from "express";
import type { Response } from "express";
import { authUser, type AuthenticatedRequest } from "../middleware/authUser";
import { sendError, sendSuccess } from "../utils/api-response";
import { serverLog } from "../utils/server-log";
import {
  CupTeamRosterError,
  loadCupTeamRosterView,
} from "../services/cup-team-roster";

export async function handleGetCupTeamRoster(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  if (!req.user?.id) {
    sendError(res, "Non authentifie", 401);
    return;
  }
  try {
    const view = await loadCupTeamRosterView({
      cupId: req.params.id,
      teamId: req.params.teamId,
    });
    sendSuccess(res, view);
  } catch (e: unknown) {
    if (e instanceof CupTeamRosterError) {
      sendError(res, e.message, 404);
      return;
    }
    serverLog.error("[cup-team-roster] lecture du roster échouée", e);
    sendError(res, "Erreur serveur", 500);
  }
}

const router = Router();

router.get("/:id/teams/:teamId/roster-view", authUser, handleGetCupTeamRoster);

export default router;
