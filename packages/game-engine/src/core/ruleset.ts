/**
 * Édition de règles d'un match. Le moteur applique le texte 2025 (Saison 3)
 * par défaut : un état sans `ruleset` (match antérieur, simulation, test) se
 * lit donc comme une Saison 3, et seule une équipe Saison 2 garde le texte 2020
 * là où les deux divergent.
 */

export type GameRuleset = 'season_2' | 'season_3';

/** Normalise une valeur venue de la base ; une valeur inconnue vaut absence. */
export function parseGameRuleset(value: unknown): GameRuleset | undefined {
  return value === 'season_2' || value === 'season_3' ? value : undefined;
}

/** Le match se joue-t-il au texte 2020 (Saison 2) ? */
export function isSeason2Rules(ruleset: GameRuleset | undefined): boolean {
  return ruleset === 'season_2';
}
