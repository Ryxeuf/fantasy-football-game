/**
 * Coût d'achat du staff d'une équipe, en pièces d'or.
 *
 * Fonction pure partagée par le panneau staff de l'édition et par le résumé
 * budgétaire de la page d'édition, pour qu'ils ne divergent jamais. La règle
 * reproduit celle appliquée par le serveur à la sauvegarde du roster
 * (`team-roster-save-handler`) : relances + cheerleaders + assistants +
 * apothicaire + fans dévoués achetés (le premier n'est offert qu'aux équipes
 * de LIGUE : règle pure `dedicatedFansPurchaseCost` du moteur).
 *
 * Tous les coûts unitaires viennent de la config `RosterStaffConfig` résolue
 * par roster × format (ligne DB éditable en admin, sinon défaut du moteur) :
 * aucune constante de coût n'est écrite en dur ici.
 */

import {
  dedicatedFansPurchaseCost,
  type RosterStaffConfig,
} from "@bb/game-engine";

export interface StaffCounts {
  readonly rerolls?: number | null;
  readonly cheerleaders?: number | null;
  readonly assistants?: number | null;
  readonly apothecary?: boolean | null;
  readonly dedicatedFans?: number | null;
  /**
   * Fan Dévoué offert : `false` = aucun (équipe hors ligue), chaque fan se
   * paie ; `true` / `null` / absent = le premier est offert.
   */
  readonly leagueFreeFan?: boolean | null;
}

export interface StaffSpendBreakdown {
  /** Relances d'équipe. */
  readonly rerollsCost: number;
  /** Cheerleaders + assistants + apothicaire. */
  readonly staffCost: number;
  /** Fans dévoués achetés (hors fan offert, s'il est compté). */
  readonly dedicatedFansCost: number;
  /** Somme des trois postes ci-dessus. */
  readonly total: number;
}

export function computeStaffSpend(
  counts: StaffCounts,
  config: RosterStaffConfig,
): StaffSpendBreakdown {
  const rerollsCost = Math.max(0, counts.rerolls ?? 0) * config.rerollCost;
  const staffCost =
    Math.max(0, counts.cheerleaders ?? 0) * config.cheerleaderCost +
    Math.max(0, counts.assistants ?? 0) * config.assistantCost +
    (counts.apothecary ? config.apothecaryCost : 0);
  const dedicatedFansCost = dedicatedFansPurchaseCost(
    Math.max(0, counts.dedicatedFans ?? 0),
    config.dedicatedFanCost,
    counts.leagueFreeFan,
  );

  return {
    rerollsCost,
    staffCost,
    dedicatedFansCost,
    total: rerollsCost + staffCost + dedicatedFansCost,
  };
}
