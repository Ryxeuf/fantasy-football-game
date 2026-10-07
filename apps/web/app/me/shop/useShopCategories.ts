"use client";

import { useOptionalFeatureFlagContext } from "../../contexts/FeatureFlagContext";
import { visibleShopCategories, type ShopCategory } from "./categories";

export interface ShopCategoriesState {
  readonly categories: ShopCategory[];
  /** Vrai tant que les flags ne sont pas chargés : ne pas annoncer « fermée ». */
  readonly loading: boolean;
}

/**
 * Catégories de la boutique ouvertes à l'utilisateur courant. Hors
 * `FeatureFlagProvider`, aucune : la boutique reste FERMÉE faute de contexte.
 */
export function useShopCategories(): ShopCategoriesState {
  const ctx = useOptionalFeatureFlagContext();
  return {
    categories: visibleShopCategories((flag) => ctx?.flags.has(flag) ?? false),
    loading: ctx?.loading ?? false,
  };
}
