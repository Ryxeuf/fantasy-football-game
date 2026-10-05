import { describe, expect, it } from "vitest";
import {
  DEFAULT_DICE_THEME_ID,
  DICE_THEME_CATALOGUE,
  diceThemePurchaseRefusal,
  diceThemeSelectionRefusal,
  effectiveDiceThemeId,
  ownedDiceThemeIds,
  sortDiceThemes,
  visibleDiceThemes,
  type DiceThemeCatalogue,
  type DiceThemeCatalogueEntry,
} from "./dice-theme-catalogue";

function entry(over: Partial<DiceThemeCatalogueEntry> & { id: string }): DiceThemeCatalogueEntry {
  return {
    collection: "team",
    priceCrowns: 400,
    enabled: true,
    sortOrder: 100,
    name: { fr: over.id, en: over.id },
    description: { fr: "d", en: "d" },
    ...over,
  };
}

/** Catalogue réduit : le défaut, un payant en vente, un payant retiré, un gratuit retiré. */
const MINI: DiceThemeCatalogue = [
  entry({ id: DEFAULT_DICE_THEME_ID, collection: "classic", priceCrowns: null, sortOrder: 0 }),
  entry({ id: "orques", priceCrowns: 400, sortOrder: 101 }),
  entry({ id: "retired", priceCrowns: 250, enabled: false, sortOrder: 102 }),
  entry({ id: "free-retired", priceCrowns: null, enabled: false, sortOrder: 103 }),
];

describe("dice-theme-catalogue", () => {
  it("le thème par défaut existe et est gratuit", () => {
    const def = DICE_THEME_CATALOGUE.find((t) => t.id === DEFAULT_DICE_THEME_ID);
    expect(def).toBeDefined();
    expect(def?.priceCrowns).toBeNull();
  });

  it("les ids sont uniques", () => {
    const ids = DICE_THEME_CATALOGUE.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("un thème gratuit est possédé par tout le monde", () => {
    expect(ownedDiceThemeIds()).toContain(DEFAULT_DICE_THEME_ID);
  });

  it("un id acheté inconnu du catalogue n'est pas possédé", () => {
    expect(ownedDiceThemeIds(["ghost"])).not.toContain("ghost");
  });

  describe("effectiveDiceThemeId", () => {
    it("null => défaut (jamais choisi)", () => {
      expect(effectiveDiceThemeId(null)).toBe(DEFAULT_DICE_THEME_ID);
      expect(effectiveDiceThemeId(undefined)).toBe(DEFAULT_DICE_THEME_ID);
      expect(effectiveDiceThemeId("")).toBe(DEFAULT_DICE_THEME_ID);
    });

    it("thème stocké valide => servi tel quel", () => {
      expect(effectiveDiceThemeId(DEFAULT_DICE_THEME_ID)).toBe(DEFAULT_DICE_THEME_ID);
    });

    it("thème disparu du catalogue => repli silencieux sur le défaut", () => {
      expect(effectiveDiceThemeId("retired-theme")).toBe(DEFAULT_DICE_THEME_ID);
    });
  });

  describe("diceThemeSelectionRefusal", () => {
    it("accepte le thème par défaut", () => {
      expect(diceThemeSelectionRefusal(DEFAULT_DICE_THEME_ID)).toBeNull();
    });

    it("refuse un id inconnu", () => {
      expect(diceThemeSelectionRefusal("nope")).toBe("unknown-theme");
    });
  });

  describe("catalogue compilé", () => {
    it("36 thèmes : 5 classiques (le défaut en tête) puis 31 équipes", () => {
      expect(DICE_THEME_CATALOGUE).toHaveLength(36);
      expect(DICE_THEME_CATALOGUE[0].id).toBe(DEFAULT_DICE_THEME_ID);
      expect(DICE_THEME_CATALOGUE.filter((t) => t.collection === "classic")).toHaveLength(5);
      expect(DICE_THEME_CATALOGUE.filter((t) => t.collection === "team")).toHaveLength(31);
    });

    it("seul le défaut est gratuit ; tout est en vente", () => {
      const free = DICE_THEME_CATALOGUE.filter((t) => t.priceCrowns === null).map((t) => t.id);
      expect(free).toEqual([DEFAULT_DICE_THEME_ID]);
      expect(DICE_THEME_CATALOGUE.every((t) => t.enabled)).toBe(true);
    });

    it("ids au format slug (préférence, route, chemin d'image)", () => {
      for (const t of DICE_THEME_CATALOGUE) expect(t.id).toMatch(/^[a-z0-9-]+$/);
    });
  });

  describe("possession", () => {
    it("un payant s'acquiert ; un acquis retiré de la vente reste à son acheteur", () => {
      expect(ownedDiceThemeIds([], MINI)).toEqual([DEFAULT_DICE_THEME_ID]);
      expect(ownedDiceThemeIds(["orques", "retired"], MINI)).toEqual([
        DEFAULT_DICE_THEME_ID,
        "orques",
        "retired",
      ]);
    });

    it("un gratuit RETIRÉ n'est plus possédé d'office", () => {
      expect(ownedDiceThemeIds([], MINI)).not.toContain("free-retired");
    });

    it("préférence sur un payant non acquis => défaut", () => {
      expect(effectiveDiceThemeId("orques", [], MINI)).toBe(DEFAULT_DICE_THEME_ID);
      expect(effectiveDiceThemeId("orques", ["orques"], MINI)).toBe("orques");
      expect(diceThemeSelectionRefusal("orques", [], MINI)).toBe("theme-not-owned");
    });

    it("boutique : en vente + possédés, retirés non possédés masqués", () => {
      expect(visibleDiceThemes([], MINI).map((t) => t.id)).toEqual([DEFAULT_DICE_THEME_ID, "orques"]);
      expect(visibleDiceThemes(["retired"], MINI).map((t) => t.id)).toEqual([
        DEFAULT_DICE_THEME_ID,
        "orques",
        "retired",
      ]);
    });

    it("tri par sortOrder puis nom, sans muter l'entrée", () => {
      const shuffled = [MINI[2], MINI[0], MINI[1]];
      expect(sortDiceThemes(shuffled).map((t) => t.id)).toEqual([DEFAULT_DICE_THEME_ID, "orques", "retired"]);
      expect(shuffled[0].id).toBe("retired");
    });
  });

  describe("diceThemePurchaseRefusal", () => {
    it("achetable avec un solde suffisant", () => {
      expect(diceThemePurchaseRefusal("orques", [], 400, MINI)).toBeNull();
    });

    it("refuse : inconnu, déjà possédé, gratuit, retiré, solde insuffisant", () => {
      expect(diceThemePurchaseRefusal("ghost", [], 1000, MINI)).toBe("unknown-theme");
      expect(diceThemePurchaseRefusal("orques", ["orques"], 1000, MINI)).toBe("theme-already-owned");
      expect(diceThemePurchaseRefusal(DEFAULT_DICE_THEME_ID, [], 1000, MINI)).toBe("theme-already-owned");
      expect(diceThemePurchaseRefusal("retired", [], 1000, MINI)).toBe("theme-not-for-sale");
      expect(diceThemePurchaseRefusal("free-retired", [], 1000, MINI)).toBe("theme-not-for-sale");
      expect(diceThemePurchaseRefusal("orques", [], 399, MINI)).toBe("insufficient-funds");
    });
  });
});
