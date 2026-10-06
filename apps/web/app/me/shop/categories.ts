/**
 * Boutique — registre PUR des catégories.
 *
 * La boutique (`/me/shop`) est un contenant : chaque catégorie a sa page
 * (`/me/shop/<id>`) et son propre flag. Les thèmes de dés sont la première
 * (et pour l'instant la seule). Ajouter une catégorie = une entrée ici + sa
 * page ; le menu, l'en-tête et le profil en dérivent sans autre changement.
 */
import { DICE_THEMES_FLAG } from "../../lib/featureFlagKeys";

export const SHOP_PATH = "/me/shop" as const;

export interface ShopCategory {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly description: string;
  readonly href: string;
  /** Flag qui ouvre la catégorie. */
  readonly flag: string;
}

export const SHOP_CATEGORIES: readonly ShopCategory[] = [
  {
    id: "dice-themes",
    label: "Thèmes de dés",
    icon: "🎲",
    description:
      "L'apparence de vos dés de blocage et de vos dés chiffrés, partout sur le site : accueil, feuille de match, match en ligne et simulateurs.",
    href: `${SHOP_PATH}/dice-themes`,
    flag: DICE_THEMES_FLAG,
  },
];

/** Catégories ouvertes à l'utilisateur, dans l'ordre du registre. */
export function visibleShopCategories(
  isEnabled: (flag: string) => boolean,
  categories: readonly ShopCategory[] = SHOP_CATEGORIES,
): ShopCategory[] {
  return categories.filter((c) => isEnabled(c.flag));
}

/** Catégorie dont la page est affichée (`null` = accueil de la boutique). */
export function activeShopCategory(
  pathname: string | null,
  categories: readonly ShopCategory[] = SHOP_CATEGORIES,
): ShopCategory | null {
  if (!pathname) return null;
  return categories.find((c) => pathname === c.href || pathname.startsWith(`${c.href}/`)) ?? null;
}
