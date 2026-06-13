/**
 * Handler du partage public opt-in d'une équipe.
 *
 * `PATCH /team/:id/share` { enabled: boolean } — réservé au propriétaire
 * (authUser). Délègue à `setTeamShare` puis renvoie { isPublic, shareToken }.
 */

import type { Response } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../middleware/authUser";
import { sendError, sendSuccess } from "../utils/api-response";
import { serverLog } from "../utils/server-log";
import { setTeamShare, TeamShareError } from "../services/team-share";

export const shareTeamSchema = z.object({
  enabled: z.boolean(),
});

export async function handleSetTeamShare(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const teamId = req.params.id;
  const { enabled } = req.body as { enabled: boolean };
  try {
    const result = await setTeamShare({
      teamId,
      ownerId: req.user!.id,
      enabled,
    });
    sendSuccess(res, result);
  } catch (error) {
    if (error instanceof TeamShareError && error.code === "NOT_FOUND") {
      sendError(res, "Équipe introuvable", 404);
      return;
    }
    serverLog.error("[team-share] setTeamShare failed", error);
    sendError(res, "Erreur lors de la mise à jour du partage", 500);
  }
}
