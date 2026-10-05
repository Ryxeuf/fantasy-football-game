"use client";

import { useDiceTheme } from "../../contexts/DiceThemeContext";
import { numberDieAriaLabel } from "./labels";
import type { DiceThemeRenderer } from "./types";

export interface NumberDieIconProps {
  /** Valeur tirée (D3, D8, D16, total de 2D6…). */
  readonly value: number;
  /** Nombre de faces du dé : affiché en coin et dans le libellé (« D8 : 7 »). */
  readonly sides?: number;
  readonly className?: string;
  /** Nom accessible ; défaut = « D8 : 7 » (ou « Jet : 7 » sans `sides`). */
  readonly label?: string;
  readonly lang?: "fr" | "en";
  /** Force un thème (aperçu) au lieu du thème du coach. */
  readonly theme?: DiceThemeRenderer;
}

/**
 * Un dé chiffré (D3, D8, D16, total de 2D6), dessiné dans le thème de dés du
 * coach. Pour un D6, préférer `D6Icon` (faces à points).
 */
export function NumberDieIcon({ value, sides, className, label, lang = "fr", theme }: NumberDieIconProps) {
  const { renderer } = useDiceTheme();
  const { NumberFace } = theme ?? renderer;
  return (
    <NumberFace
      value={value}
      sides={sides}
      className={className}
      label={label ?? numberDieAriaLabel(value, sides, lang)}
    />
  );
}
