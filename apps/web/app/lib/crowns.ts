/**
 * Couronnes (Crowns) côté web — helpers PURS d'affichage.
 *
 * Le journal (`ProTransaction`) est celui du wallet Pro League : on y lit les
 * types historiques (paris, bonus) en plus de ceux des thèmes de dés.
 */

/** Préfixe de la référence d'un achat / remboursement de thème de dés. */
export const DICE_THEME_TX_REF_PREFIX = "dice-theme:";

/** « 1 250 » (espace fine insécable, comme le reste du site). */
export function formatCrowns(amount: number, locale: "fr" | "en" = "fr"): string {
  return new Intl.NumberFormat(locale === "en" ? "en-GB" : "fr-FR").format(amount);
}

/** Montant signé : « +250 » / « −400 ». */
export function formatCrownsDelta(amount: number): string {
  const abs = formatCrowns(Math.abs(amount));
  return amount < 0 ? `−${abs}` : `+${abs}`;
}

/** Thème de dés visé par une référence `dice-theme:<id>`, sinon `null`. */
export function diceThemeIdFromRef(ref: string | null | undefined): string | null {
  return ref && ref.startsWith(DICE_THEME_TX_REF_PREFIX)
    ? ref.slice(DICE_THEME_TX_REF_PREFIX.length) || null
    : null;
}

export interface CrownsTransactionLike {
  readonly type: string;
  readonly amount: number;
  readonly ref: string | null;
}

/**
 * Libellé lisible d'une opération. `themeName` résout le nom d'un thème de
 * dés à partir de son id (repli : l'id brut).
 */
export function describeCrownsTransaction(
  tx: CrownsTransactionLike,
  themeName: (id: string) => string | undefined = () => undefined,
): string {
  const themeId = diceThemeIdFromRef(tx.ref);
  const theme = themeId ? themeName(themeId) ?? themeId : null;
  switch (tx.type) {
    case "SINK":
      return theme ? `Achat du thème de dés « ${theme} »` : "Dépense";
    case "ADMIN_REFUND":
      return theme ? `Remboursement du thème de dés « ${theme} »` : "Remboursement";
    case "ADMIN_ADJUST":
      return tx.ref ? `Ajustement de l'équipe Nuffle Arena — ${tx.ref}` : "Ajustement de l'équipe Nuffle Arena";
    case "REWARD":
      return "Bonus de bienvenue";
    case "DAILY":
      return "Bonus quotidien";
    case "BADGE":
      return "Récompense de badge";
    case "BET":
      return "Mise sur un pari";
    case "WIN":
      return "Gain de pari";
    default:
      return tx.type;
  }
}
