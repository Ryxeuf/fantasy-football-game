import { describe, expect, it } from "vitest";
import { SHOP_CATEGORIES, SHOP_PATH, activeShopCategory, visibleShopCategories, type ShopCategory } from "./categories";

const EXTRA: ShopCategory = {
  id: "banners",
  label: "Bannières",
  icon: "🚩",
  description: "x",
  href: `${SHOP_PATH}/banners`,
  flag: "banners",
};

describe("catégories de la boutique", () => {
  it("les thèmes de dés sont la première catégorie, sous /me/shop", () => {
    expect(SHOP_CATEGORIES[0]).toMatchObject({ id: "dice-themes", href: "/me/shop/dice-themes", flag: "dice_themes" });
    for (const c of SHOP_CATEGORIES) expect(c.href.startsWith(`${SHOP_PATH}/`)).toBe(true);
  });

  it("une catégorie n'est visible qu'avec son flag, ordre du registre conservé", () => {
    const all = [...SHOP_CATEGORIES, EXTRA];
    expect(visibleShopCategories(() => false, all)).toEqual([]);
    expect(visibleShopCategories((f) => f === "banners", all).map((c) => c.id)).toEqual(["banners"]);
    expect(visibleShopCategories(() => true, all).map((c) => c.id)).toEqual(["dice-themes", "banners"]);
  });

  it("catégorie active lue dans le chemin", () => {
    expect(activeShopCategory("/me/shop/dice-themes")?.id).toBe("dice-themes");
    expect(activeShopCategory("/me/shop/dice-themes/x")?.id).toBe("dice-themes");
    expect(activeShopCategory("/me/shop/dice-themes-old")).toBeNull();
    expect(activeShopCategory("/me/shop")).toBeNull();
    expect(activeShopCategory(null)).toBeNull();
  });
});
