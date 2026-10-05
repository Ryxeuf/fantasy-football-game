import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BLOCK_DIE_FACE_INFO, type BlockResult } from "@bb/game-engine";
import {
  DEFAULT_DICE_SKIN,
  DEFAULT_DICE_SKIN_ID,
  DICE_FACE_OUTCOMES,
  DICE_SKINS,
  OUTCOME_BY_BLOCK_FACE,
  OUTCOME_BY_BLOCK_RESULT,
  blockFaceSrc,
  diceAssetSizeFor,
  getDiceSkin,
  hexColorToNumber,
  isPipValue,
  type DiceAssetSize,
} from "./skins";

const WEB_PUBLIC = path.resolve(__dirname, "../../../../apps/web/public");
const SIZES: readonly DiceAssetSize[] = [64, 128, 320];

describe("skins de dés", () => {
  it("36 thèmes : le dé original, 4 déclinaisons et 31 équipes", () => {
    expect(Object.keys(DICE_SKINS)).toHaveLength(36);
    expect(DEFAULT_DICE_SKIN.id).toBe(DEFAULT_DICE_SKIN_ID);
  });

  it("le défaut est le dé ORIGINAL or & charbon", () => {
    expect(DEFAULT_DICE_SKIN.assetBase).toBe("/images/dices/nuffle-des-originaux/original-or");
  });

  it("chaque face PNG référencée existe dans apps/web/public, dans les 3 tailles", () => {
    const missing: string[] = [];
    for (const skin of Object.values(DICE_SKINS)) {
      for (const outcome of DICE_FACE_OUTCOMES) {
        for (const size of SIZES) {
          const rel = blockFaceSrc(skin, outcome, size);
          if (!existsSync(path.join(WEB_PUBLIC, rel))) missing.push(rel);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("palettes en #RRGGBB (le plateau Pixi les convertit en entiers)", () => {
    for (const skin of Object.values(DICE_SKINS)) {
      for (const color of Object.values(skin.palette)) {
        expect(color).toMatch(/^#[0-9A-F]{6}$/i);
      }
    }
    expect(hexColorToNumber("#D2A84E")).toBe(0xd2a84e);
    expect(hexColorToNumber("pas une couleur")).toBe(0x000000);
  });

  it("id inconnu ou absent => dé original", () => {
    expect(getDiceSkin("ghost").id).toBe(DEFAULT_DICE_SKIN_ID);
    expect(getDiceSkin(null).id).toBe(DEFAULT_DICE_SKIN_ID);
    expect(getDiceSkin(undefined).id).toBe(DEFAULT_DICE_SKIN_ID);
    expect(getDiceSkin("orques").id).toBe("orques");
  });

  it("chaque résultat du moteur a sa face, et les 5 faces sont couvertes", () => {
    const results = Object.keys(BLOCK_DIE_FACE_INFO) as BlockResult[];
    expect(results.map((r) => OUTCOME_BY_BLOCK_RESULT[r]).sort()).toEqual([...DICE_FACE_OUTCOMES].sort());
    expect(Object.values(OUTCOME_BY_BLOCK_FACE).sort()).toEqual([...DICE_FACE_OUTCOMES].sort());
  });

  it("choisit la plus petite image nette en 2x", () => {
    expect(diceAssetSizeFor(undefined)).toBe(128);
    expect(diceAssetSizeFor(24)).toBe(64);
    expect(diceAssetSizeFor(32)).toBe(64);
    expect(diceAssetSizeFor(48)).toBe(128);
    expect(diceAssetSizeFor(64)).toBe(128);
    expect(diceAssetSizeFor(96)).toBe(320);
  });

  it("isPipValue : 1 à 6 entiers seulement", () => {
    expect([1, 2, 3, 4, 5, 6].every(isPipValue)).toBe(true);
    expect(isPipValue(0)).toBe(false);
    expect(isPipValue(7)).toBe(false);
    expect(isPipValue(2.5)).toBe(false);
  });
});
