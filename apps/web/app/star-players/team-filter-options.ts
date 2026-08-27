/**
 * Options du filtre « Équipe » de la page de listing des Star Players.
 *
 * La liste doit être COMPLÈTE (toutes les équipes de l'édition, pas une
 * poignée de slugs codés en dur) et DYNAMIQUE (elle suit la saison choisie
 * dans le formulaire : les Bretonniens n'existent qu'en saison 3).
 *
 * Source de vérité : `GET /api/rosters?ruleset=…&lang=…`, qui sert les
 * rosters de la base avec leurs noms localisés — donc les éditions admin.
 * Si l'appel échoue (ou ne renvoie rien d'exploitable), on retombe sur le
 * catalogue du game-engine pour l'édition demandée : un filtre incomplet
 * serait pire qu'un filtre non localisé.
 *
 * 100 % pur ⇒ testable en unit (`team-filter-options.test.ts`).
 */

import {
  DEFAULT_RULESET,
  getRosterName,
  getRosterSlugsForRuleset,
  type Ruleset,
} from "@bb/game-engine";

/** Sentinelle « toutes les équipes » (valeur par défaut du `<select>`). */
export const ALL_TEAMS_OPTION = "all";

export interface TeamFilterOption {
  readonly slug: string;
  readonly name: string;
}

/** Ligne telle que servie par `/api/rosters` (défensif : payload externe). */
export interface ApiRosterRow {
  readonly slug?: unknown;
  readonly name?: unknown;
}

function fallbackOptions(ruleset: Ruleset): TeamFilterOption[] {
  return getRosterSlugsForRuleset(ruleset).map((slug) => ({
    slug,
    name: getRosterName(slug),
  }));
}

/**
 * Options du filtre, dédupliquées par slug et triées par nom localisé.
 *
 * `rows` vide/nul/inexploitable ⇒ repli sur le catalogue du game-engine pour
 * `ruleset`. Une ligne sans nom utilisable retombe sur le nom FR du
 * catalogue, puis sur le slug (jamais de libellé vide côté UI).
 */
export function buildTeamFilterOptions(
  rows: readonly ApiRosterRow[] | null | undefined,
  ruleset: Ruleset = DEFAULT_RULESET,
  lang: "fr" | "en" = "fr",
): TeamFilterOption[] {
  const bySlug = new Map<string, TeamFilterOption>();
  for (const row of rows ?? []) {
    const slug = typeof row?.slug === "string" ? row.slug.trim() : "";
    if (!slug || bySlug.has(slug)) continue;
    const name = typeof row?.name === "string" ? row.name.trim() : "";
    bySlug.set(slug, { slug, name: name || getRosterName(slug) || slug });
  }
  const options = bySlug.size > 0 ? [...bySlug.values()] : fallbackOptions(ruleset);
  return options.sort((a, b) => a.name.localeCompare(b.name, lang));
}
