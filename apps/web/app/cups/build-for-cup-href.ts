/**
 * Lien « Construire une équipe pour cette coupe » (`/me/teams/new?cupId=…`).
 *
 * Le builder retrouve seul la config de la coupe (`GET /cup/:id`), mais il ne
 * la reçoit qu'APRÈS un aller-retour réseau : entre-temps il affiche les
 * budgets par défaut. Poser le règlement de tournoi dès l'URL évite ce
 * clignotement — et rend le lien lisible (on voit à quoi on s'engage).
 *
 * Pur : aucune dépendance React, testable tel quel.
 */

/** Ce que le lien a besoin de savoir d'une coupe. */
export interface CupForBuildHref {
  readonly id: string;
  readonly ruleset: string;
  readonly format?: string | null;
  /** Règlement de tournoi imposé aux équipes, `null`/absent si aucun. */
  readonly tournamentRuleset?: string | null;
}

/**
 * URL du builder pour cette coupe. `fromTeamId` clone une équipe existante
 * (bouton « Adapter à la coupe »).
 */
export function buildForCupHref(
  cup: CupForBuildHref,
  fromTeamId?: string | null,
): string {
  const params = new URLSearchParams({
    cupId: cup.id,
    ruleset: cup.ruleset,
    format: cup.format ?? "bb11",
  });
  if (cup.tournamentRuleset) {
    params.set("tournamentRuleset", cup.tournamentRuleset);
  }
  if (fromTeamId) params.set("fromTeamId", fromTeamId);
  return `/me/teams/new?${params.toString()}`;
}
