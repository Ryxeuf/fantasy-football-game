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
//
// « Vol Fatal » : un atterrissage peut se faire SUR un adversaire et le
// plaquer — l'atterrissage porte donc lui aussi une cible adverse.
export const TARGET_BEARING_KINDS: ReadonlySet<EventKind> = new Set([
  "casualty",
  "aggression",
  "crowd_surge",
  "special_elim",
  "ttm_landing",
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
  // Atterrissage sur une case occupée (« Vol Fatal ») : l'adversaire
  // plaqué peut sortir.
  "ttm_landing",
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

/**
 * Rappel de règle affiché sous le sélecteur de type d'évènement.
 *
 * Les éliminations n'attribuent PAS toutes des PSP, et le coach n'a aucun
 * moyen de le deviner : il saisit une sortie, ne voit rien arriver dans les
 * PSP estimés, et croit à une perte de saisie. Chaque libellé décrit ce que
 * le summarizer fait RÉELLEMENT (`league-match-summary.ts`).
 */
export const EVENT_KIND_HINTS: Readonly<Partial<Record<EventKind, string>>> = {
  // Une sortie est une élimination qui rapporte des PSP : seul le blocage
  // (blitz compris) en est une sans condition — il n'a donc rien à dire.
  // Une agression est une agression : colonne Agr, jamais Sorties — sauf la
  // Prière à Nuffle 13 « Frénésie d’Agression », qui la qualifie en sortie.
  aggression:
    "Comptée dans les agressions, pas dans les sorties : une blessure sur agression ne rapporte aucun PSP — sauf sous la Prière « Frénésie d’Agression » (saisie en avant-match), qui en fait une sortie.",
  // E30 — règle BB S3 : une Élimination sur Action Spéciale (tronçonneuse,
  // bombe, botte…) ne rapporte rien à son auteur, sauf « Innovateur
  // Violent » qui lui rend les PSP d'Élimination.
  special_elim:
    "Aucun PSP pour l’auteur — sauf s’il a « Innovateur Violent » : il gagne alors les PSP d’Élimination (2, ou 3 en Bagarreurs Brutaux).",
  other_elim:
    "Auto-élimination (esquive ratée, chute…) : la victime est l’acteur lui-même, personne n’inflige la sortie — aucun PSP.",
  stalling:
    "La blessure éventuelle frappe le joueur qui temporise : personne ne l’inflige, aucun PSP.",
  crowd_surge:
    "Sortie infligée par le public : aucun joueur ne la revendique, donc aucun PSP — elle compte dans la colonne SP, pas dans les sorties.",
  // Règle BB S3 : atterrir sur un adversaire et le plaquer ne rapporte
  // rien… sauf au porteur de « Vol Fatal », qui touche les PSP
  // d’Élimination. L’atterrissage lui-même vaut toujours 1 PSP.
  ttm_landing:
    "1 PSP au joueur lancé. En cas d’atterrissage SUR un adversaire, renseigne la cible et sa blessure : l’Élimination ne rapporte des PSP (2, ou 3 en Bagarreurs Brutaux) que si le joueur lancé a « Vol Fatal ».",
};

/** Rappel de règle du type d'évènement, ou `null` s'il n'y a rien à dire. */
export function eventKindHint(kind: EventKind): string | null {
  return EVENT_KIND_HINTS[kind] ?? null;
}
