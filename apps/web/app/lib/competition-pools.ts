/**
 * Groupement par poule, commun à la ligue et à la coupe.
 *
 * La règle est la MÊME des deux côtés — on ne découpe que si au moins deux
 * poules sont réellement représentées, on trie par nom, on remonte la poule
 * du coach connecté, et les non-affectés forment un groupe sentinelle plutôt
 * que de disparaître. Seule diffère la façon de lire la poule d'une
 * rencontre : la ligue passe par son participant, la coupe par son équipe.
 * D'où un `poolIdOf` en argument et aucune connaissance des deux modèles
 * ici.
 *
 * Pur : testable sans DOM.
 */

/**
 * Ordre d'affichage des poules : celle du coach connecté d'abord.
 *
 * Les autres gardent leur ordre d'origine (celui du commissaire), et sans
 * poule préférée l'ordre n'est jamais modifié.
 */
export function putPoolFirst<T>(
  items: readonly T[],
  poolIdOf: (item: T) => string | null | undefined,
  preferredPoolId: string | null | undefined,
): T[] {
  if (!preferredPoolId) return [...items];
  const mine: T[] = [];
  const others: T[] = [];
  for (const item of items) {
    if (poolIdOf(item) === preferredPoolId) mine.push(item);
    else others.push(item);
  }
  return [...mine, ...others];
}

export interface PoolGroup<T> {
  readonly poolId: string | null;
  /** `null` pour le groupe des non-affectés. */
  readonly poolName: string | null;
  readonly items: readonly T[];
}

/**
 * Range des rencontres par poule, ou rend `null` quand le découpage
 * n'apprendrait rien : aucune poule déclarée, ou une seule effectivement
 * représentée. `null` veut dire « affiche la liste telle quelle » — un
 * groupe unique coifferait chaque journée d'un bandeau inutile.
 */
export function groupByPool<T>(
  items: readonly T[],
  poolIdOf: (item: T) => string | null | undefined,
  poolNamesById: Readonly<Record<string, string>>,
  preferredPoolId: string | null = null,
): Array<PoolGroup<T>> | null {
  if (Object.keys(poolNamesById).length === 0) return null;

  const groups = new Map<string | null, { poolId: string | null; poolName: string | null; items: T[] }>();
  for (const item of items) {
    const poolId = poolIdOf(item) ?? null;
    const existing = groups.get(poolId);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.set(poolId, {
        poolId,
        poolName: poolId ? (poolNamesById[poolId] ?? null) : null,
        items: [item],
      });
    }
  }
  if (groups.size <= 1) return null;

  // `￿` (U+FFFF) trie après toute lettre : les non-affectés ferment la
  // marche, quel que soit le nom des poules.
  const sorted = Array.from(groups.values()).sort((a, b) =>
    (a.poolName ?? "￿").localeCompare(b.poolName ?? "￿"),
  );
  return putPoolFirst(sorted, (g) => g.poolId, preferredPoolId);
}
