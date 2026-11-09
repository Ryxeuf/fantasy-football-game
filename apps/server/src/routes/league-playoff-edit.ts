/**
 * Édition d'un bracket de play-offs de ligue déjà généré, par son
 * commissaire (ou un admin). Monté sur `/leagues` AVANT le routeur
 * historique (`routes/league.ts`) : routes littérales, aucune ne recouvre
 * une route existante.
 *
 *   POST /leagues/seasons/:seasonId/playoff-bracket/reset
 *
 * Autorisation et décisions dans `services/league-playoff-edit` ; ici on ne
 * fait que mapper les erreurs typées vers les statuts HTTP.
 */

import { Router } from "express";
import type { Response } from "express";
import { authUser, type AuthenticatedRequest } from "../middleware/authUser";
import { hasRole } from "../utils/roles";
import { apiError, sendError, sendSuccess } from "../utils/api-response";
import { serverLog } from "../utils/server-log";
import {
  PlayoffEditError,
  resetPlayoffBracket,
  type PlayoffEditActor,
  type PlayoffEditErrorCode,
} from "../services/league-playoff-edit";

const NOT_FOUND_CODES: ReadonlySet<PlayoffEditErrorCode> = new Set([
  "season_not_found",
]);

function actorOf(
  req: AuthenticatedRequest,
  res: Response,
): PlayoffEditActor | null {
  const user = req.user;
  if (!user?.id) {
    sendError(res, "Non authentifie", 401);
    return null;
  }
  return { userId: user.id, isAdmin: hasRole(user.roles ?? [], "admin") };
}

export function playoffEditErrorStatus(code: PlayoffEditErrorCode): number {
  if (NOT_FOUND_CODES.has(code)) return 404;
  if (code === "forbidden") return 403;
  return 409;
}

function handleError(res: Response, e: unknown): void {
  if (e instanceof PlayoffEditError) {
    // Le `code` voyage avec le message : l'écran en a besoin pour expliquer
    // un refus (ex. `bracket_engaged` ⇒ « remplacez plutôt le qualifié »).
    res
      .status(playoffEditErrorStatus(e.code))
      .json({ ...apiError(e.message), code: e.code });
    return;
  }
  serverLog.error("[league-playoff-edit] route failed", e);
  sendError(res, "Erreur serveur", 500);
}

/** POST /leagues/seasons/:seasonId/playoff-bracket/reset */
export async function handleResetPlayoffBracket(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const actor = actorOf(req, res);
  if (!actor) return;
  try {
    const out = await resetPlayoffBracket(req.params.seasonId, actor);
    sendSuccess(res, out);
  } catch (e: unknown) {
    handleError(res, e);
  }
}

const router = Router();

router.post(
  "/seasons/:seasonId/playoff-bracket/reset",
  authUser,
  handleResetPlayoffBracket,
);

export default router;
