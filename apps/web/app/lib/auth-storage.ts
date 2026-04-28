/**
 * Helpers de persistance des tokens d'authentification (S24.3).
 *
 * Le couple access/refresh remplace le token unique 7j historique :
 * - access ("auth_token") : 15 min, envoye dans l'en-tete Authorization
 * - refresh ("auth_refresh_token") : 7 jours, utilise pour rotation silencieuse
 *
 * Tous les helpers sont safe en SSR : ils renvoient null/no-op si window est
 * absent.
 */

const ACCESS_KEY = "auth_token";
const REFRESH_KEY = "auth_refresh_token";

function hasWindow(): boolean {
  return typeof window !== "undefined";
}

export function getAuthToken(): string | null {
  if (!hasWindow()) return null;
  return window.localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (!hasWindow()) return null;
  return window.localStorage.getItem(REFRESH_KEY);
}

export function setAuthTokens(params: {
  token: string;
  refreshToken?: string | null;
}): void {
  if (!hasWindow()) return;
  window.localStorage.setItem(ACCESS_KEY, params.token);
  if (params.refreshToken) {
    window.localStorage.setItem(REFRESH_KEY, params.refreshToken);
  }
}

export function clearAuthTokens(): void {
  if (!hasWindow()) return;
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
}
