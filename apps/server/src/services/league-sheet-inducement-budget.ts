/**
 * Budget de coups de pouce d'avant-match d'une feuille (ligue ou coupe) — PUR.
 *
 * Séquence BB2025 (compendium, « Coups de pouce ») :
 *  1. l'équipe à la VEA la plus haute (le FAVORI) dépense d'abord sa
 *     trésorerie ;
 *  2. l'outsider reçoit une Petite Monnaie = écart de VEA + ce que le favori a
 *     dépensé de sa trésorerie ;
 *  3. il la dépense, plus jusqu'à 50 000 po de sa propre trésorerie ;
 *  4. à VEA égales, aucune équipe ne puise dans sa trésorerie.
 *
 * LA source du budget servi à la LECTURE de la feuille, vérifié au PATCH
 * d'avant-match et débité à la VALIDATION : les trois partent d'ici (avec la
 * dépense adverse STOCKÉE), sinon l'outsider voit un budget qui n'est pas
 * celui qu'on lui applique — c'était le cas, la lecture passait une dépense
 * adverse nulle.
 *
 * En COUPE, ni trésorerie ni dépense adverse : la petite monnaie est l'écart
 * de VEA, rien d'autre (cf. « la trésorerie fictive d'une coupe »).
 */

import { calculatePettyCash } from "@bb/game-engine";

export type SheetSide = "home" | "away";

/** Plafond de trésorerie que l'outsider ajoute à sa Petite Monnaie (ligue). */
export const LEAGUE_UNDERDOG_INDUCEMENT_BONUS = 50000;

/** Budget d'un côté, avec le détail de sa composition. */
export interface InducementSideBudget {
  /** VEA du match. */
  readonly ctv: number;
  /** Trésorerie de l'équipe (0 en coupe). */
  readonly treasury: number;
  /** Petite Monnaie = écart de VEA + dépense adverse (outsider seulement). */
  readonly pettyCash: number;
  /** Budget total dépensable = Petite Monnaie + trésorerie mobilisable. */
  readonly maxBudget: number;
  /** Écart de VEA reçu (0 pour le favori et à VEA égales). */
  readonly ctvGap: number;
  /** Dépense adverse ajoutée à la Petite Monnaie (0 hors outsider de ligue). */
  readonly opponentSpent: number;
  /** Part de la trésorerie mobilisable (plafonnée à 50 000 po pour l'outsider). */
  readonly treasuryAllowance: number;
}

export interface InducementBudget {
  readonly home: InducementSideBudget;
  readonly away: InducementSideBudget;
  /** Côté à la VEA strictement la plus haute, `null` à VEA égales. */
  readonly favorite: SheetSide | null;
}

export interface InducementBudgetInput {
  readonly ctvHome: number;
  readonly ctvAway: number;
  readonly treasuryHome: number;
  readonly treasuryAway: number;
  /** Dépense de coups de pouce engagée par chaque côté (stockée ou saisie). */
  readonly spentHome: number;
  readonly spentAway: number;
  /** Feuille de coupe : aucune trésorerie, aucune dépense adverse. */
  readonly isCup: boolean;
  /** L'avant-match vend-il des coups de pouce ? (coupe `build`/`none` : non) */
  readonly sellsInducements: boolean;
}

function sideBudget(input: {
  ctv: number;
  treasury: number;
  pettyCash: number;
  maxBudget: number;
  ctvGap: number;
  sells: boolean;
}): InducementSideBudget {
  if (!input.sells) {
    return {
      ctv: input.ctv,
      treasury: input.treasury,
      pettyCash: 0,
      maxBudget: 0,
      ctvGap: 0,
      opponentSpent: 0,
      treasuryAllowance: 0,
    };
  }
  return {
    ctv: input.ctv,
    treasury: input.treasury,
    pettyCash: input.pettyCash,
    maxBudget: input.maxBudget,
    ctvGap: input.ctvGap,
    opponentSpent: Math.max(0, input.pettyCash - input.ctvGap),
    treasuryAllowance: Math.max(0, input.maxBudget - input.pettyCash),
  };
}

