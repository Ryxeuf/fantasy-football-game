/**
 * Boutique des thèmes de dés — règles d'affichage PURES (testables sans DOM).
 */

export type DiceShopFilter = "all" | "owned" | "classic" | "team";

export const DICE_SHOP_FILTERS: ReadonlyArray<{ readonly id: DiceShopFilter; readonly label: string }> = [
  { id: "all", label: "Tous" },
  { id: "owned", label: "Mes thèmes" },
  { id: "classic", label: "Classiques" },
  { id: "team", label: "Équipes" },
];

export interface ShopTheme {
  readonly id: string;
  readonly collection: "classic" | "team";
  readonly priceCrowns: number | null;
  readonly owned: boolean;
  readonly forSale: boolean;
}

export function filterShopThemes<T extends ShopTheme>(themes: readonly T[], filter: DiceShopFilter): T[] {
  switch (filter) {
    case "owned":
      return themes.filter((t) => t.owned);
    case "classic":
    case "team":
      return themes.filter((t) => t.collection === filter);
    default:
      return [...themes];
  }
}

/**
 * Action proposée sur une carte :
 *  - `active`       : thème équipé ;
 *  - `select`       : possédé, à équiper ;
 *  - `buy`          : en vente, Crowns ouvertes et solde suffisant ;
 *  - `insufficient` : en vente, solde trop bas ;
 *  - `locked`       : en vente mais Crowns fermées (flag OFF) ou solde inconnu ;
 *  - `unavailable`  : ni possédé ni en vente.
 */
export type ShopAction = "active" | "select" | "buy" | "insufficient" | "locked" | "unavailable";

export function shopAction(
  theme: ShopTheme,
  ctx: { readonly activeThemeId: string; readonly crownsEnabled: boolean; readonly balance: number | null },
): ShopAction {
  if (theme.id === ctx.activeThemeId) return "active";
  if (theme.owned) return "select";
  if (!theme.forSale || theme.priceCrowns === null) return "unavailable";
  if (!ctx.crownsEnabled || ctx.balance === null) return "locked";
  return ctx.balance >= theme.priceCrowns ? "buy" : "insufficient";
}
