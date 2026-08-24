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
 * **Source des règles.** La liste de départ n'est pas forcément la table
 * canonique : `Roster.regionalRules` est éditable côté admin et c'est elle
 * que servent les fiches publiques. Toutes les fonctions acceptent donc un
 * `declaredRules` optionnel — les Ligues DÉCLARÉES par le roster. Sans lui,
 * on retombe sur la table canonique (`getRegionalRulesForTeam`). C'est ce
 * qui garantit qu'on ne propose jamais à la création une Ligue que la fiche
 * du roster n'affiche pas.
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
 * Alignements CONDITIONNÉS par la Ligue choisie : ils ne font pas partie de
 * l'identité du roster, on ne les gagne qu'en rejoignant cette Ligue-là.
 *
 * Nordiques (Saison 3) : ce n'est qu'en rejoignant le Clash du Chaos qu'ils
 * gagnent Favori de Khorne. Tout alignement listé ici est retiré du lot
 * « acquis quelle que soit la Ligue ».
 */
const CONDITIONAL_GRANTS: Partial<
  Record<Ruleset, Record<string, Record<string, readonly string[]>>>
> = {
  season_3: {
    norse: { chaos_clash: ["favoured_of_khorne"] },
  },
};

/**
 * Ligues ouvertes à un roster que la liste de règles ne sait pas exprimer.
 *
 * La table des Nordiques porte `["old_world_classic", "favoured_of_khorne"]` :
 * le Clash du Chaos n'y apparaît pas alors que c'est bien une de leurs deux
 * Ligues. On l'ajoute ici plutôt que dans la table, pour ne pas élargir
 * l'union historique servant de repli aux équipes sans choix enregistré.
 */
const IMPLICIT_LEAGUES: Partial<
  Record<Ruleset, Record<string, readonly string[]>>
> = {
  season_3: {
    norse: ["chaos_clash"],
  },
};

/** Un slug de règle régionale désigne-t-il une vraie Ligue ? */
export function isRegionalLeagueSlug(slug: string): boolean {
  return slug in REGIONAL_LEAGUES_BY_SLUG;
}

/**
 * Règles régionales de départ : celles DÉCLARÉES par le roster quand on les
 * connaît (colonne `Roster.regionalRules`, éditable en admin), sinon la
 * table canonique du moteur.
 */
function baseRules(
  rosterSlug: string,
  ruleset: Ruleset,
  declaredRules?: readonly string[] | null,
): readonly string[] {
  if (declaredRules && declaredRules.length > 0) return declaredRules;
  return getRegionalRulesForTeam(rosterSlug, ruleset);
}

/**
 * Ligues entre lesquelles le coach doit choisir à la création, avec les
 * alignements que chacune apporte.
 *
 * Liste vide = ce roster n'appartient à aucune Ligue modélisée (rien à
 * demander). Un seul élément = pas de vrai choix : la Ligue est imposée et
 * peut être assignée automatiquement.
 *
 * `declaredRules` (optionnel) : règles régionales déclarées par le roster.
 * Les options s'y limitent — c'est ce qui garde le choix à la création
 * aligné sur la fiche publique du roster.
 */
export function getRegionalLeagueOptions(
  rosterSlug: string,
  ruleset: Ruleset = DEFAULT_RULESET,
  declaredRules?: readonly string[] | null,
): readonly RegionalLeagueOption[] {
  const rules = baseRules(rosterSlug, ruleset, declaredRules);
  const conditional = CONDITIONAL_GRANTS[ruleset]?.[rosterSlug] ?? {};
  const conditionalSlugs = new Set<string>(
    Object.values(conditional).flatMap((granted) => [...granted]),
  );

  const leagues: string[] = [];
  const seen = new Set<string>();
  for (const slug of [
    ...rules.filter(isRegionalLeagueSlug),
    ...(IMPLICIT_LEAGUES[ruleset]?.[rosterSlug] ?? []),
  ]) {
    if (seen.has(slug)) continue;
    seen.add(slug);
    leagues.push(slug);
  }

  // Les alignements « Favori de… » du roster ne dépendent pas de la Ligue :
  // ils font partie de son identité et sont acquis quel que soit le choix —
  // sauf ceux explicitement conditionnés ci-dessus.
  const grants = rules.filter(
    (slug) => !isRegionalLeagueSlug(slug) && !conditionalSlugs.has(slug),
  );

  return leagues.map((slug) => ({
    slug,
    grants: [...grants, ...(conditional[slug] ?? [])],
  }));
}

/** Le coach a-t-il un vrai choix à faire (au moins deux Ligues) ? */
export function isRegionalLeagueChoiceRequired(
  rosterSlug: string,
  ruleset: Ruleset = DEFAULT_RULESET,
  declaredRules?: readonly string[] | null,
): boolean {
  return getRegionalLeagueOptions(rosterSlug, ruleset, declaredRules).length > 1;
}

/**
 * Ligue attribuée d'office quand il n'y a rien à choisir (une seule option),
 * `null` sinon — soit qu'il faille demander, soit que le roster n'ait aucune
 * Ligue.
 */
export function getDefaultRegionalLeague(
  rosterSlug: string,
  ruleset: Ruleset = DEFAULT_RULESET,
  declaredRules?: readonly string[] | null,
): string | null {
  const options = getRegionalLeagueOptions(rosterSlug, ruleset, declaredRules);
  return options.length === 1 ? options[0].slug : null;
}

/** Le slug proposé est-il une Ligue valide pour ce roster ? */
export function isRegionalLeagueAllowed(
  rosterSlug: string,
  leagueSlug: string,
  ruleset: Ruleset = DEFAULT_RULESET,
  declaredRules?: readonly string[] | null,
): boolean {
  return getRegionalLeagueOptions(rosterSlug, ruleset, declaredRules).some(
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
  declaredRules?: readonly string[] | null,
): string[] {
  if (chosenLeague) {
    const option = getRegionalLeagueOptions(
      rosterSlug,
      ruleset,
      declaredRules,
    ).find((o) => o.slug === chosenLeague);
    if (option) return [option.slug, ...option.grants];
  }
  return [...baseRules(rosterSlug, ruleset, declaredRules)];
}
