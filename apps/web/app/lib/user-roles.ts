/**
 * Rôles de l'utilisateur courant, côté web.
 *
 * `/auth/me` rend le rôle sous trois formes selon l'ancienneté du compte et
 * du stockage : un tableau `roles`, une chaîne `role`, ou une chaîne qui
 * encode un tableau JSON. C'est la même tolérance que
 * `utils/roles.normalizeRoles` côté serveur — la dériver à la main sur
 * chaque écran, c'est se garantir qu'un écran finira par ne reconnaître
 * qu'une des trois formes.
 *
 * Ce module ne sert qu'à l'AFFICHAGE : masquer une entrée d'interface n'est
 * pas un contrôle d'accès. L'autorisation reste celle du serveur.
 */

/** Sous-ensemble du user de `/auth/me` dont dépend la résolution des rôles. */
export interface UserRolesShape {
  readonly roles?: unknown;
  readonly role?: unknown;
}

/** Normalise `roles` / `role` en liste de rôles. */
export function normalizeUserRoles(
  user: UserRolesShape | null | undefined,
): string[] {
  if (!user) return [];

  const raw = user.roles ?? user.role;
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw.filter((r): r is string => typeof r === "string");
  }
  if (typeof raw !== "string") return [];

  // Forme sérialisée (`'["user","admin"]'`), rencontrée sur les jetons et
  // les miroirs de stockage qui aplatissent les colonnes JSON.
  if (raw.startsWith("[") && raw.endsWith("]")) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((r): r is string => typeof r === "string");
      }
    } catch {
      // Chaîne malformée : on retombe sur le rôle unique ci-dessous.
    }
  }
  return [raw];
}

/** `true` si l'utilisateur porte le rôle `admin`. */
export function isAdminUser(user: UserRolesShape | null | undefined): boolean {
  return normalizeUserRoles(user).includes("admin");
}
