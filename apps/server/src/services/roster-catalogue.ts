/**
 * Univers des rosters jouables — servi PAR LA BASE (lot 6.8).
 *
 * `ALLOWED_TEAMS` (`@bb/game-engine`) était une liste FIGÉE, dérivée des clés
 * de `TEAM_ROSTERS` : un roster créé en admin était visible dans le catalogue
 * public (`/api/rosters`, servi par la base) mais refusé par le builder
 * authentifié (« Roster non autorisé »), et un roster retiré en base restait
 * accepté à la création. Les deux lectures partent désormais de `Roster.slug`.
 *
 * Même posture que `tournament-ruleset-repository` : la base fait foi, le
 * catalogue compilé est le REPLI journalisé (table vide avant le premier
 * seed, base indisponible, miroir SQLite réduit), et un cache court évite de
 * relire la table à chaque création d'équipe.
 */

import { ALLOWED_TEAMS, DEFAULT_RULESET, type Ruleset } from "@bb/game-engine";
import { prisma } from "../prisma";
import { serverLog } from "../utils/server-log";

/** Cache court : la liste ne bouge qu'à une écriture admin (qui l'invalide). */
const TTL_MS = process.env.NODE_ENV === "production" ? 5 * 60 * 1000 : 0;

interface CachedSlugs {
  /** Slugs par ruleset, plus l'union sous la clé `ALL`. */
  readonly byRuleset: ReadonlyMap<string, ReadonlySet<string>>;
  readonly expiresAt: number;
}

/** Clé d'union (tous rulesets confondus). */
const ALL = "*";

let cache: CachedSlugs | null = null;

/** À appeler après toute écriture admin sur `Roster`. */
export function invalidateRosterCatalogueCache(): void {
  cache = null;
}

/** Repli compilé : les clés de `TEAM_ROSTERS`, pour tous les rulesets. */
function engineFallback(): ReadonlyMap<string, ReadonlySet<string>> {
  const all = new Set<string>(ALLOWED_TEAMS as readonly string[]);
  return new Map<string, ReadonlySet<string>>([[ALL, all]]);
}

async function load(): Promise<ReadonlyMap<string, ReadonlySet<string>>> {
  if (cache && cache.expiresAt > Date.now()) return cache.byRuleset;

  let byRuleset: ReadonlyMap<string, ReadonlySet<string>>;
  try {
    const rows = (await prisma.roster.findMany({
      select: { slug: true, ruleset: true },
    })) as Array<{ slug: string; ruleset: string }>;

    if (rows.length === 0) {
      // Table vide (avant le premier seed) : on ne bloque pas la création
      // d'équipe, on sert le catalogue compilé.
      serverLog.warn(
        "[roster-catalogue] table Roster vide — repli sur le catalogue compilé",
      );
      byRuleset = engineFallback();
    } else {
      const map = new Map<string, Set<string>>();
      const all = new Set<string>();
      for (const row of rows) {
        all.add(row.slug);
        const set = map.get(row.ruleset) ?? new Set<string>();
        set.add(row.slug);
        map.set(row.ruleset, set);
      }
      map.set(ALL, all);
      byRuleset = map;
    }
  } catch (e: unknown) {
    serverLog.error(
      "[roster-catalogue] lecture en base impossible — repli catalogue compilé",
      e,
    );
    byRuleset = engineFallback();
  }

  cache = { byRuleset, expiresAt: Date.now() + TTL_MS };
  return byRuleset;
}

/**
 * Slugs de rosters connus. `ruleset` absent ⇒ union de toutes les éditions
 * (comportement historique d'`ALLOWED_TEAMS`).
 */
export async function listRosterSlugs(
  ruleset?: Ruleset | null,
): Promise<readonly string[]> {
  const byRuleset = await load();
  const set = ruleset ? byRuleset.get(ruleset) : byRuleset.get(ALL);
  return [...(set ?? byRuleset.get(ALL) ?? new Set<string>())].sort();
}

/**
 * Le slug désigne-t-il un roster jouable ?
 *
 * Avec un `ruleset`, on accepte aussi un roster présent uniquement dans
 * l'édition par défaut : `getRosterFromDb` y retombe déjà quand le roster
 * manque dans l'édition demandée, et refuser ici ferait diverger la
 * validation de la lecture.
 */
export async function isAllowedTeamRoster(
  slug: string,
  ruleset?: Ruleset | null,
): Promise<boolean> {
  if (!slug) return false;
  const byRuleset = await load();
  if (!ruleset) return byRuleset.get(ALL)?.has(slug) === true;
  return (
    byRuleset.get(ruleset)?.has(slug) === true ||
    byRuleset.get(DEFAULT_RULESET)?.has(slug) === true ||
    // Repli compilé : aucune ligne pour ce ruleset (miroir SQLite réduit).
    (!byRuleset.has(ruleset) && byRuleset.get(ALL)?.has(slug) === true)
  );
}
