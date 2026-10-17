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
    /**
     * Rencontres de coupe des équipes du coach qu'il n'a pas créées (la
     * feuille validée les matérialise au nom du commissaire). Optionnel :
     * absent d'une API antérieure.
     */
    readonly cupMatchesPlayed?: number;
  } | null;
}

/**
 * « Matchs suivis » de l'accueil : parties en ligne et feuilles de ligue
 * (`matches`), matchs locaux créés, et rencontres de coupe de ses équipes —
 * ces dernières n'entraient dans aucun compteur du coach.
 */
export function coachMatchesTracked(user: CoachUser): number {
  const counts = user._count;
  return (
    (counts?.matches ?? 0) +
    (counts?.createdLocalMatches ?? 0) +
    (counts?.cupMatchesPlayed ?? 0)
  );
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
