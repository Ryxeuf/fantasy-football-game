/**
 * Postes de staff d'une équipe partagée, avec leur coût — page publique
 * `/r/[token]`.
 *
 * La page n'affichait que des EFFECTIFS (« Relances 2 », « Apothicaire
 * Oui ») : un visiteur ne pouvait pas voir ce que l'équipe avait investi
 * hors joueurs. Les coûts servis par le serveur (`budgetSummary`,
 * `staffConfig`) font foi ; les défauts ne sont qu'un REPLI pour rester
 * lisible face à un serveur pré-correctif ou à un enrichissement en échec
 * (cf. « Backwards-compat sur champs API ajoutes »).
 *
 * Les défauts sont exactement ceux de `TeamInfoDisplay` (fiche du coach) :
 * les deux surfaces annonceraient sinon deux chiffres pour la même équipe.
 *
 * Module PUR : testable sans rendu React.
 */

import { getRerollCost } from "@bb/game-engine";

/** Défauts édition 2025, alignés sur `TeamInfoDisplay`. */
const DEFAULT_CHEERLEADER_COST = 10000;
const DEFAULT_ASSISTANT_COST = 10000;
const DEFAULT_APOTHECARY_COST = 50000;
const DEFAULT_DEDICATED_FAN_COST = 5000;

/** Coûts unitaires servis par le serveur (`RosterStaffConfig`). */
export interface StaffCostConfig {
  readonly rerollCost?: number;
  readonly cheerleaderCost?: number;
  readonly assistantCost?: number;
  readonly apothecaryCost?: number;
  readonly dedicatedFanCost?: number;
}

/** Postes de dépense déjà totalisés par le serveur. */
export interface StaffBudgetLike {
  readonly rerollsCost?: number;
  readonly dedicatedFansCost?: number;
}

export interface StaffLinesInput {
  readonly roster: string;
  readonly rerolls: number;
  readonly cheerleaders: number;
  readonly assistants: number;
  readonly apothecary: boolean;
  readonly dedicatedFans: number;
  readonly staffConfig?: StaffCostConfig;
  readonly budgetSummary?: StaffBudgetLike;
}

export interface StaffLine {
  readonly key: string;
  readonly label: string;
  /** Effectif du poste, ou « Oui »/« Non » pour l'apothicaire. */
  readonly value: string;
  /** Coût total du poste en po. `null` quand rien n'est acheté. */
  readonly costPo: number | null;
}

/** Coût nul ⇒ pas de ligne de coût affichée (poste non acheté). */
function costOrNull(cost: number): number | null {
  return cost > 0 ? cost : null;
}

/**
 * Les Fans Dévoués : le premier est offert à la création, les suivants se
 * paient. Même règle que `dedicatedFansPurchaseCost` côté serveur.
 */
export function dedicatedFansCostPo(
  dedicatedFans: number,
  unitCost: number,
): number {
  return Math.max(0, dedicatedFans - 1) * unitCost;
}

/**
 * Construit les 5 postes de staff affichés, coût compris. L'ordre est
 * celui de la feuille d'équipe : relances, pom-pom, assistants,
 * apothicaire, fans dévoués.
 */
export function buildStaffLines(input: StaffLinesInput): StaffLine[] {
  const cfg = input.staffConfig;
  const rerollCost = cfg?.rerollCost ?? getRerollCost(input.roster ?? "");
  const cheerleaderCost = cfg?.cheerleaderCost ?? DEFAULT_CHEERLEADER_COST;
  const assistantCost = cfg?.assistantCost ?? DEFAULT_ASSISTANT_COST;
  const apothecaryCost = cfg?.apothecaryCost ?? DEFAULT_APOTHECARY_COST;
  const dedicatedFanCost = cfg?.dedicatedFanCost ?? DEFAULT_DEDICATED_FAN_COST;

  return [
    {
      key: "rerolls",
      label: "Relances",
      value: String(input.rerolls),
      costPo: costOrNull(
        input.budgetSummary?.rerollsCost ?? input.rerolls * rerollCost,
      ),
    },
    {
      key: "cheerleaders",
      label: "Cheerleaders",
      value: String(input.cheerleaders),
      costPo: costOrNull(input.cheerleaders * cheerleaderCost),
    },
    {
      key: "assistants",
      label: "Assistants",
      value: String(input.assistants),
      costPo: costOrNull(input.assistants * assistantCost),
    },
    {
      key: "apothecary",
      label: "Apothicaire",
      value: input.apothecary ? "Oui" : "Non",
      costPo: costOrNull(input.apothecary ? apothecaryCost : 0),
    },
    {
      key: "dedicatedFans",
      label: "Fans dévoués",
      value: String(input.dedicatedFans),
      costPo: costOrNull(
        input.budgetSummary?.dedicatedFansCost ??
          dedicatedFansCostPo(input.dedicatedFans, dedicatedFanCost),
      ),
    },
  ];
}
