/**
 * Construction du filtre Prisma de la liste d'équipes admin
 * (`GET /admin/teams`).
 *
 * Extrait de la route pour être testable sans Prisma : c'est ici que vit la
 * règle « une équipe supprimée ne s'affiche pas par défaut ». La liste admin
 * mélangeait équipes vivantes et équipes soft-deletées sans les distinguer —
 * un coach qui supprimait son équipe la laissait dans la console admin comme
 * si de rien n'était.
 *
 * Le filtre a TROIS états plutôt qu'un booléen : `active` (défaut) masque les
 * supprimées, `deleted` ne montre QU'ELLES (c'est ce mode qui rend la
 * restauration accessible), `all` sert aux recherches transverses.
 */

/** Périmètre de suppression demandé par la console. */
export type AdminTeamsDeletedScope = "active" | "deleted" | "all";

export const ADMIN_TEAMS_DELETED_SCOPES: readonly AdminTeamsDeletedScope[] = [
  "active",
  "deleted",
  "all",
];

/** Entrées de filtre, déjà validées par `adminTeamsQuerySchema`. */
export interface AdminTeamsFilters {
  readonly search?: string;
  readonly roster?: string;
  readonly ownerId?: string;
  readonly ruleset?: string;
  readonly deleted?: AdminTeamsDeletedScope;
}

/** Clause `where` Prisma, volontairement structurelle (testable telle quelle). */
export interface AdminTeamsWhere {
  name?: { contains: string; mode?: "insensitive" };
  roster?: string;
  ownerId?: string;
  ruleset?: string;
  deletedAt?: null | { not: null };
}

/**
 * `where` Prisma pour la liste admin.
 *
 * `caseInsensitiveSearch` : PostgreSQL accepte `mode: "insensitive"`, pas le
 * miroir SQLite des tests — l'appelant tranche selon `TEST_SQLITE`.
 */
export function buildAdminTeamsWhere(
  filters: AdminTeamsFilters,
  caseInsensitiveSearch: boolean,
): AdminTeamsWhere {
  const where: AdminTeamsWhere = {};

  if (filters.search) {
    where.name = {
      contains: filters.search,
      ...(caseInsensitiveSearch ? { mode: "insensitive" as const } : {}),
    };
  }
  if (filters.roster) where.roster = filters.roster;
  if (filters.ownerId) where.ownerId = filters.ownerId;
  if (filters.ruleset) where.ruleset = filters.ruleset;

  // Défaut volontaire : sans paramètre, la console ne montre QUE les équipes
  // vivantes. `all` n'ajoute aucune contrainte.
  const scope: AdminTeamsDeletedScope = filters.deleted ?? "active";
  if (scope === "active") where.deletedAt = null;
  else if (scope === "deleted") where.deletedAt = { not: null };

  return where;
}
