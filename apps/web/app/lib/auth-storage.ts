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

/**
 * Décode le payload d'un JWT sans vérifier la signature (lecture cliente du
 * claim `exp` uniquement). Retourne null si le token est malformé. La
 * vérification cryptographique reste cote serveur — ici on veut juste savoir
 * si l'access token est périmé pour décider d'un refresh proactif.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json =
      typeof atob === "function"
        ? atob(base64)
        : Buffer.from(base64, "base64").toString("binary");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Vrai si l'access token est absent ou expiré (ou expire dans moins de
 * `skewSeconds`). Un token présent mais illisible est considéré NON expiré :
 * on laisse alors le chemin réactif (401 → refresh) gérer le cas plutôt que de
 * déclencher un refresh inutile à chaque montage.
 */
export function isAccessTokenExpired(skewSeconds = 30): boolean {
  const token = getAuthToken();
  if (!token) return true;
  const payload = decodeJwtPayload(token);
  const exp =
    payload && typeof payload.exp === "number" ? (payload.exp as number) : null;
  if (exp === null) return false;
  return Date.now() / 1000 >= exp - skewSeconds;
}
