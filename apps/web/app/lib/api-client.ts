/**
 * Client API web (tâche S25.5b — Sprint 25).
 *
 * Helper centralise pour consommer l'API serveur en gerant l'enveloppe
 * `ApiResponse<T>` (`{ success, data, error }`) progressivement adoptee
 * depuis O.6 / S25.5. Tolere les endpoints legacy qui retournent encore
 * le body brut (`{ leagues: [...] }`, `{ error: "..." }`) le temps que la
 * migration soit complete.
 *
 * Avant S25.5, chaque page reimplementait son propre `fetch + parse` et
 * dupliquait le branchement de `Authorization: Bearer ...`. Cette
 * duplication etait la cause de la migration en plusieurs slices : on
 * consolide d'abord, on migre les consommateurs ensuite.
 */

import { API_BASE } from "../auth-client";

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: { total: number; page: number; limit: number };
}

export interface ApiError {
  success: false;
  error: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

/** Erreur thrown par `apiRequest` ; expose le statut HTTP quand disponible. */
export class ApiClientError extends Error {
  public readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
  }
}

/** Type guard : vrai si le body est une `ApiResponse<T>` valide. */
export function isApiResponse(body: unknown): body is ApiResponse<unknown> {
  if (body === null || typeof body !== "object") return false;
  const v = body as { success?: unknown };
  return typeof v.success === "boolean";
}

/**
 * Parse un body JSON en respectant l'enveloppe `ApiResponse<T>` quand
 * elle est presente, ou en retombant sur le format legacy quand l'endpoint
 * n'a pas encore ete migre.
 *
 * - Body enveloppe success : retourne `data`
 * - Body enveloppe error   : throw `ApiClientError(error)`
 * - Body legacy + ok=true  : retourne le body brut
 * - Body legacy + ok=false : throw `ApiClientError(body.error || "...")`
 */
export function parseApiBody<T>(body: unknown, ok: boolean): T {
  if (isApiResponse(body)) {
    if (body.success) return body.data as T;
    throw new ApiClientError(body.error || "Erreur inconnue");
  }

  if (!ok) {
    const legacyError =
      body !== null && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : "Erreur inconnue";
    throw new ApiClientError(legacyError);
  }

  return body as T;
}

function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = window.localStorage.getItem("auth_token");
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

/**
 * Lance un appel HTTP vers l'API serveur et unwrap l'enveloppe
 * `ApiResponse<T>` quand disponible. Compatible avec les endpoints
 * legacy en attendant que toutes les routes soient migrees.
 *
 * @example
 *   const flags = await apiRequest<string[]>("/api/feature-flags/me");
 */
export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(init.headers ?? {}),
    },
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Body non-JSON (rare en pratique, ex: 502 derriere Traefik). On
    // retombe sur le code HTTP pour produire un message generique.
    if (!response.ok) {
      throw new ApiClientError(`HTTP ${response.status}`, response.status);
    }
  }

  try {
    return parseApiBody<T>(body, response.ok);
  } catch (e) {
    if (e instanceof ApiClientError) {
      throw new ApiClientError(e.message, response.status);
    }
    throw e;
  }
}
