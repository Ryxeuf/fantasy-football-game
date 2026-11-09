/**
 * « Toutes / Les miennes » sur les listes de compétitions (change OpenSpec
 * `my-competitions`) — règles pures, partagées par `/leagues`,
 * `/leagues/archived` et `/cups`.
 *
 * Le choix vit dans l'URL (`?scope=mine`) : il survit au rechargement, au
 * bouton retour et au partage d'un lien. Le filtrage est fait par le
 * SERVEUR (`GET /leagues?scope=mine`, `GET /cup?scope=mine`) : la liste des
 * ligues est paginée, un filtre client ne trierait que la page courante.
 */

export type CompetitionScope = "all" | "mine";

/** Valeur d'URL → scope. Absente ou inconnue : « Toutes » (le défaut). */
export function parseCompetitionScope(
  raw: string | null | undefined,
): CompetitionScope {
  return raw === "mine" ? "mine" : "all";
}

/**
 * Query string à écrire pour un scope, en conservant les autres paramètres.
 * « Toutes » étant le défaut, il RETIRE `scope` de l'URL plutôt que d'écrire
 * `scope=all`.
 */
export function withCompetitionScope(
  current: string,
  scope: CompetitionScope,
): string {
  const params = new URLSearchParams(current);
  if (scope === "mine") params.set("scope", "mine");
  else params.delete("scope");
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Rôle du lecteur servi par l'API (`viewerRoles`). OPTIONNEL côté écran :
 * le web peut partir avant le serveur (cartes sans badge).
 */
export interface ViewerRoles {
  readonly commissioner: boolean;
  readonly participant: "active" | "withdrawn" | "former" | null;
  readonly teams: ReadonlyArray<{ readonly id: string; readonly name: string }>;
}

/** Badges à afficher, dans l'ordre (aucun pour un tiers ou un champ absent). */
export type ViewerRoleBadge = "commissioner" | "active" | "withdrawn" | "former";

export function viewerRoleBadges(
  roles: ViewerRoles | null | undefined,
): ViewerRoleBadge[] {
  if (!roles) return [];
  const out: ViewerRoleBadge[] = [];
  if (roles.commissioner) out.push("commissioner");
  if (roles.participant) out.push(roles.participant);
  return out;
}
