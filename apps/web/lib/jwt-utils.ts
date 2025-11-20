/**
 * Utilitaires pour décoder et vérifier les JWT
 * Compatible avec Edge Runtime
 */

/**
 * Décode base64url (compatible Edge Runtime)
 */
function base64UrlDecode(str: string): string {
  // Convertit base64url en base64
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  
  // Ajoute le padding si nécessaire
  while (base64.length % 4) {
    base64 += "=";
  }

  // Décode avec atob (disponible dans Edge Runtime)
  try {
    return atob(base64);
  } catch (error) {
    return "";
  }
}

/**
 * Décode un JWT sans vérifier la signature (pour Edge Runtime)
 * Note: Moins sécurisé mais nécessaire pour Edge Runtime qui ne supporte pas jose
 * La vérification de signature complète est faite côté serveur dans les routes API
 */
export function decodeJWT(token: string): { sub?: string; role?: string; roles?: string[]; exp?: number } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    // Décode le payload (base64url)
    const payload = parts[1];
    const decoded = base64UrlDecode(payload);
    if (!decoded) {
      return null;
    }

    const parsed = JSON.parse(decoded);

    // Normalise les rôles pour supporter à la fois `role` simple et `roles` tableau
    if (Array.isArray(parsed.roles)) {
      parsed.roles = parsed.roles.filter(
        (r: unknown) => typeof r === "string" && r.trim() !== "",
      );
    } else if (typeof parsed.role === "string" && parsed.role.trim() !== "") {
      parsed.roles = [parsed.role.trim()];
    } else {
      parsed.roles = [];
    }

    // Vérifie l'expiration si présente
    if (parsed.exp && parsed.exp < Date.now() / 1000) {
      return null;
    }

    return parsed;
  } catch (error) {
    return null;
  }
}

/**
 * Vérifie si un token correspond à un admin (sans vérifier la signature)
 * Pour une sécurité maximale, la vérification de signature devrait être faite côté serveur
 */
export function isAdminToken(token: string): boolean {
  const payload = decodeJWT(token);
  if (!payload) return false;

  const roles: string[] = Array.isArray(payload.roles)
    ? payload.roles
    : payload.role
      ? [payload.role]
      : [];

  return roles.includes("admin");
}

