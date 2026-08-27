"use client";

/**
 * Catalogue de rosters côté web : servi par l'API, plus par le catalogue
 * compilé du moteur.
 *
 * Audit statique vs base — lot 5 (W2, W3, W10). Le front recalculait des
 * données que l'API sert déjà : nom du roster (`getRosterName`, table FR
 * figée dans `@bb/game-engine`) et budget de construction
 * (`getFormatConstraints().startingBudget`, `STANDARD_BUDGET_K = 1000`), alors
 * que `Roster.name` / `Roster.nameEn` / `Roster.budget` sont éditables en
 * admin. Un roster renommé, un budget corrigé ou un roster créé uniquement en
 * base restaient invisibles — et le « Restant » affiché au builder divergeait
 * de ce que `POST /team/build` acceptait.
 *
 * Même posture que `lib/tournament-rulesets` : cache module (une requête par
 * couple langue × ruleset et par onglet), repli sur le catalogue du moteur
 * tant que la liste n'est pas chargée ou si le réseau échoue — jamais d'écran
 * vide.
 */

import { useEffect, useState } from "react";
import { getRosterName } from "@bb/game-engine";
import { apiRequest } from "./api-client";

/** Un roster tel que le sert `GET /api/rosters`. */
export interface RosterCatalogEntry {
  readonly slug: string;
  readonly name: string;
  /** Budget de construction en kpo (`Roster.budget`). */
  readonly budget: number;
  readonly tier?: number | null;
  readonly naf?: boolean | null;
}

interface RostersResponse {
  rosters: Array<{
    slug: string;
    name: string;
    budget: number;
    tier?: number | null;
    naf?: boolean | null;
  }>;
}

export type RosterLang = "fr" | "en";

function key(lang: RosterLang, ruleset: string): string {
  return `${lang}::${ruleset}`;
}

const cache = new Map<string, readonly RosterCatalogEntry[]>();
const inFlight = new Map<string, Promise<readonly RosterCatalogEntry[]>>();

/** Vide le cache (édition admin dans le même onglet). */
export function invalidateRosterCatalogCache(): void {
  cache.clear();
  inFlight.clear();
}

/**
 * Liste des rosters pour une langue et un ruleset. Un échec réseau renvoie
 * une liste vide : les appelants retombent alors sur le catalogue du moteur.
 */
export function fetchRosterCatalog(
  lang: RosterLang = "fr",
  ruleset = "season_3",
): Promise<readonly RosterCatalogEntry[]> {
  const k = key(lang, ruleset);
  const cached = cache.get(k);
  if (cached) return Promise.resolve(cached);
  const pending = inFlight.get(k);
  if (pending) return pending;

  // `Promise.resolve` : ce catalogue est monté par des composants d'affichage
  // (RosterBadge) dont les tests mockent `apiRequest` sans couvrir cette URL.
  // Une valeur non-thenable ne doit pas faire tomber le rendu React.
  const request = Promise.resolve(
    apiRequest<RostersResponse>(
      `/api/rosters?lang=${lang}&ruleset=${encodeURIComponent(ruleset)}`,
    ),
  )
    .then((r) => {
      const list: readonly RosterCatalogEntry[] = (r?.rosters ?? []).map(
        (row) => ({
          slug: row.slug,
          name: row.name,
          budget: row.budget,
          tier: row.tier ?? null,
          naf: row.naf ?? null,
        }),
      );
      cache.set(k, list);
      return list;
    })
    .catch(() => [] as readonly RosterCatalogEntry[])
    .finally(() => {
      inFlight.delete(k);
    });
  inFlight.set(k, request);
  return request;
}

export interface UseRosterCatalog {
  readonly rosters: readonly RosterCatalogEntry[];
  readonly bySlug: ReadonlyMap<string, RosterCatalogEntry>;
  /**
   * Nom du roster : la base d'abord, le catalogue compilé en repli (tant que
   * la liste n'est pas chargée, ou pour un slug qu'elle ne contient pas).
   */
  readonly rosterName: (slug: string | null | undefined) => string;
  readonly loading: boolean;
}

/** Charge le catalogue une fois par couple langue × ruleset et par onglet. */
export function useRosterCatalog(
  lang: RosterLang = "fr",
  ruleset = "season_3",
): UseRosterCatalog {
  const [rosters, setRosters] = useState<readonly RosterCatalogEntry[]>(
    () => cache.get(key(lang, ruleset)) ?? [],
  );
  const [loading, setLoading] = useState(!cache.has(key(lang, ruleset)));

  useEffect(() => {
    let cancelled = false;
    setLoading(!cache.has(key(lang, ruleset)));
    fetchRosterCatalog(lang, ruleset).then((list) => {
      if (cancelled) return;
      setRosters(list);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [lang, ruleset]);

  const bySlug = new Map(rosters.map((r) => [r.slug, r]));
  return {
    rosters,
    bySlug,
    rosterName: (slug) => resolveRosterName(bySlug, slug),
    loading,
  };
}

/**
 * Nom d'un roster depuis une liste déjà chargée, repli sur le catalogue
 * compilé puis sur le slug brut. Pur : testable sans rendu React et
 * réutilisable côté serveur.
 */
export function resolveRosterName(
  bySlug: ReadonlyMap<string, { readonly name: string }>,
  slug: string | null | undefined,
): string {
  if (!slug) return "";
  return bySlug.get(slug)?.name || getRosterName(slug) || slug;
}
