/**
 * Index inverse Star Player → rosters (« Joue pour »).
 *
 * `hirableBy` d'un Star Player liste des *critères* d'embauche : la sentinelle
 * `"all"` (mercenaire universel), des slugs de Ligues régionales / règles
 * spéciales (`badlands_brawl`, `favoured_of_khorne`…) et — côté base de
 * données, cf. `routes/star-players.ts` qui remonte `h.roster?.slug || h.rule`
 * — parfois directement des slugs de rosters.
 *
 * Les fiches publiques ont besoin de l'inverse : pour un Star Player donné,
 * la liste des équipes qui peuvent effectivement le recruter. On croise donc
 * `hirableBy` avec `TEAM_REGIONAL_RULES_BY_RULESET` (roster → Ligues), en
 * prenant l'univers des rosters dans `TEAM_ROSTERS_BY_RULESET` (source de
 * vérité des équipes existantes pour l'édition demandée).
 *
 * 100 % pur (pas de React ni de backend) ⇒ testable en unit
 * (`star-player-rosters.test.ts`).
 */

import {
  TEAM_REGIONAL_RULES_BY_RULESET,
  getStarPlayerBySlug,
  type StarPlayerDefinition,
} from "./star-players";
import {
  TEAM_ROSTERS_BY_RULESET,
  DEFAULT_RULESET,
  type Ruleset,
} from "./positions";

/** Sentinelle `hirableBy` : Star Player recrutable par n'importe quelle équipe. */
export const HIRABLE_BY_ALL = "all";

function getRosterUniverse(ruleset: Ruleset): string[] {
  const map =
    TEAM_ROSTERS_BY_RULESET[ruleset] ?? TEAM_ROSTERS_BY_RULESET[DEFAULT_RULESET];
  return Object.keys(map);
}

function getRegionalRulesMap(ruleset: Ruleset): Record<string, string[]> {
  return (
    TEAM_REGIONAL_RULES_BY_RULESET[ruleset] ??
    TEAM_REGIONAL_RULES_BY_RULESET[DEFAULT_RULESET]
  );
}

/**
 * Slugs des rosters pouvant recruter un Star Player dont on connaît les
 * critères `hirableBy`, triés par slug (ordre déterministe).
 *
 * - `"all"` ⇒ tous les rosters de l'édition.
 * - un slug de Ligue régionale ⇒ tous les rosters rattachés à cette Ligue.
 * - un slug de roster ⇒ ce roster (forme remontée par la base).
 */
export function getRostersForHirableBy(
  hirableBy: readonly string[] | null | undefined,
  ruleset: Ruleset = DEFAULT_RULESET,
): string[] {
  const rosters = getRosterUniverse(ruleset);
  if (!hirableBy || hirableBy.length === 0) return [];
  if (hirableBy.includes(HIRABLE_BY_ALL)) return [...rosters].sort();

  const criteria = new Set(hirableBy);
  const regionalRules = getRegionalRulesMap(ruleset);
  return rosters
    .filter(
      (rosterSlug) =>
        criteria.has(rosterSlug) ||
        (regionalRules[rosterSlug] ?? []).some((rule) => criteria.has(rule)),
    )
    .sort();
}

/**
 * Univers des rosters d'une édition (slugs triés). C'est la liste des équipes
 * qui existent pour ce ruleset — donc le référentiel d'un filtre « équipe »
 * côté UI, qui doit suivre la saison sélectionnée.
 */
export function getRosterSlugsForRuleset(
  ruleset: Ruleset = DEFAULT_RULESET,
): string[] {
  return [...getRosterUniverse(ruleset)].sort();
}

/**
 * Ce roster peut-il recruter ce Star Player ?
 *
 * Prédicat direct, strictement équivalent à
 * `getRostersForHirableBy(hirableBy, ruleset).includes(rosterSlug)` mais sans
 * matérialiser l'index inverse — le cas d'usage est le filtrage d'une liste
 * (un appel par Star Player affiché).
 */
export function isStarPlayerHirableByRoster(
  hirableBy: readonly string[] | null | undefined,
  rosterSlug: string,
  ruleset: Ruleset = DEFAULT_RULESET,
): boolean {
  if (!hirableBy || hirableBy.length === 0) return false;
  // Un roster absent de l'édition ne recrute rien, pas même un mercenaire
  // universel (ex: les Bretonniens n'existent pas en saison 2).
  if (!getRosterUniverse(ruleset).includes(rosterSlug)) return false;
  if (hirableBy.includes(HIRABLE_BY_ALL)) return true;
  if (hirableBy.includes(rosterSlug)) return true;
  const rules = getRegionalRulesMap(ruleset)[rosterSlug] ?? [];
  return hirableBy.some((criterion) => rules.includes(criterion));
}

/** Idem, à partir de la définition (ou de l'objet API) d'un Star Player. */
export function getRostersForStarPlayer(
  starPlayer:
    | Pick<StarPlayerDefinition, "hirableBy">
    | { hirableBy: readonly string[] }
    | null
    | undefined,
  ruleset: Ruleset = DEFAULT_RULESET,
): string[] {
  return getRostersForHirableBy(starPlayer?.hirableBy, ruleset);
}

/** Idem, à partir du slug d'un Star Player du catalogue statique. */
export function getRostersForStarPlayerSlug(
  slug: string,
  ruleset: Ruleset = DEFAULT_RULESET,
): string[] {
  return getRostersForStarPlayer(getStarPlayerBySlug(slug, ruleset), ruleset);
}
