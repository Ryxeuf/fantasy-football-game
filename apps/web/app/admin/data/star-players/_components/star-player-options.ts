/**
 * Catalogues et helpers purs des formulaires Star Player de l'admin
 * (`/admin/data/star-players/new` et `.../[id]/edit`).
 *
 * Les deux ecrans saisissaient auparavant les competences et les regles de
 * recrutement en CSV libre. On expose ici les catalogues exhaustifs et les
 * conversions API <-> selection pour que la saisie se fasse en cases a
 * cocher, comme sur les rosters (cf. `_components/SlugCheckboxGrid`).
 */

import {
  REGIONAL_LEAGUES,
  TEAM_REGIONAL_RULES_BY_RULESET,
} from "@bb/game-engine";
import type { SlugOption } from "../../_components/SlugCheckboxGrid";

/** Règle "mercenaire universel" : recrutable par toutes les équipes. */
export const HIRABLE_RULE_ALL = "all";

/**
 * Libellés des alignements « Favori de… » (règle spéciale `favori_de`).
 * Ils ne sont pas des ligues régionales mais servent de règle de
 * recrutement pour les Star Players du Chaos.
 */
const FAVOURED_OF_LABELS: Record<string, string> = {
  favoured_of: "Favori de…",
  favoured_of_hashut: "Favori de Hashut",
  favoured_of_khorne: "Favori de Khorne",
  favoured_of_nurgle: "Favori de Nurgle",
  favoured_of_slaanesh: "Favori de Slaanesh",
  favoured_of_tzeentch: "Favori de Tzeentch",
  favoured_of_chaos_universel: "Favori du Chaos Universel",
};

/** Libellé lisible d'un slug inconnu : `favoured_of_x` → `Favoured of x`. */
function humanizeSlug(slug: string): string {
  const words = slug.replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Toutes les règles régionales réellement portées par un roster, tous
 * rulesets confondus. C'est la source des alignements « Favori de… » :
 * ils n'apparaissent pas dans `REGIONAL_LEAGUES` mais conditionnent bien
 * le recrutement (cf. `TEAM_REGIONAL_RULES_BY_RULESET`).
 */
function collectRosterRegionalRules(): string[] {
  const seen = new Set<string>();
  for (const byRoster of Object.values(TEAM_REGIONAL_RULES_BY_RULESET)) {
    for (const rules of Object.values(byRoster)) {
      for (const rule of rules) seen.add(rule);
    }
  }
  return Array.from(seen).sort();
}

/** Catalogue des ligues régionales (source game-engine). */
const REGIONAL_LEAGUE_RULE_OPTIONS: SlugOption[] = REGIONAL_LEAGUES.map((l) => ({
  slug: l.slug,
  label: l.nameFr,
}));

/**
 * Catalogue complet des règles de recrutement d'un Star Player :
 * « toutes les équipes », les ligues régionales, puis les alignements
 * « Favori de… » et toute autre règle portée par un roster.
 */
export const HIRABLE_RULE_OPTIONS: SlugOption[] = (() => {
  const leagueSlugs = new Set(REGIONAL_LEAGUE_RULE_OPTIONS.map((o) => o.slug));
  const extras = collectRosterRegionalRules()
    .filter((slug) => !leagueSlugs.has(slug))
    .map((slug) => ({
      slug,
      label: FAVOURED_OF_LABELS[slug] ?? humanizeSlug(slug),
    }));
  return [
    { slug: HIRABLE_RULE_ALL, label: "Toutes les équipes" },
    ...REGIONAL_LEAGUE_RULE_OPTIONS,
    ...extras,
  ];
})();

/** Une entrée `StarPlayerHirableBy` telle que renvoyée par l'API admin. */
export interface HirableByEntry {
  rule: string;
  roster?: { id: string; slug: string; name: string } | null;
}

/** Sélection de recrutement éclatée en deux listes indépendantes. */
export interface HirableSelection {
  /** Règles globales (ligues, « Favori de… », `all`) sans roster ciblé. */
  rules: string[];
  /** Ids de rosters explicitement autorisés. */
  rosterIds: string[];
}

/**
 * Éclate la liste renvoyée par l'API en deux sélections cochables.
 * Une entrée liée à un roster alimente `rosterIds` (et non `rules`) :
 * c'est ce couple qui est réémis à l'enregistrement, sans quoi le lien
 * roster serait perdu (l'API retombe sur `rosterId: null` pour une
 * simple chaîne).
 */
export function hirableSelectionFromApi(
  entries: readonly HirableByEntry[] | null | undefined,
): HirableSelection {
  const rules: string[] = [];
  const rosterIds: string[] = [];
  for (const entry of entries ?? []) {
    if (entry.roster?.id) {
      if (!rosterIds.includes(entry.roster.id)) rosterIds.push(entry.roster.id);
      continue;
    }
    if (entry.rule && !rules.includes(entry.rule)) rules.push(entry.rule);
  }
  return { rules, rosterIds };
}

/**
 * Recompose le payload `hirableBy` attendu par l'API : chaînes pour les
 * règles globales, objets `{ rule, rosterId }` pour les rosters ciblés.
 * Un roster inconnu du catalogue est ignoré (son id n'a plus de slug).
 */
export function hirableSelectionToPayload(
  selection: HirableSelection,
  rosters: readonly { id: string; slug: string }[],
): Array<string | { rule: string; rosterId: string }> {
  const bySlug = new Map(rosters.map((r) => [r.id, r.slug]));
  const rosterEntries = selection.rosterIds
    .map((rosterId) => {
      const slug = bySlug.get(rosterId);
      return slug ? { rule: slug, rosterId } : null;
    })
    .filter((e): e is { rule: string; rosterId: string } => e !== null);
  return [...selection.rules, ...rosterEntries];
}

/** Bascule un élément dans une liste (ajout si absent, retrait sinon). */
export function toggleValue(prev: readonly string[], value: string): string[] {
  return prev.includes(value)
    ? prev.filter((v) => v !== value)
    : [...prev, value];
}
