/**
 * Quotas de qualifiés par poule, tels que le panneau de lancement des
 * play-offs les annonce — ligue ET coupe (PUR, sans React).
 *
 * L'API sert `totalQualified`, la SOMME des quotas de toutes les poules.
 * Affichée seule sous « Qualifiés par poule », elle se lisait comme un quota
 * par poule : deux poules à 4 annonçaient « 8 par poule ». Le panneau
 * l'annonce donc comme un total, détaillé poule par poule quand l'API sert
 * le détail (`pools`, optionnel : API antérieure).
 */

/** Quota d'une poule, tel que servi par `poolQualification.pools`. */
export interface PoolQuotaView {
  readonly poolId: string;
  readonly name: string;
  readonly qualifiesForPlayoffs: number;
}

/** Libellé d'une entrée du détail (la ponctuation dépend de la langue). */
export type PoolQuotaEntryFormatter = (name: string, count: number) => string;

const frenchEntry: PoolQuotaEntryFormatter = (name, count) =>
  `${name} : ${count}`;

/**
 * « Poule A : 4 · Poule B : 4 », ou `null` sans détail exploitable. Les
 * poules à 0 restent listées : quand la somme ne colle pas à la taille du
 * bracket, c'est souvent elles qui manquent.
 */
export function formatPoolBreakdown(
  pools: readonly PoolQuotaView[] | undefined,
  entry: PoolQuotaEntryFormatter = frenchEntry,
): string | null {
  if (!pools || pools.length === 0) return null;
  return pools.map((p) => entry(p.name, p.qualifiesForPlayoffs)).join(" · ");
}
