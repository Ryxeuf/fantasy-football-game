/**
 * Comptabilité du pool de PSP « de construction » d'une équipe.
 *
 * Une amélioration achetée hors match ne se paie pas sur les SPP du joueur
 * (qui valent 0 tant qu'il n'a pas joué) mais sur un pool alloué à l'équipe
 * (`Team.startingPspPool`) : mode « édition avancée » du builder, ou PSP de
 * départ imposés par une coupe.
 *
 * Historiquement, les PSP dépensés étaient RE-DÉRIVÉS du rang de chaque
 * amélioration dans la liste, via le barème standard BB2025. Faux dès qu'un
 * règlement de tournoi impose son propre barème, et impossible à distinguer
 * d'une amélioration gagnée en match. On persiste donc désormais le coût
 * réellement payé (`pspCost`) et sa source (`fundedBy`) sur l'amélioration.
 *
 * Rétro-compat : une amélioration sans `fundedBy` est comptée comme
 * financée par le pool (c'est ce que l'ancien affichage supposait), et son
 * coût retombe sur le barème standard indexé par son rang.
 */

import type { AdvancementType } from './advancements';

/** Barème standard BB2025 : coût du (rang+1)-ième avancement, par type. */
const STANDARD_PSP_COSTS: Readonly<Record<string, readonly number[]>> = {
  primary: [6, 8, 12, 16, 20, 30],
  secondary: [10, 12, 16, 20, 24, 34],
  'random-primary': [3, 4, 6, 8, 10, 15],
  characteristic: [14, 16, 20, 24, 28, 38],
};

/** Source de financement d'une amélioration. */
export type AdvancementFunding = 'pool' | 'player';

/** Forme minimale d'une amélioration pour la comptabilité du pool. */
export interface PoolFundedAdvancement {
  readonly type: AdvancementType | string;
  /** Coût PSP réellement payé. Absent sur les enregistrements historiques. */
  readonly pspCost?: number;
  /** Source du paiement. Absente => pool (comportement historique). */
  readonly fundedBy?: AdvancementFunding;
}

/**
 * Coût PSP d'une amélioration à son rang `index` (0 = première), tel qu'il
 * a été payé. Retombe sur le barème standard pour les enregistrements
 * historiques qui ne portent pas leur coût.
 */
export function advancementPspCost(
  adv: PoolFundedAdvancement,
  index: number,
): number {
  if (typeof adv.pspCost === 'number' && Number.isFinite(adv.pspCost)) {
    return Math.max(0, adv.pspCost);
  }
  const table = STANDARD_PSP_COSTS[adv.type];
  if (!table) return 0;
  return table[Math.min(Math.max(index, 0), table.length - 1)];
}

/** PSP prélevés sur le POOL par les améliorations d'un joueur. */
export function poolSpentForPlayer(
  advancements: readonly PoolFundedAdvancement[],
): number {
  return advancements.reduce(
    (sum, adv, index) =>
      adv.fundedBy === 'player' ? sum : sum + advancementPspCost(adv, index),
    0,
  );
}

/** PSP prélevés sur le pool par toute l'équipe. */
export function poolSpentForTeam(
  playersAdvancements: readonly (readonly PoolFundedAdvancement[])[],
): number {
  return playersAdvancements.reduce(
    (sum, advancements) => sum + poolSpentForPlayer(advancements),
    0,
  );
}

/** PSP restants dans le pool (jamais négatif à l'affichage). */
export function poolRemaining(pool: number, spent: number): number {
  return Math.max(0, pool - spent);
}

/**
 * Parse la colonne `TeamPlayer.advancements`, tolérante aux deux formes
 * (chaîne JSON en sqlite mirror, tableau natif en PostgreSQL).
 */
export function parseAdvancements(raw: unknown): PoolFundedAdvancement[] {
  const parsed: unknown =
    typeof raw === 'string'
      ? (() => {
          try {
            return JSON.parse(raw);
          } catch {
            return [];
          }
        })()
      : raw;
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (a): a is PoolFundedAdvancement =>
      typeof a === 'object' && a !== null && typeof (a as { type?: unknown }).type === 'string',
  );
}
