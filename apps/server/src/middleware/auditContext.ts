/**
 * Middleware qui ouvre le contexte d'audit ambiant pour toute la durée
 * d'une requête HTTP.
 *
 * Doit être monté APRÈS `requestContext()` (qui pose `req.requestId`) et
 * AVANT les routes : la corrélation du journal d'équipe est le requestId,
 * ce qui permet de recoller une ligne de journal à une ligne de log pino.
 *
 * L'acteur n'est pas connu ici (l'auth est par route) : `authUser` le
 * renseigne ensuite via `setAuditActor`.
 */

import type { NextFunction, Request, Response } from "express";

import {
  createAuditContext,
  runWithAuditContext,
} from "../utils/audit-context";
import { getRequestId } from "./requestContext";

/**
 * Route « normalisée » de la requête : on préfère `req.route`/`baseUrl`
 * quand Express les a résolus, mais au moment où ce middleware s'exécute
 * ils ne le sont pas encore. On garde donc le chemin brut SANS la query
 * string (qui peut porter des données personnelles) et tronqué.
 */
export function describeRoute(req: Pick<Request, "method" | "originalUrl" | "url">): string {
  const raw = req.originalUrl || req.url || "";
  const path = raw.split("?")[0] ?? "";
  return `${req.method} ${path}`.slice(0, 256);
}

export function auditContext() {
  return (req: Request, res: Response, next: NextFunction) => {
    const ua = req.headers["user-agent"];
    const context = createAuditContext({
      correlationId: getRequestId(req),
      source: "http",
      route: describeRoute(req),
      ipAddress: typeof req.ip === "string" && req.ip.length > 0 ? req.ip : null,
      userAgent: typeof ua === "string" && ua.length > 0 ? ua.slice(0, 512) : null,
    });
    runWithAuditContext(context, () => next());
  };
}
