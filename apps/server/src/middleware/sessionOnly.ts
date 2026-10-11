import type { NextFunction, Response } from "express";

import type { AuthenticatedRequest } from "./authUser";

/**
 * Réserve une route à une session INTERACTIVE (JWT) : une requête
 * authentifiée par clé API reçoit 403. À poser APRÈS `authUser`.
 *
 * Sert aux actions par lesquelles une clé fuitée se perpétuerait au-delà
 * de sa révocation : créer une autre clé, impersonner (un JWT émis survit
 * à la révocation), changer le mot de passe ou le profil du propriétaire,
 * désactiver son compte. Cf. change OpenSpec `admin-api-keys` (D7).
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
  return next();
}
