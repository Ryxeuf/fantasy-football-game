/**
 * Config staff d'équipe, résolue par roster ET par format.
 *
 * Type canonique partagé entre le serveur (lecture du modèle Prisma
 * `RosterStaffConfig`), le web (builder / affichage) et ce package pur
 * (validation, calcul de VE). Tous les montants sont en **po entiers**
 * (ex. 50000), comme `REROLL_COSTS` et `team-value-calculator`.
 *
 * `defaultStaffConfig()` dérive la config depuis les constantes historiques
 * (`getRerollCost` + `FORMAT_CONSTRAINTS` + `canRosterHaveApothecary`). Elle est
 * la **source unique** à la fois pour :
 *   - le seed initial du modèle DB (iso-comportement après bascule),
 *   - le fallback quand aucune ligne `RosterStaffConfig` n'existe encore.
 */

import { getFormatConstraints, type GameFormat } from "./formats";
import { getRerollCost } from "./reroll-costs";
import { canRosterHaveApothecary } from "./apothecary-access";

export interface RosterStaffConfig {
  /** Coût d'une relance d'équipe (po). */
  rerollCost: number;
  /** Plafond de relances achetables. */
  maxRerolls: number;
  /** L'apothicaire est-il recrutable pour ce roster ? */
  apothecaryAllowed: boolean;
  /** Coût de l'apothicaire (po). */
  apothecaryCost: number;
  maxCheerleaders: number;
  /** po */
  cheerleaderCost: number;
  /** Coachs assistants. */
  maxAssistants: number;
  /** po */
  assistantCost: number;
  maxDedicatedFans: number;
  /** po (le 1er fan est gratuit). */
  dedicatedFanCost: number;
}

/** kpo → po. Les `FORMAT_CONSTRAINTS` sont en kpo, la config DB en po. */
const KPO = 1000;

/**
 * Config staff par défaut pour un roster + format, dérivée des constantes
 * historiques. Pur. Le coût de relance applique le multiplicateur de format
 * (Sevens = ×2), comportement historique conservé.
 */
export function defaultStaffConfig(
  rosterSlug: string,
  format: GameFormat,
): RosterStaffConfig {
  const c = getFormatConstraints(format);
  return {
    rerollCost: getRerollCost(rosterSlug) * c.rerollCostMultiplier,
    maxRerolls: c.maxRerolls,
    apothecaryAllowed: canRosterHaveApothecary(rosterSlug) && c.apothecaryAllowed,
    apothecaryCost: c.apothecaryCost * KPO,
    maxCheerleaders: c.maxCheerleaders,
    cheerleaderCost: c.cheerleaderCost * KPO,
    maxAssistants: c.maxAssistants,
    assistantCost: c.assistantCost * KPO,
    maxDedicatedFans: c.maxDedicatedFans,
    dedicatedFanCost: c.dedicatedFanCost * KPO,
  };
}
