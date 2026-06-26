/**
 * Index inverse Ligue régionale → rosters éligibles.
 *
 * `TEAM_REGIONAL_RULES` (cf. `star-players.ts`) mappe chaque roster vers les
 * slugs de Ligues régionales auxquelles il appartient. Pour les pages
 * publiques `/ligues` (description d'une Ligue + liste des équipes qui peuvent
 * y participer, maillage interne SEO), on a besoin de l'inverse : pour un slug
 * de Ligue, l'ensemble des rosters concernés.
 *
 * 100 % pur (pas de React ni de backend) ⇒ testable en unit
 * (`regional-league-rosters.test.ts`).
 */

import { TEAM_REGIONAL_RULES_BY_RULESET } from "./star-players";
import { DEFAULT_RULESET, type Ruleset } from "./positions";
import {
  REGIONAL_LEAGUES,
  type RegionalLeagueDefinition,
} from "./regional-leagues";

/**
 * Slugs des rosters appartenant à une Ligue régionale donnée, triés par slug
 * (ordre déterministe). Repli sur l'édition par défaut si le ruleset demandé
 * n'a pas de table dédiée.
 */
export function getRostersForRegionalLeague(
  leagueSlug: string,
  ruleset: Ruleset = DEFAULT_RULESET,
): string[] {
  const map =
    TEAM_REGIONAL_RULES_BY_RULESET[ruleset] ??
    TEAM_REGIONAL_RULES_BY_RULESET[DEFAULT_RULESET];
  return Object.entries(map)
    .filter(([, leagues]) => leagues.includes(leagueSlug))
    .map(([rosterSlug]) => rosterSlug)
    .sort();
}

export interface RegionalLeagueWithRosters extends RegionalLeagueDefinition {
  /** Slugs des rosters éligibles (triés). */
  readonly rosterSlugs: readonly string[];
}

/**
 * Toutes les Ligues régionales accompagnées de leurs rosters éligibles, en
 * ne conservant que celles qui regroupent au moins un roster (une Ligue
 * définie mais sans équipe n'a pas de page publique pertinente).
 */
export function getRegionalLeaguesWithRosters(
  ruleset: Ruleset = DEFAULT_RULESET,
): RegionalLeagueWithRosters[] {
  return REGIONAL_LEAGUES.map((league) => ({
    ...league,
    rosterSlugs: getRostersForRegionalLeague(league.slug, ruleset),
  })).filter((league) => league.rosterSlugs.length > 0);
}
