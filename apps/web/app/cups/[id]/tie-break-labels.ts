/**
 * Libellés des critères de départage d'une coupe.
 *
 * Les slugs sont un CONTRAT avec le serveur (`services/cup-standings-order`) :
 * c'est lui qui trie, l'écran ne fait que nommer. Un slug inconnu du
 * dictionnaire (serveur en avance sur le client) s'affiche tel quel plutôt
 * que de disparaître — le coach doit voir qu'un critère existe même sans son
 * libellé.
 */
export const CUP_TIE_BREAK_LABELS: Readonly<Record<string, string>> = {
  points: "Points",
  result_points: "Points de résultat",
  action_points: "Points d'action",
  wins: "Victoires",
  td_diff: "Différence de TD",
  td_for: "TD marqués",
  td_against: "TD encaissés (le moins)",
  cas_diff: "Différence de sorties",
  cas_for: "Sorties infligées",
  cas_against: "Sorties subies (le moins)",
  passes: "Passes réussies",
  played: "Matchs joués",
  name: "Nom de l'équipe",
};

/** Ordre proposé dans l'éditeur (le plus courant en tête). */
export const CUP_TIE_BREAK_ORDER: readonly string[] = [
  "points",
  "td_diff",
  "td_for",
  "wins",
  "cas_for",
  "cas_diff",
  "td_against",
  "cas_against",
  "result_points",
  "action_points",
  "passes",
  "played",
  "name",
];
