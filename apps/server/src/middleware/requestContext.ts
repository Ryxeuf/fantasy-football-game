/**
 * Middleware de corrélation de requête (tâche S25.1 — Sprint 25).
 *
 * Pour chaque requête HTTP :
 *   - Lit `X-Request-Id` (string UUID/hex/segment classique) ou en génère
 *     un si absent / malformé.
 *   - Expose `req.requestId` et `req.log` (logger pino enfant lié à
 *     `{ requestId, method, url }`) pour que tout le code aval puisse
 *     logger en contexte sans repasser le requestId.
 *   - Réémet l'id sur la réponse via `X-Request-Id` pour faciliter la
 *     correlation client/serveur en cas de support / debug.
 *   - Si `logFinish=true`, écrit une ligne récapitulative à la fin de
 *     chaque requête avec `{ statusCode, durationMs }`. Désactivé par
 *     défaut pour ne pas dupliquer `requestTiming`.
 */

import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";

import { defaultPinoLogger } from "../utils/pino-logger";

export const REQUEST_ID_HEADER = "x-request-id";

// Format accepté pour un `x-request-id` fourni par le client. On reste
// permissif (UUID, hex de 16+, segments alphanum/`-`/`_` jusqu'à 128
// caractères) tout en bloquant les payloads d'injection (HTML, espace,
// retours chariot).
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export interface PinoChild {
  info: (obj: Record<string, unknown>, msg?: string) => void;
  warn: (obj: Record<string, unknown>, msg?: string) => void;
  error: (obj: Record<string, unknown>, msg?: string) => void;
  debug: (obj: Record<string, unknown>, msg?: string) => void;
  trace: (obj: Record<string, unknown>, msg?: string) => void;
}

interface PinoLike extends PinoChild {
  child: (bindings: Record<string, unknown>) => PinoChild;
}

/**
 * Récupère le `requestId` exposé par `requestContext` sur la requête.
 * Wrapper typé pour éviter d'augmenter la déclaration globale d'Express
 * (pino-http augmente déjà `req.log`, et conflit de types sinon).
 */
export function getRequestId(req: Request): string | undefined {
  return (req as Request & { requestId?: string }).requestId;
}

export function getRequestLog(req: Request): PinoChild | undefined {
  return (req as Request & { log?: PinoChild }).log;
}

export interface RequestContextOptions {
  /** Logger pino racine (override pour les tests). */
  baseLogger?: PinoLike;
  /**
   * Si vrai, log une ligne `{ statusCode, durationMs }` à la fin de la
   * requête. Désactivé par défaut car `requestTiming` couvre déjà ce
   * besoin en attendant la migration complète vers pino-http.
   */
  logFinish?: boolean;
}

function pickRequestId(headerValue: unknown): string | null {
  if (typeof headerValue !== "string") return null;
  if (!REQUEST_ID_PATTERN.test(headerValue)) return null;
  return headerValue;
}

export function requestContext(options: RequestContextOptions = {}) {
  const baseLogger =
    (options.baseLogger as PinoLike | undefined) ??
    (defaultPinoLogger as unknown as PinoLike);
  const logFinish = options.logFinish ?? false;

  return (req: Request, res: Response, next: NextFunction) => {
    const incoming = pickRequestId(req.headers[REQUEST_ID_HEADER]);
    const requestId = incoming ?? randomUUID();
    const child = baseLogger.child({
      requestId,
      method: req.method,
      url: req.originalUrl || req.url,
    });

    // Cast unique pour eviter d'augmenter Express globalement (conflit
    // potentiel avec pino-http qui declare son propre `req.log` avec un
    // Logger pino complet vs. notre interface lite).
    const augmented = req as unknown as {
      requestId: string;
      log: PinoChild;
    };
    augmented.requestId = requestId;
    augmented.log = child;

    res.setHeader(REQUEST_ID_HEADER, requestId);

    if (logFinish) {
      const startedAt = process.hrtime.bigint();
      res.on("finish", () => {
        const durationMs =
          Number(process.hrtime.bigint() - startedAt) / 1_000_000;
        child.info({
          statusCode: res.statusCode,
          durationMs: Math.round(durationMs * 10) / 10,
          requestId,
        });
      });
    }

    next();
  };
}
