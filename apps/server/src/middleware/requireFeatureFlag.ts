import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { isEnabled } from "../services/featureFlags";
import { JWT_SECRET } from "../config";
import { normalizeRoles } from "../utils/roles";
import { AuthenticatedRequest } from "./authUser";

/**
 * Middleware Express qui bloque la route avec un 403 lorsque le feature flag
 * `key` n'est pas actif pour le coach courant.
 *
 * Règle d'évaluation (cf. services/featureFlags.ts) :
 *  - FEATURE_FLAGS_FORCE_ENABLED=true → autorisé (CI / tests)
 *  - rôle "admin" → autorisé
 *  - flag globalement actif → autorisé
 *  - override utilisateur pour (flag, userId) → autorisé
 *  - sinon → 403
 *
 * Le middleware est utilisable en amont d'`authUser` : il extrait lui-même
 * le token JWT de l'en-tête `Authorization` pour récupérer userId et roles,
 * sans rejeter les requêtes non authentifiées (`authUser` s'en charge).
 */
export function requireFeatureFlag(key: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Si authUser a déjà rempli req.user, on réutilise son contexte.
    const authedUser = (req as AuthenticatedRequest).user;
    let userId: string | undefined = authedUser?.id;
    let roles: string[] = authedUser?.roles ?? [];

    if (!userId) {
      const header = req.headers.authorization || "";
      const [, token] = header.split(" ");
      if (token) {
        try {
          const payload = jwt.verify(token, JWT_SECRET) as {
            sub?: string;
            role?: string;
            roles?: string[] | string;
          };
          userId = payload.sub;
          roles = normalizeRoles(payload.roles ?? payload.role);
        } catch {
          // Token invalide : on laisse `authUser` renvoyer 401 plus tard si
          // la route l'exige. Ici on évalue quand même le flag sans contexte
          // utilisateur.
        }
      }
    }

    try {
      const allowed = await isEnabled(key, userId, { roles });
      if (allowed) return next();
      return res.status(403).json({
        error: "Fonctionnalité indisponible",
        code: "feature_flag_disabled",
        flag: key,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erreur serveur";
      console.error(`[requireFeatureFlag:${key}]`, message);
      return res.status(500).json({ error: message });
    }
  };
}
