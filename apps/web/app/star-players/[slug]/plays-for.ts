/**
 * Rubrique « Joue pour » de la fiche Star Player.
 *
 * L'API expose `hirableBy` (sentinelle `all`, slugs de Ligues régionales et,
 * selon la source, slugs de rosters). La fiche doit afficher la liste concrète
 * des équipes qui peuvent recruter le Star Player : on délègue la résolution
 * au game-engine (`getRostersForStarPlayer`, pur et testé) et on ne garde ici
 * que la mise en forme (nom FR + tri alphabétique français).
 */

import {
  DEFAULT_RULESET,
  getRosterName,
  getRostersForStarPlayer,
  type Ruleset,
} from "@bb/game-engine";

export interface PlaysForRoster {
  readonly slug: string;
  readonly name: string;
}

/**
 * Rosters pouvant recruter le Star Player, triés par nom FR (ordre
 * d'affichage). Retourne `[]` si `hirableBy` est vide/inconnu — la fiche
 * masque alors la rubrique.
 */
export function getPlaysForRosters(
  hirableBy: readonly string[] | null | undefined,
  ruleset: Ruleset = DEFAULT_RULESET,
): PlaysForRoster[] {
  return getRostersForStarPlayer({ hirableBy: hirableBy ?? [] }, ruleset)
    .map((slug) => ({ slug, name: getRosterName(slug) }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}
