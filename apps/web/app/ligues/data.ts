/**
 * Accès aux données pour les pages Ligues régionales.
 *
 * Les Ligues et leur mapping vers les rosters sont des données pures du
 * game-engine (`getRegionalLeaguesWithRosters`). Les **noms** d'équipes (et
 * tier) proviennent de l'API publique `/api/rosters` pour rester cohérents
 * avec le reste du site et localisés. On fusionne les deux ici.
 */

import { fetchServerJson } from "../lib/serverApi";
import { getServerApiBase } from "../lib/serverApi";

export interface RosterInfo {
  slug: string;
  name: string;
  tier: string;
  naf: boolean;
  positionCount: number;
}

/** Carte slug → infos roster, depuis `/api/rosters` (ISR, tag `rosters`). */
export async function fetchRosterMap(
  ruleset: string,
): Promise<Map<string, RosterInfo>> {
  const base = getServerApiBase();
  const data = await fetchServerJson<{ rosters?: any[] }>(
    `${base}/api/rosters?lang=fr&ruleset=${encodeURIComponent(ruleset)}`,
    { next: { revalidate: 3600, tags: ["rosters"] } },
  );
  const map = new Map<string, RosterInfo>();
  for (const roster of data?.rosters ?? []) {
    map.set(roster.slug, {
      slug: roster.slug,
      name: roster.name,
      tier: roster.tier,
      naf: roster.naf,
      positionCount: roster._count?.positions ?? 0,
    });
  }
  return map;
}

/**
 * Résout une liste de slugs de rosters en infos affichables, dans l'ordre
 * d'entrée. Repli sur un nom « joli » dérivé du slug si le roster est absent
 * de l'API (édition différente, donnée manquante) — la page reste robuste.
 */
export function resolveRosters(
  slugs: readonly string[],
  map: Map<string, RosterInfo>,
): RosterInfo[] {
  return slugs.map(
    (slug) =>
      map.get(slug) ?? {
        slug,
        name: prettifyRosterSlug(slug),
        tier: "",
        naf: false,
        positionCount: 0,
      },
  );
}

function prettifyRosterSlug(slug: string): string {
  return slug
    .split(/[_-]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
