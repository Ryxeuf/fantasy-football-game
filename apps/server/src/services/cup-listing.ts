/**
 * Filtre Prisma du listing `GET /cup` (pur, testable sans base).
 *
 * Une coupe PUBLIQUE reste listée pendant toute sa vie (ouverte, en cours,
 * terminée) : auparavant seules les coupes `ouverte` l'étaient, si bien
 * qu'une coupe publique disparaissait de `/cups` dès sa validation — y
 * compris pour son créateur s'il n'y avait pas inscrit d'équipe. La fiche
 * `GET /cup/:id` la servait pourtant à tout le monde.
 *
 * Les coupes archivées ont leur propre écran (`/cups/archived`). Les coupes
 * privées ne sont listées que pour leur créateur et leurs participants.
 */
export interface CupListFilterInput {
  readonly userId: string;
  readonly userTeamIds: readonly string[];
  /** Vue admin : toutes les coupes, archivées comprises. */
  readonly showAll: boolean;
}

export function buildCupListWhere(input: CupListFilterInput) {
  if (input.showAll) return {};
  const visibility: Array<Record<string, unknown>> = [
    { isPublic: true },
    { creatorId: input.userId },
  ];
  if (input.userTeamIds.length > 0) {
    visibility.push({
      participants: { some: { teamId: { in: [...input.userTeamIds] } } },
    });
  }
  return { status: { not: "archivee" }, OR: visibility };
}
