/**
 * Handler du renommage d'équipe.
 *
 * `PATCH /team/:id/name` { name } — réservé au propriétaire (authUser),
 * validé par `renameTeamSchema` (trim + 1..100, mêmes bornes qu'à la
 * création). Délègue à `renameTeam` et renvoie { team: { id, name } }.
 *
 * Volontairement HORS du verrou `isTeamRosterFrozen` : le nom est
 * cosmétique, une équipe engagée (match, ligue, coupe) reste renommable.
 * Cf. `services/team-rename.ts` pour le raisonnement complet.
 */

import type { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authUser";
import { sendError, sendSuccess } from "../utils/api-response";
import { serverLog } from "../utils/server-log";
import { renameTeam, TeamRenameError } from "../services/team-rename";
import type { RenameTeamBody } from "../schemas/team.schemas";

export async function handleRenameTeam(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const teamId = req.params.id;
  // Type posé par le schéma Zod (`validate(renameTeamSchema)`) : tout
  // drift schéma/handler échoue à `tsc` plutôt qu'en prod.
  const body: RenameTeamBody = req.body;

  try {
    const result = await renameTeam({
      teamId,
      ownerId: req.user!.id,
      name: body.name,
    });
    sendSuccess(res, { team: { id: result.id, name: result.name } });
  } catch (e: unknown) {
    if (e instanceof TeamRenameError) {
      sendError(res, e.message, e.code === "not_found" ? 404 : 400);
      return;
    }
    serverLog.error("[team-rename] renameTeam failed", e);
    sendError(res, "Erreur serveur", 500);
  }
}
