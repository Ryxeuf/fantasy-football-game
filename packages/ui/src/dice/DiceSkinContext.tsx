import * as React from "react";
import { DEFAULT_DICE_SKIN, type DiceSkin } from "./skins";

const DiceSkinContext = React.createContext<DiceSkin | null>(null);

/**
 * Skin de dés courant pour les composants de ce package (match en ligne,
 * journal, popups). Le site le pose depuis le thème de dés du coach
 * (`apps/web/app/contexts/DiceThemeContext`).
 */
export function DiceSkinProvider({
  skin,
  children,
}: {
  readonly skin: DiceSkin;
  readonly children: React.ReactNode;
}) {
  return <DiceSkinContext.Provider value={skin}>{children}</DiceSkinContext.Provider>;
}

/** Skin courant ; le dé ORIGINAL hors provider (tests, pages isolées). */
export function useDiceSkin(): DiceSkin {
  return React.useContext(DiceSkinContext) ?? DEFAULT_DICE_SKIN;
}
