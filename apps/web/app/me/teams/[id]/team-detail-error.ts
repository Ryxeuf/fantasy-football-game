/**
 * Décision d'affichage de la bannière d'erreur de chargement d'équipe.
 *
 * Le détail d'équipe se charge parfois deux fois (redirection `?welcome=1`
 * post-création + 404 transitoire en read-after-write). Une exécution périmée
 * qui échoue ne doit pas afficher « Introuvable » alors qu'une autre a déjà
 * chargé l'équipe : on ne montre l'erreur que si AUCUNE équipe n'est dispo.
 */
export function shouldShowTeamLoadError(
  error: string | null | undefined,
  hasTeam: boolean,
): boolean {
  return Boolean(error) && !hasTeam;
}
