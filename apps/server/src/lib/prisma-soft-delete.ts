/**
 * Lot P.A.2 — Helpers Prisma pour le filtrage des users soft-deleted.
 *
 * Pattern :
 *   await prisma.user.findMany({ where: { ...whereActiveUser(), ... } })
 *
 * Convention :
 *  - Les chemins **public-facing** (profil public, recherche coach,
 *    friendship, leaderboard public) doivent appliquer `whereActiveUser`
 *    pour masquer les comptes supprimes.
 *  - Les chemins **admin** ne l'appliquent PAS — un admin doit pouvoir
 *    voir / restaurer un compte supprime.
 *  - Les chemins **systeme/historique** (audit log, replays mining, ELO
 *    snapshots) ne l'appliquent PAS non plus : les references doivent
 *    rester resolvables meme apres suppression.
 *
 * Inversement, pour lister explicitement les comptes supprimes :
 *  - `whereDeletedUser()` retourne `{ deletedAt: { not: null } }`.
 *
 * Pour matcher "indifferent" (admin n'a pas besoin de filtre) : ne pas
 * appeler ce helper ; passer un `where` vide.
 */

/**
 * Retourne un fragment `where` Prisma qui exclut les comptes supprimes.
 *
 * Usage :
 *   await prisma.user.findUnique({ where: { ...whereActiveUser(), id } })
 *
 * Note : si le `where` racine d'un `findUnique` contient plusieurs cles
 * non-unique, Prisma exige un wrapper `findFirst`. Pour `findUnique`
 * sur un champ unique (id, email), appliquer ce filtre directement
 * sur `findFirst` est plus simple.
 */
export function whereActiveUser(): { deletedAt: null } {
  return { deletedAt: null };
}

/**
 * Inverse : ne retourne que les comptes soft-deleted. Utilise par les
 * jobs admin (purge GDPR, liste des comptes supprimes pour le support).
 */
export function whereDeletedUser(): { deletedAt: { not: null } } {
  return { deletedAt: { not: null } };
}

/**
 * Test predicate : true si le user passe est actuellement actif (non
 * soft-deleted). Utilise pour les checks runtime (login, profile lookup).
 */
export function isActiveUser(user: { deletedAt?: Date | null } | null): boolean {
  return user !== null && (user.deletedAt === null || user.deletedAt === undefined);
}
