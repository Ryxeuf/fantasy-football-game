/**
 * Statistiques dérivées d'un roster pour la carte « Statistiques du
 * roster » de `/teams/[slug]`.
 *
 * Remplace les anciens « coût minimum » (min de cost×min, presque
 * toujours 0k) et « coût maximum » (somme de tous les slots au max,
 * un total que personne n'achète) par des chiffres qu'un coach utilise
 * vraiment : la fourchette de coût d'un joueur, le prix d'un onze de
 * départ légal et la marge restante sur le budget standard.
 */

export interface RosterStatsPosition {
  readonly cost: number; // en kPO
  readonly min: number;
  readonly max: number;
}

/** Budget de création standard d'une équipe, en kPO. */
export const STANDARD_BUDGET_K = 1000;

/** Taille d'une équipe alignée sur le terrain. */
const ELEVEN = 11;

/** Fourchette de coût unitaire des postes du roster, en kPO. */
export function playerCostRange(
  positions: readonly RosterStatsPosition[],
): { min: number; max: number } | null {
  if (positions.length === 0) return null;
  let min = Infinity;
  let max = -Infinity;
  for (const p of positions) {
    if (p.cost < min) min = p.cost;
    if (p.cost > max) max = p.cost;
  }
  return { min, max };
}

/**
 * Coût minimal, en kPO, d'un effectif légal d'au moins 11 joueurs :
 * les minimums de chaque poste sont obligatoires, puis on complète
 * jusqu'à 11 avec les postes les moins chers, dans la limite de leur
 * maximum. `null` si le roster ne peut pas aligner 11 joueurs.
 */
export function startingElevenCost(
  positions: readonly RosterStatsPosition[],
): number | null {
  if (positions.length === 0) return null;

  let count = 0;
  let cost = 0;
  for (const p of positions) {
    count += p.min;
    cost += p.min * p.cost;
  }

  if (count < ELEVEN) {
    const byCost = [...positions].sort((a, b) => a.cost - b.cost);
    for (const p of byCost) {
      const available = p.max - p.min;
      if (available <= 0) continue;
      const take = Math.min(available, ELEVEN - count);
      count += take;
      cost += take * p.cost;
      if (count >= ELEVEN) break;
    }
  }

  return count >= ELEVEN ? cost : null;
}

/**
 * Marge restante, en kPO, sur le budget de création standard une fois
 * le onze de départ payé — ce qui reste pour les relances, le staff et
 * les remplaçants. Jamais négative.
 */
export function budgetHeadroom(
  positions: readonly RosterStatsPosition[],
  budgetK: number = STANDARD_BUDGET_K,
): number | null {
  const eleven = startingElevenCost(positions);
  if (eleven === null) return null;
  return Math.max(0, budgetK - eleven);
}
