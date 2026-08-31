/**
 * Ce qu'une équipe peut ACHETER à l'étape 4 de la séquence d'après-match
 * (embauches), et à quel prix.
 *
 * La feuille de match laissait le coach saisir un poste libre et un montant
 * libre : rien ne garantissait que le poste existe au roster, qu'il reste un
 * slot, ni que le prix soit le bon. Le montant saisi étant celui qui débite
 * la trésorerie, une faute de frappe passait directement en base.
 *
 * Deux règles BB sont portées ici :
 *
 *  - une position a un QUOTA (0-2 Blitzers…) et l'effectif est plafonné par
 *    le format (16 en BB11, 11 en Sevens) : un poste complet n'est pas
 *    proposé ;
 *  - une relance achetée APRÈS la création de l'équipe coûte le DOUBLE de
 *    son prix de construction (c'est déjà ce qu'applique
 *    `team-purchase-handler`). Une relance Haut Elfe à 50 000 po s'achète
 *    donc 100 000 po en fin de match.
 *
 * 100 % PUR : l'appelant fournit le catalogue du roster, l'effectif et la
 * config de staff. Le même calcul sert donc à l'affichage et pourra servir
 * à la validation.
 */

/** Poste du roster, tel que le sert `getRosterFromDb` (coût en kpo). */
export interface PurchaseSourcePosition {
  readonly slug: string;
  readonly displayName: string;
  /** Coût de recrutement en kpo (catalogue). */
  readonly cost: number;
  /** Quota du roster pour ce poste (0-2, 0-16…). */
  readonly max: number;
}

/** Config de staff résolue pour le roster × format (montants en po). */
export interface PurchaseStaffConfig {
  readonly rerollCost: number;
  readonly maxRerolls: number;
  readonly apothecaryAllowed: boolean;
  readonly apothecaryCost: number;
  readonly maxCheerleaders: number;
  readonly cheerleaderCost: number;
  readonly maxAssistants: number;
  readonly assistantCost: number;
  readonly maxDedicatedFans: number;
  readonly dedicatedFanCost: number;
}

/** État courant de l'équipe, côté effectif et staff. */
export interface PurchaseTeamState {
  /** Nombre de joueurs ACTIFS par slug de poste. */
  readonly countsByPosition: Readonly<Record<string, number>>;
  /** Effectif actif total. */
  readonly playerCount: number;
  /** Plafond d'effectif du format (BB11 16, Sevens 11). */
  readonly maxPlayers: number;
  readonly rerolls: number;
  readonly cheerleaders: number;
  readonly assistants: number;
  readonly apothecary: boolean;
  readonly dedicatedFans: number;
}

/** Un poste proposé à l'embauche, avec son prix en po. */
export interface PurchasePositionOption {
  readonly slug: string;
  readonly name: string;
  /** Prix de recrutement en po. */
  readonly cost: number;
  readonly currentCount: number;
  readonly maxCount: number;
  /** Faux si le quota du poste ou l'effectif du format est atteint. */
  readonly canAdd: boolean;
}

export type PurchaseStaffKind =
  | "reroll"
  | "assistant"
  | "cheerleader"
  | "apothecary"
  | "dedicated_fan";

/** Un élément de staff proposé, avec son prix en po. */
export interface PurchaseStaffOption {
  readonly kind: PurchaseStaffKind;
  readonly name: string;
  /** Prix à l'achat d'APRÈS-MATCH (relance : prix de construction × 2). */
  readonly cost: number;
  readonly currentCount: number;
  readonly maxCount: number;
  readonly canAdd: boolean;
}

export interface PurchaseOptions {
  readonly positions: readonly PurchasePositionOption[];
  readonly staff: readonly PurchaseStaffOption[];
}

/** Le catalogue exprime les coûts de poste en kpo ; la feuille en po. */
const KPO_TO_PO = 1000;

/**
 * Règle BB : une relance achetée après la création de l'équipe coûte le
 * double. Les achats de la feuille de match sont, par construction, des
 * achats d'après-match.
 */
const POST_MATCH_REROLL_MULTIPLIER = 2;

export const EMPTY_PURCHASE_OPTIONS: PurchaseOptions = {
  positions: [],
  staff: [],
};

/**
 * Postes et staff achetables, avec leur prix. Les postes gardent l'ordre du
 * catalogue ; ceux dont le quota est atteint sont conservés mais marqués
 * `canAdd: false`, pour que l'UI puisse les montrer grisés plutôt que de
 * les faire disparaître sans explication.
 */
export function buildPurchaseOptions(input: {
  readonly positions: readonly PurchaseSourcePosition[];
  readonly staff: PurchaseStaffConfig;
  readonly team: PurchaseTeamState;
}): PurchaseOptions {
  const { team, staff } = input;
  const rosterFull = team.playerCount >= team.maxPlayers;

  const positions = input.positions.map((p) => {
    const currentCount = team.countsByPosition[p.slug] ?? 0;
    return {
      slug: p.slug,
      name: p.displayName,
      cost: p.cost * KPO_TO_PO,
      currentCount,
      maxCount: p.max,
      canAdd: currentCount < p.max && !rosterFull,
    };
  });

  const staffOptions: PurchaseStaffOption[] = [
    {
      kind: "reroll",
      name: "Relance d'équipe",
      cost: staff.rerollCost * POST_MATCH_REROLL_MULTIPLIER,
      currentCount: team.rerolls,
      maxCount: staff.maxRerolls,
      canAdd: team.rerolls < staff.maxRerolls,
    },
    {
      kind: "assistant",
      name: "Assistant",
      cost: staff.assistantCost,
      currentCount: team.assistants,
      maxCount: staff.maxAssistants,
      canAdd: team.assistants < staff.maxAssistants,
    },
    {
      kind: "cheerleader",
      name: "Pom-pom girl",
      cost: staff.cheerleaderCost,
      currentCount: team.cheerleaders,
      maxCount: staff.maxCheerleaders,
      canAdd: team.cheerleaders < staff.maxCheerleaders,
    },
    {
      kind: "apothecary",
      name: "Apothicaire",
      cost: staff.apothecaryCost,
      currentCount: team.apothecary ? 1 : 0,
      maxCount: staff.apothecaryAllowed ? 1 : 0,
      // Certains rosters n'y ont pas droit du tout (mort-vivants…).
      canAdd: staff.apothecaryAllowed && !team.apothecary,
    },
    {
      kind: "dedicated_fan",
      name: "Fan dévoué",
      cost: staff.dedicatedFanCost,
      currentCount: team.dedicatedFans,
      maxCount: staff.maxDedicatedFans,
      canAdd: team.dedicatedFans < staff.maxDedicatedFans,
    },
  ];

  return { positions, staff: staffOptions };
}

/** Compte les joueurs actifs par slug de poste. */
export function countByPosition(
  players: ReadonlyArray<{ readonly position: string }>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of players) {
    counts[p.position] = (counts[p.position] ?? 0) + 1;
  }
  return counts;
}
