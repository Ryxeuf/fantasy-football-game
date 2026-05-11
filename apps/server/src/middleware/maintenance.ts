/**
 * Sprint P — Lot P.A.1 : mode maintenance global.
 *
 * Quand le feature flag `maintenance_mode` est actif, intercept toutes
 * les requetes non-essentielles et retourne 503 avec `Retry-After`.
 *
 * Routes preservees en mode maintenance :
 *   - `/health/*` : Kubernetes / Docker healthchecks (sinon le scheduler
 *     reschedule le pod en boucle).
 *   - `/admin/*` : admins peuvent toggle off le flag depuis l'UI.
 *   - `/auth/login` : admins peuvent se connecter pour gerer.
 *
 * Le flag est un **kill-switch** au sens du `KILL_SWITCH_FLAGS` set —
 * il ne doit JAMAIS etre force-ON par `FEATURE_FLAGS_FORCE_ENABLED`.
 *
 * Strategie : middleware mont apres `requestContext` + `requestTiming`
 * pour avoir le logger associe, et AVANT les routes business.
 */

import type { NextFunction, Request, Response } from "express";

import {
  MAINTENANCE_MODE_FLAG,
  isEnabled as isFeatureEnabled,
} from "../services/featureFlags";

const RETRY_AFTER_SECONDS = 3600;

/**
 * Liste des routes (prefixe path) que le middleware laisse passer meme
 * en mode maintenance. Tout le reste retourne 503.
 *
 * `/admin/*` car les admins doivent pouvoir toggle off le flag.
 * `/auth/login`, `/auth/refresh`, `/auth/me` car les admins doivent
 * pouvoir se reconnecter (et garder une session active si elle expire).
 */
const ALLOWLIST_PREFIXES = [
  "/health",
  "/admin",
  "/auth/login",
  "/auth/refresh",
  "/auth/me",
  "/auth/logout",
];

function isAllowlistedPath(path: string): boolean {
  for (const prefix of ALLOWLIST_PREFIXES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      return true;
    }
  }
  return false;
}

/**
 * Middleware Express qui verifie le flag maintenance a chaque request.
 *
 * Cout : 1 lookup memoire (cache 30s sur le service featureFlags).
 * Negligeable.
 */
export function maintenanceMode() {
  return async function maintenanceMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    if (isAllowlistedPath(req.path)) {
      next();
      return;
    }

    let enabled = false;
    try {
      enabled = await isFeatureEnabled(MAINTENANCE_MODE_FLAG);
    } catch {
      // Lookup DB en panne ? On laisse passer plutot que de claquer le
      // site. La readiness probe `/health/ready` ramassera l'incident.
      enabled = false;
    }

    if (!enabled) {
      next();
      return;
    }

    res.setHeader("Retry-After", String(RETRY_AFTER_SECONDS));
    res.setHeader("Cache-Control", "no-store");
    res.status(503).json({
      error: "maintenance",
      message:
        "Le site est temporairement indisponible pour maintenance. Reviens dans quelques minutes.",
      retryAfterSeconds: RETRY_AFTER_SECONDS,
    });
  };
}
