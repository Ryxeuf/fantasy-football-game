/**
 * Math helpers — sprint Pro League lot 1.D.3 (odds calculator).
 *
 * Fonctions pures, sans I/O, testables seules. Conversions
 * probabilités → cotes décimales et application d'une marge maison.
 *
 * Convention :
 *  - "probability" ∈ [0, 1] : fraction des cas favorables.
 *  - "decimal odds" ≥ 1.01 : ce qui revient au parieur pour 1 Crown
 *    misé. Ex : odds 2.50 ⇒ stake 100 ⇒ payout 250.
 *
 * Marge maison ("house margin") : la somme des proba implicites des
 * cotes affichées dépasse 1, l'écart = marge captée par la "maison".
 * On applique en multipliant la proba estimée par (1 + margin) avant
 * inversion, puis on clamp.
 */

/** Marge maison par défaut (5%). */
export const DEFAULT_HOUSE_MARGIN = 0.05;

/** Cote min publiable (sécurité contre les "favoris extrêmes"). */
export const MIN_DECIMAL_ODDS = 1.05;

/** Cote max publiable (sécurité contre les events ultra-rares qui
 *  exploseraient un gain unique). */
export const MAX_DECIMAL_ODDS = 99.0;

/**
 * Convertit une probabilité en cote décimale en appliquant la marge
 * maison. Clamp dans [MIN_DECIMAL_ODDS, MAX_DECIMAL_ODDS].
 *
 * Logique : si p est la proba "vraie", la cote équitable est 1/p.
 * On ajoute la marge en réduisant la proba implicite : la cote
 * publiée est `(1 / p) / (1 + margin)`.
 */
export function probabilityToDecimalOdds(
  probability: number,
  houseMargin: number = DEFAULT_HOUSE_MARGIN,
): number {
  if (!Number.isFinite(probability) || !Number.isFinite(houseMargin)) {
    throw new Error("probabilityToDecimalOdds: invalid inputs");
  }
  if (houseMargin < 0) {
    throw new Error("probabilityToDecimalOdds: houseMargin must be ≥ 0");
  }
  if (probability <= 0) return MAX_DECIMAL_ODDS;
  if (probability >= 1) return MIN_DECIMAL_ODDS;
  const fairOdds = 1 / probability;
  const odds = fairOdds / (1 + houseMargin);
  if (odds < MIN_DECIMAL_ODDS) return MIN_DECIMAL_ODDS;
  if (odds > MAX_DECIMAL_ODDS) return MAX_DECIMAL_ODDS;
  // Round to 2 decimal places — convention bookmaker.
  return Math.round(odds * 100) / 100;
}

/**
 * Inverse de `probabilityToDecimalOdds` (pour les tests + l'audit) :
 * récupère la proba implicite affichée par une cote décimale.
 */
export function impliedProbability(odds: number): number {
  if (!Number.isFinite(odds) || odds < MIN_DECIMAL_ODDS) {
    throw new Error("impliedProbability: invalid odds");
  }
  return 1 / odds;
}

/**
 * Distribue uniformément la probabilité d'occurrences sur 3 sélections
 * (1X2). Renvoie un objet avec `home` / `draw` / `away` chacun ∈ [0, 1].
 *
 * Si l'échantillon est vide, retourne 1/3 partout (cote équitable
 * neutre).
 */
export function computeOneXTwoProbabilities(samples: {
  home: number;
  draws: number;
  away: number;
}): { home: number; draw: number; away: number } {
  const total = samples.home + samples.draws + samples.away;
  if (total <= 0) {
    return { home: 1 / 3, draw: 1 / 3, away: 1 / 3 };
  }
  return {
    home: samples.home / total,
    draw: samples.draws / total,
    away: samples.away / total,
  };
}

/**
 * Calcule la proba que la valeur observée soit strictement >
 * `line`. Pour un line entier (ex 2.5), c'est strictement supérieur :
 * `over = #{x > line} / N`. `under` est le complément.
 *
 * On utilise un line "fractionnaire" (.5) pour éviter les égalités —
 * convention bookmaker.
 */
export function computeOverUnderProbabilities(
  values: readonly number[],
  line: number,
): { over: number; under: number } {
  if (values.length === 0) return { over: 0.5, under: 0.5 };
  let over = 0;
  for (const v of values) {
    if (v > line) over += 1;
  }
  const overP = over / values.length;
  return { over: overP, under: 1 - overP };
}

/**
 * Compte la fraction de matchs où au moins un event Nuffle a été
 * émis. Renvoie {yes, no} probabilities.
 */
export function computeNuffleOccursProbabilities(
  values: readonly number[],
): { yes: number; no: number } {
  if (values.length === 0) return { yes: 0.5, no: 0.5 };
  let yes = 0;
  for (const v of values) {
    if (v >= 1) yes += 1;
  }
  const yesP = yes / values.length;
  return { yes: yesP, no: 1 - yesP };
}
