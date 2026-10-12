import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { normalizeRoles } from "../utils/roles";
import { setAuditActor } from "../utils/audit-context";
import { JWT_SECRET } from "../config";
import type { ApiKeyScope } from "../services/api-key-rules";
import {
  authenticateRequestApiKey,
  resolveRequestApiKey,
} from "./apiKeyAuth";

/** Clé API par laquelle la requête est authentifiée (jamais le secret). */
export interface AuthenticatedApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scope: ApiKeyScope;
}

export interface AuthenticatedUser {
  id: string;
  role?: string;
  roles: string[];
  /**
   * Quand la session est une impersonation admin (« se connecter en tant
   * que »), id de l'admin a l'origine (claim `act` du token). Absent pour
   * une session normale.
   */
  impersonatorId?: string;
  /**
   * Quand la requête est authentifiée par une clé API d'administration
   * (`Authorization: Bearer nak_…` / `X-API-Key`). Absent pour une session
   * JWT. Cf. `sessionOnly` et `docs/admin-api-keys.md`.
   */
  apiKey?: AuthenticatedApiKey;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export function authUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  // Clé API d'administration : aiguillée AVANT `jwt.verify` (un JWT
  // commence par `eyJ`, une clé par `nak_`). Le chemin JWT reste synchrone.
  const apiKeyResolution = resolveRequestApiKey(req);
  if (apiKeyResolution) {
    return authenticateRequestApiKey(req, res, next, apiKeyResolution, false);
  }

  const header = req.headers.authorization || "";
  const [, token] = header.split(" ");
  if (!token) return res.status(401).json({ error: "Non authentifié" });
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    const roles = normalizeRoles(
      (payload && (payload.roles as string[] | string | undefined)) ??
        (payload && (payload.role as string | undefined)),
    );

    const impersonatorId =
      payload && typeof payload.act === "string" && payload.act
        ? (payload.act as string)
        : undefined;

    req.user = {
      id: payload.sub,
      role: roles[0],
      roles,
      ...(impersonatorId ? { impersonatorId } : {}),
    };
    // Journal d'équipe : l'acteur n'est connu qu'ici (l'auth est par
    // route, le contexte d'audit est ouvert bien avant). No-op hors
    // contexte.
    setAuditActor({
      userId: payload.sub ?? null,
      roles,
      impersonatorId: impersonatorId ?? null,
    });
    return next();
  } catch {
    return res.status(401).json({ error: "Token invalide" });
  }
}


/**
 * Variante NON bloquante d'`authUser` : renseigne `req.user` quand un token
 * valide est présent, et laisse simplement passer sinon (pas de 401).
 *
 * Sert aux endpoints PUBLICS dont la RÉPONSE dépend du rôle du lecteur —
 * typiquement le bracket de playoffs, visible de tous une fois publié mais
 * réservé au commissaire tant qu'il ne l'est pas.
 *
 * Seule exception au « ne rejette jamais » : une clé API en lecture seule
 * sur une méthode d'écriture (403).
 */
export function optionalAuthUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const apiKeyResolution = resolveRequestApiKey(req);
  if (apiKeyResolution) {
    return authenticateRequestApiKey(req, res, next, apiKeyResolution, true);
  }

  const header = req.headers.authorization || "";
  const [, token] = header.split(" ");
  if (!token) return next();
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    const roles = normalizeRoles(
      (payload && (payload.roles as string[] | string | undefined)) ??
        (payload && (payload.role as string | undefined)),
    );
    const impersonatorId =
      payload && typeof payload.act === "string" && payload.act
        ? (payload.act as string)
        : undefined;
    req.user = {
      id: payload.sub,
      role: roles[0],
      roles,
      ...(impersonatorId ? { impersonatorId } : {}),
    };
    setAuditActor({
      userId: payload.sub ?? null,
      roles,
      impersonatorId: impersonatorId ?? null,
    });
  } catch {
    // Token invalide/expiré : on sert la vue publique plutôt que de rejeter.
  }
  return next();
}
