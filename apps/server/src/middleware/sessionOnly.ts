import type { NextFunction, Response } from "express";

import type { AuthenticatedRequest } from "./authUser";

/**
 * Réserve une route à la session INTERACTIVE du titulaire du compte : une
 * requête authentifiée par clé API, ou faite pendant une impersonation,
 * reçoit 403. À poser APRÈS `authUser`.
 *
 * Sert aux actions par lesquelles un accès se perpétuerait au-delà de sa
 * propre fin — une clé au-delà de sa révocation, une impersonation (1 h,
 * non renouvelable) au-delà de son expiration : créer une clé, impersonner,
 * changer un rôle, obtenir un mot de passe, modifier ou désactiver le compte.
 * Une impersonation qui crée une clé l'attribuerait en outre à l'admin
 * impersonné. Cf. change OpenSpec `admin-api-keys` (D7).
 */
export function sessionOnly(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  if (req.user?.apiKey) {
    return res.status(403).json({
      error:
        "Action réservée à une session interactive : une clé API ne peut pas l'effectuer",
      code: "interactive_session_required",
    });
  }
  if (req.user?.impersonatorId) {
    return res.status(403).json({
      error:
        "Action réservée au titulaire du compte : impossible pendant une impersonation",
      code: "impersonation_not_allowed",
    });
  }
  return next();
}
