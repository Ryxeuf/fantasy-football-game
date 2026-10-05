import { createElement } from "react";
import {
  DEFAULT_DICE_SKIN_ID,
  DICE_SKINS,
  OUTCOME_BY_BLOCK_FACE,
  SkinnedBlockFace,
  SkinnedNumberFace,
  SkinnedPipFace,
  type DiceSkin,
} from "@bb/ui/dice";
import type {
  BlockFaceProps,
  D6FaceProps,
  DiceThemeRenderer,
  NumberFaceProps,
} from "../types";

/** Thème par défaut : le dé ORIGINAL or & charbon (servi à tout le monde). */
export const DEFAULT_DICE_THEME_ID = DEFAULT_DICE_SKIN_ID;

/** Rendu d'un skin : faces PNG du Dé de Blocage + D6 et dés chiffrés en SVG. */
export function createSkinDiceTheme(skin: DiceSkin): DiceThemeRenderer {
  function BlockFace({ face, className, label, px, loading }: BlockFaceProps) {
    return createElement(SkinnedBlockFace, {
      outcome: OUTCOME_BY_BLOCK_FACE[face],
      skin,
      className,
      label,
      px,
      loading,
    });
  }
  function D6Face({ value, className, label }: D6FaceProps) {
    return createElement(SkinnedPipFace, { value, skin, className, label });
  }
  function NumberFace({ value, sides, className, label }: NumberFaceProps) {
    return createElement(SkinnedNumberFace, { value, sides, skin, className, label });
  }
  return { id: skin.id, BlockFace, D6Face, NumberFace };
}

/** Rendu par id de thème. Toute entrée du catalogue serveur DOIT y figurer. */
export const DICE_THEME_RENDERERS: Readonly<Record<string, DiceThemeRenderer>> = Object.freeze(
  Object.fromEntries(
    Object.values(DICE_SKINS).map((skin) => [skin.id, createSkinDiceTheme(skin)]),
  ),
);

/** Rendu d'un thème ; repli sur le défaut pour un id inconnu ou absent. */
export function getDiceThemeRenderer(id: string | null | undefined): DiceThemeRenderer {
  return (id ? DICE_THEME_RENDERERS[id] : undefined) ?? DICE_THEME_RENDERERS[DEFAULT_DICE_THEME_ID];
}
