import { describe, expect, it } from "vitest";
import { filterShopThemes, shopAction, type ShopTheme } from "./shop";

const T = (id: string, over: Partial<ShopTheme> = {}): ShopTheme => ({
  id,
  collection: "team",
  priceCrowns: 400,
  owned: false,
  forSale: true,
  ...over,
});

const THEMES = [
  T("nuffle", { collection: "classic", priceCrowns: null, owned: true, forSale: false }),
  T("glace", { collection: "classic", priceCrowns: 250 }),
  T("orques", { owned: true, forSale: false }),
  T("nains"),
];

describe("boutique de dés", () => {
  it("filtre par possession et par collection", () => {
    expect(filterShopThemes(THEMES, "all").map((t) => t.id)).toEqual(["nuffle", "glace", "orques", "nains"]);
    expect(filterShopThemes(THEMES, "owned").map((t) => t.id)).toEqual(["nuffle", "orques"]);
    expect(filterShopThemes(THEMES, "classic").map((t) => t.id)).toEqual(["nuffle", "glace"]);
    expect(filterShopThemes(THEMES, "team").map((t) => t.id)).toEqual(["orques", "nains"]);
  });

  it("action de chaque carte", () => {
    const ctx = { activeThemeId: "nuffle", crownsEnabled: true, balance: 300 };
    expect(shopAction(THEMES[0], ctx)).toBe("active");
    expect(shopAction(THEMES[2], ctx)).toBe("select");
    expect(shopAction(THEMES[1], ctx)).toBe("buy");
    expect(shopAction(THEMES[3], ctx)).toBe("insufficient");
    expect(shopAction(THEMES[3], { ...ctx, crownsEnabled: false })).toBe("locked");
    expect(shopAction(THEMES[3], { ...ctx, balance: null })).toBe("locked");
    expect(shopAction(T("retired", { forSale: false }), ctx)).toBe("unavailable");
  });
});
