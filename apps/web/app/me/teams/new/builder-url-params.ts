/**
 * Paramètres d'URL du builder d'équipe (`/me/teams/new?roster=…&ruleset=…`).
 *
 * Ils étaient lus directement dans les initialiseurs `useState` du builder.
 * Sur un chargement complet de la page (URL tapée, ou rechargement dur après
 * `/auth/sync`), le HTML est rendu côté serveur SANS `window` : les `<select>`
 * partent donc sur les valeurs par défaut. React 18 ne corrige PAS un écart de
 * `value` sur un `<select>` à l'hydratation — le formulaire restait affiché sur
 * « Skaven / Saison 3 » alors que l'état interne portait le roster de l'URL.
 *
 * D'où ce module : une lecture PURE de la query string, appliquée par le
 * builder dans un effet de montage (donc après l'hydratation, ce qui force
 * React à réécrire le DOM des `<select>`). 100 % testable en unit.
 */

import {
  DEFAULT_FORMAT,
  DEFAULT_RULESET,
  FORMATS,
  RULESETS,
  isTournamentRulesetSlug,
  type GameFormat,
  type Ruleset,
} from "@bb/game-engine";

/** Roster proposé par défaut quand l'URL n'en impose aucun. */
export const DEFAULT_BUILDER_ROSTER = "skaven";

export interface BuilderUrlParams {
  /** Édition de règles (`season_2` / `season_3`), `null` si absente/invalide. */
  readonly ruleset: Ruleset | null;
  /** Format (`bb11` / `sevens`), `null` si absent/invalide. */
  readonly format: GameFormat | null;
  /** Slug du roster demandé, `null` si absent. */
  readonly roster: string | null;
  /** Nom pré-rempli, `null` si absent. */
  readonly name: string | null;
  /** Budget imposé (kpo), `null` si absent ou non numérique. */
  readonly teamValue: number | null;
  /** Règlement de tournoi, `null` si absent ou inconnu du catalogue. */
  readonly tournamentRuleset: string | null;
  /** Construction « pour une coupe » (Flow B). */
  readonly cupId: string | null;
  /** Équipe de base à cloner. */
  readonly fromTeamId: string | null;
}

const EMPTY: BuilderUrlParams = {
  ruleset: null,
  format: null,
  roster: null,
  name: null,
  teamValue: null,
  tournamentRuleset: null,
  cupId: null,
  fromTeamId: null,
};

/**
 * Lit les paramètres du builder depuis une query string (`window.location.search`
 * ou toute chaîne équivalente). Toute valeur absente ou invalide vaut `null` :
 * l'appelant garde alors son défaut.
 */
export function readBuilderParams(search: string): BuilderUrlParams {
  if (!search) return EMPTY;
  const p = new URLSearchParams(search);

  const ruleset = p.get("ruleset");
  const format = p.get("format");
  const tournamentRuleset = p.get("tournamentRuleset");
  const rawTeamValue = p.get("teamValue");
  const teamValue = rawTeamValue === null ? NaN : Number.parseInt(rawTeamValue, 10);

  return {
    ruleset:
      ruleset && (RULESETS as readonly string[]).includes(ruleset)
        ? (ruleset as Ruleset)
        : null,
    format:
      format && (FORMATS as readonly string[]).includes(format)
        ? (format as GameFormat)
        : null,
    roster: p.get("roster") || null,
    name: p.get("name") || null,
    teamValue: Number.isFinite(teamValue) ? teamValue : null,
    tournamentRuleset:
      tournamentRuleset && isTournamentRulesetSlug(tournamentRuleset)
        ? tournamentRuleset
        : null,
    cupId: p.get("cupId") || null,
    fromTeamId: p.get("fromTeamId") || null,
  };
}

/** Valeurs de départ du builder, indépendantes de l'URL (rendu serveur). */
export const BUILDER_DEFAULTS = {
  ruleset: DEFAULT_RULESET,
  format: DEFAULT_FORMAT,
  roster: DEFAULT_BUILDER_ROSTER,
} as const;
