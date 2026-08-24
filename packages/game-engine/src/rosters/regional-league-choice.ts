/**
 * Choix de la Ligue régionale d'une équipe.
 *
 * `TEAM_REGIONAL_RULES` liste, pour chaque roster, TOUTES les règles
 * régionales auxquelles il peut prétendre. Historiquement le moteur en
 * faisait l'union : une équipe Nains pouvait recruter les Star Players de la
 * Classique du Vieux Monde ET de la Super-ligue du Bord du Monde, et acheter
 * les Coups de Pouce des deux. Les règles officielles veulent qu'une équipe
 * appartienne à UNE Ligue, choisie à la création de la Liste d'Équipe : c'est
 * elle qui débloque Star Players et Coups de Pouce.
 *
 * Ce module sépare donc, dans la liste d'un roster :
 *  - les **Ligues** (`REGIONAL_LEAGUES`) → ce sont les options du choix ;
 *  - les **alignements** « Favori de… » (`favoured_of_*`) → ce ne sont pas
 *    des Ligues mais l'identité chaotique de l'équipe, acquise quelle que
 *    soit la Ligue retenue… sauf quand elle DÉPEND de la Ligue choisie
 *    (Nordiques : c'est le Clash du Chaos qui apporte Favori de Khorne).
 *
 * Rétro-compatibilité : une équipe sans choix enregistré (créée avant cette
 * règle) garde l'union historique — cf. `resolveTeamRegionalRules`.
 *
 * 100 % pur ⇒ testable en unit (`regional-league-choice.test.ts`).
 */

import { DEFAULT_RULESET, type Ruleset } from "./positions";
import { REGIONAL_LEAGUES_BY_SLUG } from "./regional-leagues";
import { getRegionalRulesForTeam } from "./star-players";

/** Une option de Ligue proposée à la création d'une équipe. */
export interface RegionalLeagueOption {
  /** Slug de la Ligue (clé de `REGIONAL_LEAGUES_BY_SLUG`). */
  readonly slug: string;
  /**
   * Règles régionales acquises EN PLUS de la Ligue si elle est choisie
   * (alignements « Favori de… »). Vide dans le cas général.
   */
  readonly grants: readonly string[];
}

/**
 * Surcharges explicites du choix, quand la dérivation automatique depuis
 * `TEAM_REGIONAL_RULES` ne suffit pas.
 *
 * Nordiques (Saison 3) : le roster a le choix entre la Classique du Vieux
 * Monde et le Clash du Chaos ; ce n'est qu'en rejoignant le Clash du Chaos
 * qu'il gagne l'alignement Favori de Khorne. La table de base porte
 * `["old_world_classic", "favoured_of_khorne"]`, qui ne sait pas exprimer ce
 * conditionnement.
 */
const REGIONAL_LEAGUE_OPTION_OVERRIDES: Partial<
  Record<Ruleset, Record<string, readonly RegionalLeagueOption[]>>
> = {
  season_3: {
    norse: [
      { slug: "old_world_classic", grants: [] },
      { slug: "chaos_clash", grants: ["favoured_of_khorne"] },
    ],
  },
};

/** Un slug de règle régionale désigne-t-il une vraie Ligue ? */
export function isRegionalLeagueSlug(slug: string): boolean {
  return slug in REGIONAL_LEAGUES_BY_SLUG;
}

/**
 * Ligues entre lesquelles le coach doit choisir à la création, avec les
 * alignements que chacune apporte.
 *
 * Liste vide = ce roster n'appartient à aucune Ligue modélisée (rien à
 * demander). Un seul élément = pas de vrai choix : la Ligue est imposée et
 * peut être assignée automatiquement.
 */
export function getRegionalLeagueOptions(
  rosterSlug: string,
  ruleset: Ruleset = DEFAULT_RULESET,
): readonly RegionalLeagueOption[] {
  const override = REGIONAL_LEAGUE_OPTION_OVERRIDES[ruleset]?.[rosterSlug];
  if (override) return override;

  const rules = getRegionalRulesForTeam(rosterSlug, ruleset);
  const leagues = rules.filter(isRegionalLeagueSlug);
  // Les alignements « Favori de… » du roster ne dépendent pas de la Ligue :
  // ils font partie de son identité et sont acquis quel que soit le choix.
  const grants = rules.filter((slug) => !isRegionalLeagueSlug(slug));
  return leagues.map((slug) => ({ slug, grants }));
}

/** Le coach a-t-il un vrai choix à faire (au moins deux Ligues) ? */
export function isRegionalLeagueChoiceRequired(
  rosterSlug: string,
  ruleset: Ruleset = DEFAULT_RULESET,
): boolean {
  return getRegionalLeagueOptions(rosterSlug, ruleset).length > 1;
}

/**
 * Ligue attribuée d'office quand il n'y a rien à choisir (une seule option),
 * `null` sinon — soit qu'il faille demander, soit que le roster n'ait aucune
 * Ligue.
 */
export function getDefaultRegionalLeague(
  rosterSlug: string,
  ruleset: Ruleset = DEFAULT_RULESET,
): string | null {
  const options = getRegionalLeagueOptions(rosterSlug, ruleset);
  return options.length === 1 ? options[0].slug : null;
}

/** Le slug proposé est-il une Ligue valide pour ce roster ? */
export function isRegionalLeagueAllowed(
  rosterSlug: string,
  leagueSlug: string,
  ruleset: Ruleset = DEFAULT_RULESET,
): boolean {
  return getRegionalLeagueOptions(rosterSlug, ruleset).some(
    (o) => o.slug === leagueSlug,
  );
}

/**
 * Règles régionales EFFECTIVES d'une équipe — ce qui débloque ses Star
 * Players et ses Coups de Pouce.
 *
 * - Ligue choisie et valide → cette Ligue + les alignements qu'elle apporte.
 * - Aucun choix enregistré (équipe antérieure à la règle) ou choix devenu
 *   invalide → union historique de toutes les règles du roster, pour ne pas
 *   retirer rétroactivement des recrutements déjà possibles.
 */
export function resolveTeamRegionalRules(
  rosterSlug: string,
  ruleset: Ruleset = DEFAULT_RULESET,
  chosenLeague?: string | null,
): string[] {
  if (chosenLeague) {
    const option = getRegionalLeagueOptions(rosterSlug, ruleset).find(
      (o) => o.slug === chosenLeague,
    );
    if (option) return [option.slug, ...option.grants];
  }
  return getRegionalRulesForTeam(rosterSlug, ruleset);
}
