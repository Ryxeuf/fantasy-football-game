/**
 * Accès aux données pour les pages Ligues régionales.
 *
 * Le mapping Ligue → équipes éligibles vient de la BASE : `/api/rosters`
 * expose, pour chaque roster, ses `regionalLeagueOptions` résolues depuis
 * `Roster.regionalRules` (colonne éditable en admin, avec repli catalogue
 * côté serveur). On l'inverse ici pour obtenir, par Ligue, la liste des
 * équipes.
 *
 * Audit statique vs base — lot 5 (W8) : ces pages partaient de
 * `getRegionalLeaguesWithRosters` / `getRostersForRegionalLeague`, tables
 * compilées dans le bundle. Une Ligue retirée d'un roster en admin laissait
 * l'équipe listée, et une Ligue ajoutée en base sortait en 404.
 *
 * Le RÉFÉRENTIEL des Ligues (nom, description) reste porté par le moteur : la
 * table `RegionalLeague` existe mais n'est encore alimentée par personne
 * (cf. C10 de l'audit, lot 6).
 */

import { safeServerJson } from "../lib/serverApi";
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
  // Variante non-throwing : si l'API est injoignable (ex. build de prod sans
  // backend up), on dégrade gracieusement vers une carte vide. La page reste
  // robuste via `resolveRosters` (repli sur un nom dérivé du slug) et l'ISR
  // (revalidate 3600s) recharge les vrais noms dès que l'API répond.
  const data = await safeServerJson<{ rosters?: any[] }>(
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

/** Option de Ligue telle que servie par `/api/rosters`. */
interface RegionalLeagueOptionRow {
  slug?: string;
  name?: string;
}

/** Une Ligue et les rosters qui la déclarent, vus depuis la base. */
export interface LeagueRosterIndexEntry {
  readonly slug: string;
  /** Libellé servi par l'API (localisé). */
  readonly name: string;
  /** Slugs des rosters éligibles, dans l'ordre alphabétique de leur slug. */
  readonly rosterSlugs: readonly string[];
}

/**
 * Index Ligue → rosters éligibles, construit en inversant les
 * `regionalLeagueOptions` de chaque roster.
 *
 * API injoignable ou payload sans options ⇒ index VIDE : les appelants
 * retombent alors sur le catalogue du moteur, la page reste servie.
 */
export async function fetchLeagueRosterIndex(
  ruleset: string,
): Promise<Map<string, LeagueRosterIndexEntry>> {
  const base = getServerApiBase();
  const data = await safeServerJson<{
    rosters?: Array<{
      slug?: string;
      regionalLeagueOptions?: RegionalLeagueOptionRow[];
    }>;
  }>(`${base}/api/rosters?lang=fr&ruleset=${encodeURIComponent(ruleset)}`, {
    next: { revalidate: 3600, tags: ["rosters"] },
  });

  const acc = new Map<string, { name: string; rosters: Set<string> }>();
  for (const roster of data?.rosters ?? []) {
    if (!roster?.slug) continue;
    for (const option of roster.regionalLeagueOptions ?? []) {
      if (!option?.slug) continue;
      const entry = acc.get(option.slug) ?? {
        name: option.name || option.slug,
        rosters: new Set<string>(),
      };
      if (option.name) entry.name = option.name;
      entry.rosters.add(roster.slug);
      acc.set(option.slug, entry);
    }
  }

  const out = new Map<string, LeagueRosterIndexEntry>();
  for (const [slug, entry] of acc) {
    out.set(slug, {
      slug,
      name: entry.name,
      rosterSlugs: [...entry.rosters].sort(),
    });
  }
  return out;
}
