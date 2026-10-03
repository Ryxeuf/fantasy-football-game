/**
 * Lien de la fiche d'équipe vers la compétition dans laquelle elle est
 * engagée (coupe, ou saison de ligue active).
 *
 * Le serveur sert `team.competition` (cf. `getTeamsEngagement`) ; ce module
 * pur en tire la cible et le libellé, testable sans DOM. Un engagement sans
 * id (API antérieure au champ) ne produit pas de lien plutôt qu'un lien
 * cassé.
 */

export interface TeamCompetition {
  readonly kind: "cup" | "league";
  readonly name: string;
  /** Id de la coupe, ou de la ligue. Optionnel pour rétro-compat. */
  readonly competitionId?: string;
  readonly seasonId?: string;
}

export interface CompetitionLink {
  readonly href: string;
  readonly kind: "cup" | "league";
  readonly name: string;
}

export function competitionLink(
  competition: TeamCompetition | null | undefined,
): CompetitionLink | null {
  if (!competition?.competitionId) return null;
  if (competition.kind !== "cup" && competition.kind !== "league") return null;
  const id = encodeURIComponent(competition.competitionId);
  return {
    href: competition.kind === "cup" ? `/cups/${id}` : `/leagues/${id}`,
    kind: competition.kind,
    name: competition.name,
  };
}
