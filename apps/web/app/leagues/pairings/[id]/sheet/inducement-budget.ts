/**
 * Budget de coups de pouce affiché sur l'avant-match — PUR.
 *
 * Le serveur sert le budget EFFECTIF (dépense adverse stockée comprise) et sa
 * composition (`ctvGap`, `opponentSpent`, `treasuryAllowance`). Côté écran, la
 * liste adverse peut être plus récente que la lecture (commissaire qui saisit
 * pour les deux côtés) : on remplace la dépense adverse STOCKÉE par celle
 * affichée, le reste de la formule ne bouge pas.
 *
 * Rétro-compat : un serveur antérieur ne sert ni le détail ni la dépense
 * adverse (sa Petite Monnaie de lecture l'ignorait) — on en reconstruit la
 * composition à partir de `pettyCash` / `maxBudget`.
 */

export interface ServedTeamBudget {
  readonly ctv: number;
  readonly treasury: number;
  readonly pettyCash: number;
  readonly maxBudget: number;
  readonly ctvGap?: number;
  readonly opponentSpent?: number;
  readonly treasuryAllowance?: number;
}

export type BudgetRole = "underdog" | "favorite" | "equal" | "cup";

export interface SideBudgetView {
  readonly role: BudgetRole;
  readonly ctvGap: number;
  readonly opponentSpent: number;
  readonly treasuryAllowance: number;
  readonly pettyCash: number;
  readonly maxBudget: number;
}

/** Plafond de trésorerie de l'outsider (règle de ligue, rappel d'affichage). */
export const UNDERDOG_TREASURY_CAP = 50_000;

export function effectiveSideBudget(
  own: ServedTeamBudget,
  opponent: Pick<ServedTeamBudget, "ctv">,
  opts: { readonly opponentSpent: number; readonly cup: boolean },
): SideBudgetView {
  const storedOpponentSpent = own.opponentSpent ?? 0;
  const ctvGap = own.ctvGap ?? Math.max(0, own.pettyCash - storedOpponentSpent);
  const treasuryAllowance =
    own.treasuryAllowance ?? Math.max(0, own.maxBudget - own.pettyCash);
  if (opts.cup) {
    return {
      role: "cup",
      ctvGap,
      opponentSpent: 0,
      treasuryAllowance: 0,
      pettyCash: own.pettyCash,
      maxBudget: own.maxBudget,
    };
  }
  const role: BudgetRole =
    ctvGap > 0 || own.ctv < opponent.ctv
      ? "underdog"
      : own.ctv > opponent.ctv
        ? "favorite"
        : "equal";
  if (role !== "underdog") {
    return {
      role,
      ctvGap: 0,
      opponentSpent: 0,
      treasuryAllowance,
      pettyCash: own.pettyCash,
      maxBudget: own.maxBudget,
    };
  }
  const opponentSpent = Math.max(0, opts.opponentSpent);
  const pettyCash = ctvGap + opponentSpent;
  return {
    role,
    ctvGap,
    opponentSpent,
    treasuryAllowance,
    pettyCash,
    maxBudget: pettyCash + treasuryAllowance,
  };
}

function defaultGold(n: number): string {
  return `${n.toLocaleString("fr-FR")} po`;
}

/** Détail lisible de la composition du budget (une ligne). */
export function budgetDetailLabel(
  view: SideBudgetView,
  gold: (n: number) => string = defaultGold,
): string {
  switch (view.role) {
    case "cup":
      return `Petite Monnaie ${gold(view.pettyCash)} (écart de VEA, pas de trésorerie en coupe)`;
    case "equal":
      return "VEA égales : ni Petite Monnaie, ni trésorerie mobilisable";
    case "favorite":
      return `Trésorerie ${gold(view.treasuryAllowance)} = ${gold(view.maxBudget)} (VEA la plus haute : vous achetez en premier)`;
    case "underdog":
      return `Écart de VEA ${gold(view.ctvGap)} + dépense adverse ${gold(view.opponentSpent)} (Petite Monnaie) + trésorerie (max ${gold(UNDERDOG_TREASURY_CAP)}) ${gold(view.treasuryAllowance)} = ${gold(view.maxBudget)}`;
  }
}

/**
 * Fusion à trois voies d'un champ du formulaire après une relecture : une
 * valeur que l'utilisateur n'a pas touchée (égale à la dernière valeur
 * serveur vue) suit le serveur ; une saisie locale non enregistrée est
 * conservée.
 */
export function mergeServerValue<T>(local: T, previousServer: T, nextServer: T): T {
  return sameValue(local, previousServer) ? nextServer : local;
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}
