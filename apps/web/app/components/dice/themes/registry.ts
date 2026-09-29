import type { DiceThemeRenderer } from "../types";
import { DEFAULT_DICE_THEME_ID } from "./catalogue";
import { NUFFLE_DICE_THEME } from "./nuffle";

/** Rendu par id de thème. Toute entrée du catalogue DOIT y figurer. */
export const DICE_THEME_RENDERERS: Readonly<Record<string, DiceThemeRenderer>> = {
  [NUFFLE_DICE_THEME.id]: NUFFLE_DICE_THEME,
};

/** Rendu d'un thème ; repli sur le défaut pour un id inconnu ou absent. */
export function getDiceThemeRenderer(id: string | null | undefined): DiceThemeRenderer {
  return (id ? DICE_THEME_RENDERERS[id] : undefined) ?? DICE_THEME_RENDERERS[DEFAULT_DICE_THEME_ID];
}
