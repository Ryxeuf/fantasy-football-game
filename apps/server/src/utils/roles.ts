export type UserRole = string;

/**
 * Normalise une valeur de rôle en liste de rôles.
 * - Accepte une chaîne simple ("admin")
 * - Accepte un tableau de chaînes (["user", "admin"])
 * - Accepte potentiellement une chaîne JSON encodant un tableau (future compatibilité)
 */
export function normalizeRoles(
  rolesOrRole: string | string[] | null | undefined,
): string[] {
  if (!rolesOrRole) return [];
  if (Array.isArray(rolesOrRole)) return rolesOrRole;

  const value = rolesOrRole;

  // Si la valeur ressemble à un tableau JSON, essayer de le parser
  if (value.startsWith("[") && value.endsWith("]")) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed) && parsed.every((r) => typeof r === "string")) {
        return parsed;
      }
    } catch {
      // Fallback plus bas
    }
  }

  // Fallback : un seul rôle
  return [value];
}

/**
 * Vérifie si la liste (ou valeur simple) de rôles contient un rôle donné.
 */
export function hasRole(
  rolesOrRole: string | string[] | null | undefined,
  role: string,
): boolean {
  return normalizeRoles(rolesOrRole).includes(role);
}


