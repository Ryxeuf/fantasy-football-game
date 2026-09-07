/**
 * Routes d'archivage / suppression d'une compétition par son commissaire.
 *
 * Un seul jeu de handlers (fabrique par famille), monté deux fois :
 *   - `/leagues/:id/archive` (POST) et `/leagues/:id` (DELETE)
 *   - `/cup/:id/archive`     (POST) et `/cup/:id`     (DELETE)
 *
 * Autorisation (créateur ou admin) et notifications des participants vivent
 * dans `services/competition-lifecycle` ; ici on ne fait que mapper les
 * erreurs typées vers les statuts HTTP.
 */

import { Router } from "express";
import type { Response } from "express";
import { authUser, type AuthenticatedRequest } from "../middleware/authUser";
import { hasRole } from "../utils/roles";
import { sendError, sendSuccess } from "../utils/api-response";
import { serverLog } from "../utils/server-log";
import {
  archiveCup,
  archiveLeague,
  deleteCup,
  deleteLeague,
  CompetitionLifecycleError,
  type CompetitionKind,
  type LifecycleActor,
} from "../services/competition-lifecycle";

function actorFromRequest(
  req: AuthenticatedRequest,
  res: Response,
): LifecycleActor | null {
  const user = req.user;
  if (!user?.id) {
    sendError(res, "Non authentifie", 401);
    return null;
  }
  return { userId: user.id, isAdmin: hasRole(user.roles, "admin") };
}

function lifecycleError(res: Response, kind: CompetitionKind, e: unknown): void {
  if (e instanceof CompetitionLifecycleError) {
    sendError(res, e.message, e.code === "not_found" ? 404 : 403);
    return;
  }
  serverLog.error(`[competition-lifecycle] ${kind} route failed`, e);
  sendError(res, "Erreur serveur", 500);
}

export async function handleArchiveCompetition(
  kind: CompetitionKind,
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const actor = actorFromRequest(req, res);
  if (!actor) return;
  try {
    const result =
      kind === "league"
        ? await archiveLeague(req.params.id, actor)
        : await archiveCup(req.params.id, actor);
    sendSuccess(res, result);
  } catch (e: unknown) {
    lifecycleError(res, kind, e);
  }
}

export async function handleDeleteCompetition(
  kind: CompetitionKind,
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const actor = actorFromRequest(req, res);
  if (!actor) return;
  try {
    const result =
      kind === "league"
        ? await deleteLeague(req.params.id, actor)
        : await deleteCup(req.params.id, actor);
    sendSuccess(res, { ...result, deleted: true });
  } catch (e: unknown) {
    lifecycleError(res, kind, e);
  }
}

export function createCompetitionLifecycleRouter(kind: CompetitionKind): Router {
  const router = Router();
  router.post("/:id/archive", authUser, (req, res) =>
    handleArchiveCompetition(kind, req as AuthenticatedRequest, res),
  );
  router.delete("/:id", authUser, (req, res) =>
    handleDeleteCompetition(kind, req as AuthenticatedRequest, res),
  );
  return router;
}

export const leagueLifecycleRouter = createCompetitionLifecycleRouter("league");
export const cupLifecycleRouter = createCompetitionLifecycleRouter("cup");
