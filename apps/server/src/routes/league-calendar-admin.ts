/**
 * Outils de calendrier du commissaire, montés sous `/leagues` par
 * `routes/league.ts` (un seul `router.use`, pour ne pas disperser des
 * handlers dans un fichier de 3 600 lignes) :
 *
 *   PATCH  /rounds/:roundId   renommer une journée / changer ses dates
 *   DELETE /rounds/:roundId   supprimer une journée sans rencontre engagée
 *
 * Autorisation, visibilité (ligue privée ⇒ 404) et règles vivent dans les
 * services ; ici on ne fait que valider, appeler, journaliser et mapper les
 * erreurs typées vers les statuts HTTP.
 */

import { Router } from "express";
import type { Response } from "express";
import { authUser, type AuthenticatedRequest } from "../middleware/authUser";
import { validate } from "../middleware/validate";
import { prisma } from "../prisma";
import { hasRole } from "../utils/roles";
import { apiError, sendError, sendSuccess } from "../utils/api-response";
import { serverLog } from "../utils/server-log";
import { safeRecordAdminActionFromRequest } from "../services/audit-log";
import {
  deleteLeagueRound,
  updateLeagueRound,
  LeagueRoundAdminError,
  type RoundActor,
} from "../services/league-round-admin";
import {
  updateLeagueRoundSchema,
  type UpdateLeagueRoundBody,
} from "../schemas/league-calendar-admin.schemas";

function actorOf(req: AuthenticatedRequest, res: Response): RoundActor | null {
  const user = req.user;
  if (!user?.id) {
    sendError(res, "Non authentifie", 401);
    return null;
  }
  return { userId: user.id, isAdmin: hasRole(user.roles ?? [], "admin") };
}

/** Refus métier : 409, avec son `code` pour que l'écran l'explique. */
function sendRefusal(res: Response, status: number, e: Error & { code: string }) {
  res.status(status).json({ ...apiError(e.message), code: e.code });
}

function roundAdminError(res: Response, e: unknown): void {
  if (e instanceof LeagueRoundAdminError) {
    if (e.code === "round_not_found") {
      sendError(res, e.message, 404);
    } else if (e.code === "forbidden") {
      sendError(res, e.message, 403);
    } else if (e.code === "invalid_dates") {
      sendError(res, e.message, 400);
    } else {
      sendRefusal(res, 409, e);
    }
    return;
  }
  serverLog.error("[league-calendar-admin] round route failed", e);
  sendError(res, "Erreur serveur", 500);
}

/** PATCH /leagues/rounds/:roundId */
export async function handleUpdateLeagueRound(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const actor = actorOf(req, res);
  if (!actor) return;
  const body: UpdateLeagueRoundBody = req.body;
  try {
    const { round, before } = await updateLeagueRound({
      roundId: req.params.roundId,
      actor,
      name: body.name,
      startDate: body.startDate,
      endDate: body.endDate,
    });
    await safeRecordAdminActionFromRequest(prisma, req, {
      action: "league.round.update",
      entity: "LeagueRound",
      entityId: round.id,
      oldValue: {
        name: before.name,
        startDate: before.startDate,
        endDate: before.endDate,
      },
      newValue: {
        name: round.name,
        startDate: round.startDate,
        endDate: round.endDate,
      },
    });
    sendSuccess(res, round);
  } catch (e: unknown) {
    roundAdminError(res, e);
  }
}

/** DELETE /leagues/rounds/:roundId */
export async function handleDeleteLeagueRound(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const actor = actorOf(req, res);
  if (!actor) return;
  try {
    const result = await deleteLeagueRound({
      roundId: req.params.roundId,
      actor,
    });
    await safeRecordAdminActionFromRequest(prisma, req, {
      action: "league.round.delete",
      entity: "LeagueRound",
      entityId: result.roundId,
      oldValue: {
        seasonId: result.seasonId,
        roundNumber: result.roundNumber,
        name: result.name,
        pairingsRemoved: result.pairingsRemoved,
        draftSheetsRemoved: result.draftSheetsRemoved,
        predictionsRemoved: result.predictionsRemoved,
      },
    });
    sendSuccess(res, result);
  } catch (e: unknown) {
    roundAdminError(res, e);
  }
}

export function createLeagueCalendarAdminRouter(): Router {
  const router = Router();
  router.patch(
    "/rounds/:roundId",
    authUser,
    validate(updateLeagueRoundSchema),
    handleUpdateLeagueRound,
  );
  router.delete("/rounds/:roundId", authUser, handleDeleteLeagueRound);
  return router;
}

export const leagueCalendarAdminRouter = createLeagueCalendarAdminRouter();
