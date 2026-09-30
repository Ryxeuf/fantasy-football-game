import { describe, expect, it } from "vitest";
import {
  DEFAULT_DICE_THEME_ID,
  DICE_THEME_CATALOGUE,
  diceThemeSelectionRefusal,
  effectiveDiceThemeId,
  ownedDiceThemeIds,
} from "./dice-theme-catalogue";

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
});
