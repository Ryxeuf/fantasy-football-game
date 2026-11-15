/**
 * Gardes de LECTURE d'une compétition (ligue | coupe), posées dans la chaîne
 * de middlewares d'une route : 404 avec le message d'une compétition
 * inexistante si elle n'existe pas OU si le lecteur ne doit pas la voir
 * (`services/competition-access`). Jamais 403 : il confirmerait l'existence
 * d'une compétition privée à qui en devine l'id.
 *
 * À placer APRÈS `authUser` / `optionalAuthUser` (le lecteur vient de
 * `req.user`) et AVANT tout contrôle de rôle.
 */

import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "./authUser";
import {
  CUP_NOT_FOUND,
  findVisibleCup,
  isCupPairingHiddenFrom,
  type CompetitionViewer,
} from "../services/competition-access";
import { sendError } from "../utils/api-response";
import { hasRole } from "../utils/roles";

/** Lecteur courant ; `req.user` est absent derrière `optionalAuthUser`. */
export function competitionViewerOf(
  req: AuthenticatedRequest,
): CompetitionViewer {
  return {
    userId: req.user?.id ?? null,
    isAdmin: hasRole(req.user?.roles ?? [], "admin"),
  };
}

/**
 * Coupe adressée par un paramètre d'URL (`:id` par défaut) : 404
 * « Coupe introuvable » si elle est cachée au lecteur.
 */
export function requireVisibleCup(param = "id") {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const cupId = req.params[param];
      const cup = cupId
        ? await findVisibleCup(cupId, competitionViewerOf(req))
        : null;
      if (!cup) {
        sendError(res, CUP_NOT_FOUND, 404);
        return;
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}

/**
 * Rencontre de coupe adressée par `:pairingId` : 404 si sa coupe est cachée
 * au lecteur. Un id inconnu ou une rencontre de ligue passent (le service et
 * la garde de ligue tranchent).
 */
export function requireVisibleCupPairing(param = "pairingId") {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const pairingId = req.params[param];
      if (
        pairingId &&
        (await isCupPairingHiddenFrom(pairingId, competitionViewerOf(req)))
      ) {
        sendError(res, "Pairing introuvable", 404);
        return;
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}
