/**
 * « Joue pour » d'un Star Player : rosters concrets pouvant le recruter,
 * résolus depuis les rosters EN BASE du même ruleset.
 *
 * Pourquoi la base et pas le catalogue statique : `Roster.regionalRules`
 * est la source de vérité (éditable en admin) et diffère par saison. La
 * fiche publique dérivait la liste du catalogue compilé du game-engine,
 * dont la table Saison 3 garde des Ligues Saison 2 (Halflings en Old World
 * Classic, Nains du Chaos en Worlds Edge Superleague) : Thorsson Stoutmead
 * (S3 : Old World Classic + Worlds Edge) s'affichait « joue pour » les
 * Nains du Chaos et les Halflings, que la création d'équipe refuse ensuite.
 */

import { getRostersForStarPlayer, type Ruleset } from '@bb/game-engine';
import { effectiveRegionalRules } from './roster-regional-rules';

export const HIRABLE_BY_ALL = 'all';

export interface RosterRegionalRulesRow {
  readonly slug: string;
  readonly regionalRules: readonly string[];
}

/**
 * Rosters d'un ruleset avec leurs Ligues EFFECTIVES (base, repli catalogue
 * si la colonne est vide). Tolérant : `[]` si le client ne porte pas le
 * modèle (schéma SQLite réduit, mocks étroits) — l'appelant retombe alors
 * sur le catalogue.
 */
export async function loadRosterRegionalRules(
  db: unknown,
  ruleset: Ruleset,
): Promise<RosterRegionalRulesRow[]> {
  try {
    const client = db as {
      roster: {
        findMany: (
          args: unknown,
        ) => Promise<Array<{ slug: string; regionalRules: unknown }> | undefined>;
      };
    };
    const rows = (await client.roster.findMany({
      where: { ruleset },
      select: { slug: true, regionalRules: true },
    })) ?? [];
    return rows.map((r) => ({
      slug: r.slug,
      regionalRules: effectiveRegionalRules(r.regionalRules, r.slug, ruleset)
        .rules,
    }));
  } catch {
    return [];
  }
}

/**
 * Pur : un roster peut recruter si `hirableBy` contient `all`, son slug, ou
 * l'une de ses Ligues régionales. Trié par slug (stable).
 */
export function resolvePlaysFor(
  hirableBy: readonly string[],
  rosters: readonly RosterRegionalRulesRow[],
): string[] {
  if (hirableBy.length === 0) return [];
  const criteria = new Set(hirableBy);
  if (criteria.has(HIRABLE_BY_ALL)) {
    return rosters.map((r) => r.slug).sort();
  }
  return rosters
    .filter(
      (r) =>
        criteria.has(r.slug) ||
        r.regionalRules.some((rule) => criteria.has(rule)),
    )
    .map((r) => r.slug)
    .sort();
}

/**
 * Base d'abord, catalogue du moteur en repli (aucun roster chargé).
 */
export function playsForWithFallback(
  hirableBy: readonly string[],
  rosters: readonly RosterRegionalRulesRow[],
  ruleset: Ruleset,
): string[] {
  if (rosters.length > 0) return resolvePlaysFor(hirableBy, rosters);
  return getRostersForStarPlayer({ hirableBy: [...hirableBy] }, ruleset);
}
