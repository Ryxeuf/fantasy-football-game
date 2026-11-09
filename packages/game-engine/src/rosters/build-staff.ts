/**
 * Staff acheté À LA CONSTRUCTION d'une équipe (relances, pom-pom girls,
 * assistants, apothicaire, Fans Dévoués) : plafonds et tarif.
 *
 * Source UNIQUE partagée par le builder complet (`POST /team/build`), la
 * création simplifiée depuis un roster (`POST /team/create-from-roster`,
 * assistant de première équipe) et leurs écrans : deux flux qui tarifaient
 * chacun le staff auraient fini par diverger.
 *
 * Pur. Montants en po entiers, comme `RosterStaffConfig`. Aucun Fan Dévoué
 * n'est offert à la construction : le premier fan gratuit est une règle de
 * LIGUE, accordée à l'inscription (`dedicated-fans`).
 */

import { dedicatedFansPurchaseCost } from "./dedicated-fans";
import type { FormatValidationResult, StaffLimits } from "./formats";
import type { RosterStaffConfig } from "./staff-config";

export interface BuildStaffSelection {
  readonly rerolls: number;
  readonly cheerleaders: number;
  readonly assistants: number;
  readonly apothecary: boolean;
  readonly dedicatedFans: number;
}

/** Aucun staff : l'état d'une équipe créée sans en acheter. */
export const EMPTY_BUILD_STAFF: BuildStaffSelection = Object.freeze({
  rerolls: 0,
  cheerleaders: 0,
  assistants: 0,
  apothecary: false,
  dedicatedFans: 0,
});

export type BuildStaffCosts = Pick<
  RosterStaffConfig,
  | "rerollCost"
  | "cheerleaderCost"
  | "assistantCost"
  | "apothecaryCost"
  | "dedicatedFanCost"
>;

/** Complète une sélection partielle (champs absents = 0 / sans apothicaire). */
export function normalizeBuildStaff(
  partial: Partial<BuildStaffSelection> | null | undefined,
): BuildStaffSelection {
  return {
    rerolls: partial?.rerolls ?? 0,
    cheerleaders: partial?.cheerleaders ?? 0,
    assistants: partial?.assistants ?? 0,
    apothecary: partial?.apothecary ?? false,
    dedicatedFans: partial?.dedicatedFans ?? 0,
  };
}

/**
 * Plafonds du staff (par roster × format). Renvoie la première violation.
 * Messages historiques de `validateFormatSelection`, qui délègue ici.
 */
export function validateBuildStaff(
  selection: BuildStaffSelection,
  limits: StaffLimits,
): FormatValidationResult {
  const counts: ReadonlyArray<readonly [number, string]> = [
    [selection.rerolls, "relances"],
    [selection.cheerleaders, "cheerleaders"],
    [selection.assistants, "coachs assistants"],
    [selection.dedicatedFans, "fans dévoués"],
  ];
  for (const [value, label] of counts) {
    if (!Number.isInteger(value) || value < 0) {
      return { valid: false, error: `Nombre de ${label} invalide` };
    }
  }
  if (selection.rerolls > limits.maxRerolls) {
    return { valid: false, error: `Maximum ${limits.maxRerolls} relances dans ce format` };
  }
  if (selection.cheerleaders > limits.maxCheerleaders) {
    return { valid: false, error: `Maximum ${limits.maxCheerleaders} cheerleaders dans ce format` };
  }
  if (selection.assistants > limits.maxAssistants) {
    return { valid: false, error: `Maximum ${limits.maxAssistants} coachs assistants dans ce format` };
  }
  if (selection.dedicatedFans > limits.maxDedicatedFans) {
    return { valid: false, error: `Maximum ${limits.maxDedicatedFans} fans dévoués dans ce format` };
  }
  if (selection.apothecary && !limits.apothecaryAllowed) {
    return { valid: false, error: "L'apothicaire n'est pas autorisé pour cette équipe" };
  }
  return { valid: true };
}

/** Coût (po) du staff acheté à la construction — chaque fan est payé. */
export function buildStaffCostPo(
  selection: BuildStaffSelection,
  costs: BuildStaffCosts,
): number {
  return (
    selection.rerolls * costs.rerollCost +
    selection.cheerleaders * costs.cheerleaderCost +
    selection.assistants * costs.assistantCost +
    (selection.apothecary ? costs.apothecaryCost : 0) +
    dedicatedFansPurchaseCost(selection.dedicatedFans, costs.dedicatedFanCost, false)
  );
}
