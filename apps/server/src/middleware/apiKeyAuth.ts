/**
 * Authentification par clé API d'administration (change OpenSpec
 * `admin-api-keys`, doc `docs/admin-api-keys.md`).
 *
 * Module séparé d'`authUser` pour que `requireFeatureFlag` (monté AVANT
 * l'auth de route) partage la même résolution mémorisée, y compris dans
 * les tests qui remplacent `authUser` par un mock.
 */
import type { Request, Response, NextFunction } from "express";

import { authenticateApiKey } from "../services/api-keys";
import {
  extractApiKey,
  isMethodAllowedForScope,
  type ApiKeyEvaluation,
  type ApiKeyIdentity,
} from "../services/api-key-rules";
import { setAuditActor } from "../utils/audit-context";
import { serverLog } from "../utils/server-log";
import type { AuthenticatedRequest } from "./authUser";

const API_KEY_INVALID = {
  error: "Clé API invalide",
  code: "api_key_invalid",
} as const;

const API_KEY_READ_ONLY = {
  error: "Clé API en lecture seule : seules les méthodes GET, HEAD et OPTIONS sont autorisées",
  code: "api_key_read_only",
} as const;

/**
 * Une requête traverse souvent plusieurs `authUser` (`app.use("/admin",
 * adminRoutes)` puis le sous-routeur) : la résolution d'une clé — une
 * requête en base — est mémorisée par requête.
 */
const apiKeyResolutions = new WeakMap<object, Promise<ApiKeyEvaluation>>();

/**
 * Résolution de la clé API portée par la requête, mémorisée ; `null` si la
 * requête n'en porte pas. Partagée avec `requireFeatureFlag`, qui tourne
 * avant l'auth de route.
 */
export function resolveRequestApiKey(
  req: Request,
): Promise<ApiKeyEvaluation> | null {
  const secret = extractApiKey(req.headers);
  if (!secret) return null;
  const cached = apiKeyResolutions.get(req);
  if (cached) return cached;
  const resolution = authenticateApiKey(secret, {
    ip: typeof req.ip === "string" && req.ip ? req.ip : null,
  });
  apiKeyResolutions.set(req, resolution);
  return resolution;
}

function applyApiKeyIdentity(
  req: AuthenticatedRequest,
  identity: ApiKeyIdentity,
): void {
  req.user = {
    id: identity.userId,
    role: identity.roles[0],
    roles: identity.roles,
    apiKey: {
      id: identity.apiKeyId,
      name: identity.name,
      keyPrefix: identity.keyPrefix,
      scope: identity.scope,
    },
  };
  setAuditActor({
    userId: identity.userId,
    roles: identity.roles,
    impersonatorId: null,
    apiKeyId: identity.apiKeyId,
  });
}

/**
 * Chemin « clé API », commun aux deux variantes. `optional` : une clé
 * refusée vaut absence d'authentification (vue publique) au lieu d'un 401.
 * La lecture seule est appliquée dans les DEUX cas — mieux vaut un 403
 * explicite qu'une écriture faite en anonyme.
 */
export async function authenticateRequestApiKey(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
  resolution: Promise<ApiKeyEvaluation>,
  optional: boolean,
): Promise<unknown> {
  let evaluation: ApiKeyEvaluation;
  try {
    evaluation = await resolution;
  } catch (err) {
    serverLog.error("[authUser] vérification de la clé API impossible", err);
    if (optional) return next();
    return res
      .status(500)
      .json({ error: "Erreur serveur lors de la vérification de la clé API" });
  }

  if (!evaluation.ok) {
    if (optional) return next();
    return res.status(401).json(API_KEY_INVALID);
  }
  if (!isMethodAllowedForScope(evaluation.identity.scope, req.method)) {
    return res.status(403).json(API_KEY_READ_ONLY);
  }
  applyApiKeyIdentity(req, evaluation.identity);
  return next();
}
