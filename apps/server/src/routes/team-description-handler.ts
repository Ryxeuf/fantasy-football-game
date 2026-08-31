/**
 * Handler de la description (fluff) d'équipe.
 *
 * `PATCH /team/:id/description` { description } — réservé au propriétaire
 * (authUser), validé par `updateTeamDescriptionSchema` (trim, ≤ 1000,
 * chaîne vide ⇒ null). Délègue à `updateTeamDescription` et renvoie
 * { team: { id, description } }.
 *
 * Volontairement HORS du verrou `isTeamRosterFrozen` : la description est
 * cosmétique, une équipe engagée (match, ligue, coupe) reste descriptible.
 * Cf. `services/team-description.ts` pour le raisonnement complet.
 */

import type { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authUser";
import { sendError, sendSuccess } from "../utils/api-response";
import { serverLog } from "../utils/server-log";
import {
  updateTeamDescription,
  TeamDescriptionError,
} from "../services/team-description";
import type { UpdateTeamDescriptionBody } from "../schemas/team.schemas";

export async function handleUpdateTeamDescription(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const teamId = req.params.id;
  // Type posé par le schéma Zod (`validate(updateTeamDescriptionSchema)`) :
  // tout drift schéma/handler échoue à `tsc` plutôt qu'en prod.
  const body: UpdateTeamDescriptionBody = req.body;

  try {
    const result = await updateTeamDescription({
      teamId,
      ownerId: req.user!.id,
      description: body.description,
    });
    sendSuccess(res, {
      team: { id: result.id, description: result.description },
    });
  } catch (e: unknown) {
    if (e instanceof TeamDescriptionError) {
      sendError(res, e.message, e.code === "not_found" ? 404 : 400);
      return;
    }
    serverLog.error("[team-description] updateTeamDescription failed", e);
    sendError(res, "Erreur serveur", 500);
  }
}