/** Budget EFFECTIF des deux côtés (règle du moteur + détail servi à l'UI). */
export function computeInducementBudget(
  input: InducementBudgetInput,
): InducementBudget {
  const treasuryHome = input.isCup ? 0 : Math.max(0, input.treasuryHome);
  const treasuryAway = input.isCup ? 0 : Math.max(0, input.treasuryAway);
  const petty = calculatePettyCash({
    ctvTeamA: input.ctvHome,
    ctvTeamB: input.ctvAway,
    treasuryTeamA: treasuryHome,
    treasuryTeamB: treasuryAway,
    underdogBonus: input.isCup ? 0 : LEAGUE_UNDERDOG_INDUCEMENT_BONUS,
    spentTeamA: input.isCup ? 0 : input.spentHome,
    spentTeamB: input.isCup ? 0 : input.spentAway,
  });
  const diff = input.ctvHome - input.ctvAway;
  return {
    home: sideBudget({
      ctv: input.ctvHome,
      treasury: treasuryHome,
      pettyCash: petty.teamA.pettyCash,
      maxBudget: petty.teamA.maxBudget,
      ctvGap: diff < 0 ? -diff : 0,
      sells: input.sellsInducements,
    }),
    away: sideBudget({
      ctv: input.ctvAway,
      treasury: treasuryAway,
      pettyCash: petty.teamB.pettyCash,
      maxBudget: petty.teamB.maxBudget,
      ctvGap: diff > 0 ? diff : 0,
      sells: input.sellsInducements,
    }),
    favorite: diff > 0 ? "home" : diff < 0 ? "away" : null,
  };
}

/**
 * Message du refus « budget dépassé ». Il détaille la trésorerie MOBILISABLE,
 * jamais la trésorerie de l'équipe : à VEA égales elle vaut 0, et l'outsider
 * n'en mobilise que 50 000 po — annoncer le solde ferait croire à un budget
 * que le calcul ne donne pas.
 */
export function inducementOverBudgetMessage(
  sideLabel: string,
  spent: number,
  side: InducementSideBudget,
): string {
  const gold = (value: number): string => value.toLocaleString("fr-FR");
  return `Budget de coups de pouce dépassé (${sideLabel}) : ${gold(spent)} po pour un budget de ${gold(side.maxBudget)} po (petite monnaie ${gold(side.pettyCash)} + trésorerie mobilisable ${gold(side.treasuryAllowance)}).`;
}

/**
 * Somme tolérante des coûts (or) d'une liste JSON `[{ cost, qty? }]` (coups
 * de pouce / erreurs coûteuses / achats). Accepte array natif (PG) ou chaîne
 * sérialisée (miroir SQLite). Ignore les entrées illisibles.
 */
export function sumGoldEntries(raw: unknown): number {
  let arr: unknown = raw;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch {
      return 0;
    }
  }
  if (!Array.isArray(arr)) return 0;
  let total = 0;
  for (const entry of arr) {
    if (!entry || typeof entry !== "object") continue;
    const cost = (entry as { cost?: unknown }).cost;
    const qty = (entry as { qty?: unknown }).qty;
    const c = typeof cost === "number" && Number.isFinite(cost) ? cost : 0;
    const q =
      typeof qty === "number" && Number.isFinite(qty) && qty > 0 ? qty : 1;
    total += Math.max(0, Math.floor(c)) * q;
  }
  return total;
}

export interface SheetInducementColumns {
  readonly inducementsHome?: unknown;
  readonly inducementsAway?: unknown;
}

/**
 * Dépense de chaque côté : la sélection SAISIE quand le PATCH en porte une,
 * sinon celle déjà STOCKÉE. Lecture et validation passent sans `payload`.
 */
export function sheetInducementSpend(
  stored: SheetInducementColumns,
  payload: SheetInducementColumns = {},
): { home: number; away: number } {
  return {
    home: sumGoldEntries(
      payload.inducementsHome !== undefined
        ? payload.inducementsHome
        : stored.inducementsHome,
    ),
    away: sumGoldEntries(
      payload.inducementsAway !== undefined
        ? payload.inducementsAway
        : stored.inducementsAway,
    ),
  };
}

/**
 * Côtés dont l'appelant peut écrire les coups de pouce : le commissaire les
 * deux, un coach ceux des équipes qu'il possède. Un coach qui renvoie la
 * liste adverse (page ouverte avant l'achat de l'adversaire) l'écraserait
 * avec une liste périmée.
 */
export function writableInducementSides(input: {
  readonly commissioner: boolean;
  readonly ownsHome: boolean;
  readonly ownsAway: boolean;
}): readonly SheetSide[] {
  if (input.commissioner) return ["home", "away"];
  const sides: SheetSide[] = [];
  if (input.ownsHome) sides.push("home");
  if (input.ownsAway) sides.push("away");
  return sides;
}

/**
 * Retire du payload les coups de pouce d'un côté que l'appelant ne peut pas
 * écrire : ils sont IGNORÉS (la valeur stockée est conservée), pas refusés —
 * un client antérieur renvoie toujours les deux listes.
 */
export function restrictInducementPayload<T extends SheetInducementColumns>(
  payload: T,
  writable: readonly SheetSide[],
): T {
  const { inducementsHome, inducementsAway, ...rest } = payload;
  return {
    ...rest,
    ...(writable.includes("home") && inducementsHome !== undefined
      ? { inducementsHome }
      : {}),
    ...(writable.includes("away") && inducementsAway !== undefined
      ? { inducementsAway }
      : {}),
  } as T;
}
