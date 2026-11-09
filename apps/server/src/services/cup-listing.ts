/**
 * Filtres Prisma des listings de coupes (purs, testables sans base).
 *
 * Une coupe PUBLIQUE reste listée pendant toute sa vie (ouverte, en cours,
 * terminée) : auparavant seules les coupes `ouverte` l'étaient, si bien
 * qu'une coupe publique disparaissait de `/cups` dès sa validation — y
 * compris pour son créateur s'il n'y avait pas inscrit d'équipe. La fiche
 * `GET /cup/:id` la servait pourtant à tout le monde.
 *
 * Les coupes archivées ont leur propre écran (`/cups/archived`). Les coupes
 * privées ne sont listées que pour les coupes « à moi » (créateur ou équipe
 * inscrite, `cupMineWhere`) — équipe supprimée comprise : le filtre suit la
 * relation `team.ownerId` au lieu de pré-charger les équipes NON supprimées
 * du coach, qui effaçait l'historique au premier ménage de ses équipes.
 */

import { cupMineWhere, type CompetitionScope } from "./competition-membership";

export interface CupListFilterInput {
  readonly userId: string;
  /** Vue admin : toutes les coupes, archivées comprises. */
  readonly showAll: boolean;
  /** `mine` : les seules coupes « à moi ». Défaut `all`. */
  readonly scope?: CompetitionScope;
}

/**
 * Visibilité d'une coupe dans le listing général : publiques + « à moi ».
 * Composée À PARTIR de la règle « à moi » : « à moi ⊆ visible ».
 */
export function cupVisibleClauses(
  userId: string,
): Array<Record<string, unknown>> {
  return [{ isPublic: true }, ...cupMineWhere(userId).OR];
}

export function buildCupListWhere(input: CupListFilterInput) {
  if (input.scope === "mine") {
    // Pas de clause de visibilité : « à moi » y est inclus. La vue admin
    // garde ses archivées.
    const mine = cupMineWhere(input.userId);
    return input.showAll ? mine : { status: { not: "archivee" }, ...mine };
  }
  if (input.showAll) return {};
  return { status: { not: "archivee" }, OR: cupVisibleClauses(input.userId) };
}

/** `GET /cup/archived` : les coupes archivées « à moi » (jamais celles des autres). */
export function buildArchivedCupListWhere(userId: string) {
  return { status: "archivee", ...cupMineWhere(userId) };
}
