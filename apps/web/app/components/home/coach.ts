/**
 * Type + helpers partagés autour du coach connecté.
 *
 * Extrait de `CoachDashboard.tsx` pour que la home marketing et l'accueil
 * racine puissent dériver le nom d'affichage du coach sans importer tout le
 * composant tableau de bord (page la plus sensible SEO/perf).
 */

/** Sous-ensemble du user exposé par `/auth/me` dont le dashboard a besoin. */
export interface CoachUser {
  readonly id: string;
  readonly email?: string;
  readonly name?: string | null;
  readonly coachName?: string | null;
  readonly firstName?: string | null;
  readonly _count?: {
    readonly teams?: number;
    readonly matches?: number;
    readonly createdLocalMatches?: number;
  } | null;
}

/** Nom d'affichage du coach : coachName > name > firstName > email (local part). */
export function coachDisplayName(user: CoachUser): string | null {
  const candidate =
    user.coachName?.trim() ||
    user.name?.trim() ||
    user.firstName?.trim() ||
    user.email?.split("@")[0]?.trim() ||
    "";
  return candidate.length > 0 ? candidate : null;
}
