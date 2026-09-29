/**
 * Appel à l'action principal du hero de la home (pur, testable sans DOM).
 *
 * Un visiteur déconnecté est envoyé sur l'INSCRIPTION (qui le ramène ensuite
 * à ses équipes) : l'envoyer sur `/me/teams` le faisait atterrir sur une
 * page de connexion sans contexte. Un coach reconnu va droit à ses équipes.
 */

export const TEAMS_HOME_PATH = "/me/teams";

export interface HeroCta {
  readonly href: string;
  readonly labelKey: "manageTeams" | "ctaCreateTeam";
}

export function heroPrimaryCta(isCoach: boolean): HeroCta {
  if (isCoach) return { href: TEAMS_HOME_PATH, labelKey: "manageTeams" };
  return {
    href: `/register?redirect=${encodeURIComponent(TEAMS_HOME_PATH)}`,
    labelKey: "ctaCreateTeam",
  };
}

/** Lien « Déjà un compte ? » du hero, avec retour aux équipes après connexion. */
export function heroLoginHref(): string {
  return `/login?redirect=${encodeURIComponent(TEAMS_HOME_PATH)}`;
}
