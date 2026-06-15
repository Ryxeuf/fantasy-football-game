/**
 * Rafraichissement silencieux du token d'acces (S24.3).
 *
 * Le serveur emet un access token de 15 minutes + un refresh token de 7 jours
 * (rotatif). Cette fonction echange un refresh token contre une nouvelle paire
 * et met a jour le localStorage + le cookie httpOnly.
 *
 * Retourne le nouvel access token en cas de succes, null sinon (refresh
 * absent, rotation rejetee, reseau down). En cas d'echec, les tokens sont
 * effaces : la session est consideree perdue.
 */

import { API_BASE } from "../auth-client";
import { syncAuthCookie, clearAuthCookie } from "./auth-cookie";
import {
  clearAuthTokens,
  getRefreshToken,
  setAuthTokens,
} from "./auth-storage";

export interface RefreshResponse {
  token: string;
  refreshToken: string;
}

/**
 * Refresh en cours partagé (single-flight). Les appelants concurrents
 * (AuthBar, AuthRefreshLoop, apiRequest) réutilisent la même requête tant
 * qu'elle n'est pas résolue.
 *
 * C'est une protection critique : le serveur fait tourner le refresh token
 * avec détection de réuse qui révoque TOUTES les sessions de l'utilisateur si
 * le même refresh token est présenté deux fois. Deux refresh concurrents (ex:
 * AuthBar + AuthRefreshLoop au montage) déconnecteraient donc l'utilisateur.
 * Le single-flight garantit une seule rotation à la fois.
 */
let inFlightRefresh: Promise<string | null> | null = null;

export function refreshAccessToken(): Promise<string | null> {
  if (inFlightRefresh) return inFlightRefresh;
  inFlightRefresh = performRefresh().finally(() => {
    inFlightRefresh = null;
  });
  return inFlightRefresh;
}

async function performRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      // 401 = reuse detecte ou token invalide. On force le logout local.
      if (res.status === 401 || res.status === 403) {
        clearAuthTokens();
        await clearAuthCookie();
      }
      return null;
    }

    const data = (await res.json()) as Partial<RefreshResponse>;
    if (!data.token || !data.refreshToken) return null;

    setAuthTokens({ token: data.token, refreshToken: data.refreshToken });
    await syncAuthCookie(data.token);
    return data.token;
  } catch {
    return null;
  }
}
