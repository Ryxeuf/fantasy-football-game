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

/** Nombre max de noms d'équipes listés sur la carte exportable. */
const CARD_MAX_TEAMS = 5;

/**
 * Variante compacte pour la carte joueur exportable (change
 * `export-player-cards`) : la sentinelle `all` devient un libellé unique, et
 * une longue liste est coupée avec un « + N autres équipes » — une carte
 * n'a pas la place d'une fiche.
 */
export function getPlaysForCardLines(
  hirableBy: readonly string[] | null | undefined,
  lang: "fr" | "en" = "fr",
  ruleset: Ruleset = DEFAULT_RULESET,
): string[] {
  if ((hirableBy ?? []).includes("all")) {
    return [lang === "en" ? "All teams" : "Toutes les équipes"];
  }
  const names = getPlaysForRosters(hirableBy, ruleset).map((r) => r.name);
  if (names.length <= CARD_MAX_TEAMS + 1) return names;
  const extra = names.length - CARD_MAX_TEAMS;
  const more =
    lang === "en" ? `+ ${extra} more teams` : `+ ${extra} autres équipes`;
  return [...names.slice(0, CARD_MAX_TEAMS), more];
}
