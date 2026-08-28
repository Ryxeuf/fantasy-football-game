/**
 * Champs conditionnels du formulaire d'évènement de la feuille de match.
 * Extrait de `page.tsx` : Next.js interdit tout export non-conventionnel
 * dans un fichier page, et cette logique pure doit rester importable par
 * les tests.
 */

export type EventKind =
  | "kickoff"
  | "touchdown"
  | "casualty"
  | "pass_complete"
  | "interception"
  | "aggression"
  | "expulsion"
  | "crowd_surge"
  | "stalling"
  | "team_throw"
  | "ttm_landing"
  | "special_elim"
  | "other_elim";

// A62 — seuls ces types d'évènement portent une cible (joueur adverse
// touché). Pour les autres (TD, passe, interception, lancer de
// coéquipier, expulsion, temporisation, autre élimination), le champ
// Cible est masqué.
export const TARGET_BEARING_KINDS: ReadonlySet<EventKind> = new Set([
  "casualty",
  "aggression",
  "crowd_surge",
  "special_elim",
]);

// A59/A61 — types pouvant porter une blessure : élimination sur blocage,
// agression, sortie public, autre élimination, et temporisation (blessure
// saisissable « si nécessaire », comme pour autre élimination — la
// victime est alors le joueur qui temporise).
export const INJURY_BEARING_KINDS: ReadonlySet<EventKind> = new Set([
  "casualty",
  "aggression",
  "crowd_surge",
  "other_elim",
  "special_elim",
  "stalling",
]);

// FDM — le RÉCEPTIONNEUR d'une passe réussie. Contrairement à la « Cible »
// ci-dessus, il est dans la MÊME équipe que l'acteur : c'est le coéquipier
// qui réceptionne le ballon, et donc le bénéficiaire de la Prière à Nuffle
// « Réception Étourdissante » (1 PSP par réception). Stocké dans
// `targetPlayerId`, comme la cible — les deux champs sont exclusifs.
export const RECEIVER_BEARING_KINDS: ReadonlySet<EventKind> = new Set([
  "pass_complete",
]);

/**
 * `targetPlayerId` est-il saisissable pour ce type d'évènement ? Vrai pour
 * une cible adverse comme pour un réceptionneur coéquipier — c'est la même
 * colonne, seule l'équipe proposée par le picker change.
 */
export function hasTargetField(kind: EventKind): boolean {
  return TARGET_BEARING_KINDS.has(kind) || RECEIVER_BEARING_KINDS.has(kind);
}
