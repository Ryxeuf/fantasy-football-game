/**
 * Une équipe supprimée (soft delete) est en LECTURE SEULE, pour tout le monde.
 *
 * Le bypass admin de `teamAccessWhere` — voulu pour qu'un admin consulte et
 * corrige n'importe quelle équipe — laissait aussi écrire sur une équipe
 * supprimée : aucune route d'écriture ne regardait `deletedAt`. Ce garde est
 * posé UNE fois devant chaque famille de routes (`/team/:id…`,
 * `/leagues/:leagueId/teams/:teamId…`) plutôt que dans la trentaine de
 * handlers, pour qu'une nouvelle route soit couverte d'office.
 *
 * Seule sortie : `POST /admin/teams/:id/restore`, hors de ces routes. Les
 * effets d'une feuille de match restent hors périmètre : ils ne passent pas
 * par ces routes et une compétition en cours doit pouvoir se terminer.
 */

import type { NextFunction, Response } from "express";
import { prisma } from "../prisma";
import { sendError } from "../utils/api-response";
import { serverLog } from "../utils/server-log";
import { authUser, type AuthenticatedRequest } from "./authUser";

export const DELETED_TEAM_READ_ONLY_MESSAGE =
  "Cette équipe a été supprimée : elle n'est plus modifiable.";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

async function refuseIfDeleted(
  teamId: string,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { deletedAt: true },
    });
    if (team?.deletedAt) {
      sendError(res, DELETED_TEAM_READ_ONLY_MESSAGE, 409);
      return;
    }
    next();
  } catch (e: unknown) {
    serverLog.error("[team-write-guard] lecture de l'équipe", e);
    sendError(res, "Erreur serveur", 500);
  }
}

/**
 * Middleware à monter en `router.use("/…/:<param>", …)`. Authentifie AVANT de
 * lire la base : un appel anonyme reste un 401, comme sur la route visée.
 */
export function rejectDeletedTeamWrite(param: string) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): void => {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }
    authUser(req, res, () => {
      void refuseIfDeleted(String(req.params[param]), res, next);
    });
  };
}
