/**
 * Enveloppe `ApiResponse<T>` standardisée pour toutes les routes API
 * (tâche O.6 — Sprint 22+).
 *
 * Format unique :
 *   succès : `{ success: true, data: T, meta?: { total, page, limit } }`
 *   erreur : `{ success: false, error: string }`
 *
 * Utiliser `sendSuccess` / `sendError` plutôt que de construire l'objet
 * manuellement, et brancher `apiErrorHandler` en bout de chaîne Express
 * pour convertir automatiquement les `throw` en réponses standardisées.
 */

import type { Request, Response, NextFunction } from "express";

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: ApiMeta;
}

export interface ApiError {
  success: false;
  error: string;
}

export interface ApiMeta {
  total: number;
  page: number;
  limit: number;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

/** Construit une réponse de succès. */
export function apiSuccess<T>(data: T, meta?: ApiMeta): ApiSuccess<T> {
  if (meta) return { success: true, data, meta };
  return { success: true, data };
}

/** Construit une réponse d'erreur. */
export function apiError(message: string): ApiError {
  return { success: false, error: message };
}

/** Type guard : vrai si la réponse est un succès. */
export function isApiSuccess<T>(r: ApiResponse<T>): r is ApiSuccess<T> {
  return r.success === true;
}

/** Type guard : vrai si la réponse est une erreur. */
export function isApiError<T>(r: ApiResponse<T>): r is ApiError {
  return r.success === false;
}

/** Envoie une réponse de succès via Express. Status par défaut : 200. */
export function sendSuccess<T>(
  res: Response,
  data: T,
  status: number = 200,
  meta?: ApiMeta,
): Response {
  return res.status(status).json(apiSuccess(data, meta));
}

/** Envoie une réponse d'erreur via Express. Status par défaut : 500. */
export function sendError(
  res: Response,
  message: string,
  status: number = 500,
): Response {
  return res.status(status).json(apiError(message));
}

/**
 * Middleware de gestion d'erreur Express. À placer en dernier dans la chaîne :
 *
 *   app.use(apiErrorHandler);
 *
 * Tout `throw new Error(...)` (ou `next(err)`) est converti en
 * `ApiResponse<never>` au format standardisé. Si l'erreur porte un champ
 * `status` (number), il est utilisé comme code HTTP.
 */
export function apiErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  let message = "Erreur serveur";
  let status = 500;

  if (err instanceof Error) {
    message = err.message || message;
    const errStatus = (err as { status?: unknown }).status;
    if (typeof errStatus === "number" && errStatus >= 100 && errStatus < 600) {
      status = errStatus;
    }
  }

  sendError(res, message, status);
}
