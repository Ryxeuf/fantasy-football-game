/**
 * Helpers cote client pour synchroniser le cookie auth_token httpOnly
 * via les routes serveur dediees (S24.1).
 *
 * Le cookie etant httpOnly, JavaScript ne peut plus le lire ni
 * l'ecrire directement via `document.cookie`. Toutes les operations
 * passent donc par /api/sync-auth-cookie et /api/clear-auth-cookie.
 */

export async function syncAuthCookie(token: string): Promise<boolean> {
  try {
    const res = await fetch("/api/sync-auth-cookie", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
      credentials: "same-origin",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function clearAuthCookie(): Promise<boolean> {
  try {
    const res = await fetch("/api/clear-auth-cookie", {
      method: "POST",
      credentials: "same-origin",
    });
    return res.ok;
  } catch {
    return false;
  }
}
