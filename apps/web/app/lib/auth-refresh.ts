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

export async function refreshAccessToken(): Promise<string | null> {
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
