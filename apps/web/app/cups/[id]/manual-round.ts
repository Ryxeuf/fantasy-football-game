/**
 * Composition d'une ronde à la main (logique PURE, sans React).
 *
 * Le commissaire empile des rencontres « domicile vs extérieur » ; une
 * rencontre sans adversaire déclare l'équipe EXEMPTE. Le serveur revalide
 * tout (`buildManualRound`), mais l'écran doit pouvoir dire tout de suite ce
 * qui ne va pas plutôt que de laisser envoyer une ronde qui sera refusée.
 *
 * Extrait du composant pour être testable sans DOM.
 */

export const CUP_ROUND_SYSTEMS = ["random", "swiss", "manual"] as const;
export type CupRoundSystem = (typeof CUP_ROUND_SYSTEMS)[number];

/** Une ligne du formulaire. `""` = case encore vide. */
export interface ManualPairingDraft {
  readonly homeTeamId: string;
  /** `""` = pas encore choisi, `null` = exempte. */
  readonly awayTeamId: string | null;
}

/** Corps envoyé à `POST /cup/:id/rounds` en mode manuel. */
export interface ManualPairingPayload {
  readonly homeTeamId: string;
  readonly awayTeamId: string | null;
}

/**
 * `true` si une équipe apparaît deux fois — c'est le seul cas que l'écran
 * peut détecter seul (les autres refus dépendent de la liste des inscrits
 * côté serveur). Les cases vides sont ignorées : elles ne sont pas encore
 * une erreur, juste une saisie en cours.
 */
export function hasDuplicateTeam(
  pairings: readonly ManualPairingDraft[],
): boolean {
  const seen = new Set<string>();
  for (const p of pairings) {
    for (const id of [p.homeTeamId, p.awayTeamId]) {
      if (!id) continue;
      if (seen.has(id)) return true;
      seen.add(id);
    }
  }
  return false;
}

/**
 * Met la saisie en forme pour l'API : les lignes sans équipe à domicile
 * sont écartées (rien à envoyer), et une case « extérieur » vide vaut
 * exempte — c'est le sens du choix « — Exempte — » de la liste.
 */
export function toManualPairingsPayload(
  pairings: readonly ManualPairingDraft[],
): ManualPairingPayload[] {
  return pairings
    .filter((p) => Boolean(p.homeTeamId))
    .map((p) => ({
      homeTeamId: p.homeTeamId,
      awayTeamId: p.awayTeamId ? p.awayTeamId : null,
    }));
}

/**
 * Équipes encore disponibles pour une ligne donnée : toutes celles qui ne
 * sont pas déjà engagées ailleurs dans la ronde, plus celle déjà choisie sur
 * cette case (sinon le `<select>` afficherait une valeur absente de ses
 * options, et React la remplacerait silencieusement).
 */
export function availableTeams<T extends { id: string }>(
  teams: readonly T[],
  pairings: readonly ManualPairingDraft[],
  keep: string | null,
): T[] {
  const taken = new Set<string>();
  for (const p of pairings) {
    if (p.homeTeamId) taken.add(p.homeTeamId);
    if (p.awayTeamId) taken.add(p.awayTeamId);
  }
  if (keep) taken.delete(keep);
  return teams.filter((t) => !taken.has(t.id));
}
