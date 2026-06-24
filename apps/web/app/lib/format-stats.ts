/**
 * Formatage des caractéristiques Blood Bowl pour l'affichage.
 *
 * Notation officielle BB : Agilité (AG), Passe (PA) et Armure (AV) sont des
 * objectifs de jet de dé et s'affichent suffixés d'un "+", ex. "3+", "8+".
 * Mouvement (MA) et Force (ST) sont des valeurs brutes, sans "+".
 *
 * Centralisé ici pour que toutes les surfaces (fiche d'équipe, builder,
 * éditeur, panneau de trésorerie, pages pro-league…) restent cohérentes et
 * qu'un seul endroit décrive la règle.
 */

/** Caractéristiques notées avec un "+" (objectif de dé) : AG, PA, AV. */
const PLUS_STATS: ReadonlySet<string> = new Set(["AG", "PA", "AV"]);

/**
 * Formate une valeur AG/PA/AV en notation BB ("X+"). Une valeur absente
 * (null/undefined, ex. PA des positions sans passe) rend "-" sans "+".
 */
export function formatPlusStat(value: number | null | undefined): string {
  if (value == null) return "-";
  return `${value}+`;
}

/** Vrai si la caractéristique (par son label) se note avec un "+". */
export function isPlusStat(label: string): boolean {
  return PLUS_STATS.has(label.trim().toUpperCase());
}

/**
 * Formate une caractéristique selon son label : AG/PA/AV suffixées d'un "+",
 * les autres (MA, ST, …) en valeur brute. Une valeur absente rend "-".
 * Pratique pour les composants génériques pilotés par un `label`.
 */
export function formatStatByLabel(
  label: string,
  value: number | null | undefined,
): string {
  if (isPlusStat(label)) return formatPlusStat(value);
  return value == null ? "-" : String(value);
}
