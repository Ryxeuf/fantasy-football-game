/**
 * Quelles Ligues régionales afficher sur le roster d'une équipe.
 *
 * Un ROSTER peut ouvrir plusieurs Ligues (les Nordiques en ont trois), mais
 * une ÉQUIPE n'en retient qu'UNE à sa création : elle seule débloque ses
 * Star Players et ses Coups de Pouce (cf. `effectiveRegionalRules` côté
 * serveur). La page montrait les autres barrées, ce qui laissait croire à
 * un choix perdu plutôt qu'à un choix jamais fait.
 *
 * PUR : la page passe la liste servie par l'API et le slug retenu.
 */

export interface RegionalLeagueOption {
  readonly slug: string;
  readonly name: string;
}

/**
 * Ligues à afficher.
 *
 * - un choix enregistré ⇒ cette Ligue SEULE ;
 * - aucun choix (équipe antérieure à la règle) ⇒ toutes celles du roster,
 *   qui restent effectivement toutes actives pour elle ;
 * - un choix que le roster ne propose plus (Ligue renommée ou retirée du
 *   catalogue) ⇒ toutes, plutôt qu'une section vide.
 */
export function displayedRegionalLeagues<T extends RegionalLeagueOption>(
  leagues: readonly T[],
  chosenSlug: string | null | undefined,
): T[] {
  if (!chosenSlug) return [...leagues];
  const chosen = leagues.filter((l) => l.slug === chosenSlug);
  return chosen.length > 0 ? chosen : [...leagues];
}
