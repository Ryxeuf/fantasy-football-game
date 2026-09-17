/**
 * Libellés et catalogue des critères de classement d'une LIGUE.
 *
 * Les slugs sont un CONTRAT avec le serveur
 * (`services/league-standings-order`) : c'est lui qui trie, l'écran ne fait
 * que nommer. Un slug inconnu du dictionnaire (serveur en avance sur le
 * client) s'affiche tel quel plutôt que de disparaître.
 *
 * Les libellés reprennent les en-têtes du tableau de classement (Pts, Bo,
 * For, Diff TD, Diff Sor) : le coach doit relier d'un coup d'œil le critère
 * à la colonne qu'il lit.
 */

export const LEAGUE_TIE_BREAK_LABELS: Readonly<Record<string, string>> = {
  points: "Points (Pts)",
  bonus_points: "Points bonus (Bo)",
  forfeit_points: "Forfaits (For)",
  td_diff: "Différence de TD",
  td_for: "TD marqués",
  td_against: "TD encaissés (le moins)",
  cas_diff: "Différence de sorties",
  cas_for: "Sorties infligées",
  cas_against: "Sorties subies (le moins)",
  season_elo: "ELO de saison",
  wins: "Victoires",
  played: "Matchs joués",
  name: "Nom de l'équipe",
};

/** Ordre proposé dans l'éditeur (celui du défaut d'abord). */
export const LEAGUE_TIE_BREAK_CATALOGUE: readonly string[] = [
  "points",
  "bonus_points",
  "forfeit_points",
  "td_diff",
  "cas_diff",
  "td_for",
  "cas_for",
  "td_against",
  "cas_against",
  "wins",
  "played",
  "season_elo",
  "name",
];

/**
 * Ordre appliqué à une ligue qui ne configure rien. Miroir de
 * `DEFAULT_LEAGUE_TIE_BREAK_RULES` côté serveur — l'écran ne l'utilise que
 * pour ANNONCER le défaut ; le tri, lui, reste serveur.
 */
export const DEFAULT_LEAGUE_TIE_BREAK_RULES: readonly string[] = [
  "points",
  "bonus_points",
  "forfeit_points",
  "td_diff",
  "cas_diff",
  "name",
];

/** Phrase d'aide : le défaut, en toutes lettres. */
export function describeDefaultLeagueTieBreak(): string {
  return DEFAULT_LEAGUE_TIE_BREAK_RULES.map(
    (slug) => LEAGUE_TIE_BREAK_LABELS[slug] ?? slug,
  ).join(", ");
}
