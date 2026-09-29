"use client";

import { useDiceTheme } from "../../contexts/DiceThemeContext";
import { d6AriaLabel } from "./labels";
import { isD6Value, type DiceThemeRenderer } from "./types";

export interface D6IconProps {
  /** Valeur de la face. Hors 1-6 (donnée corrompue), rendu texte brut. */
  readonly value: number;
  readonly className?: string;
  /** Nom accessible ; défaut = « D6 : n ». */
  readonly label?: string;
  readonly lang?: "fr" | "en";
  /** Force un thème (aperçu du sélecteur) au lieu du thème du coach. */
  readonly theme?: DiceThemeRenderer;
}

/** Une face de D6, dessinée dans le thème de dés du coach. */
export function D6Icon({ value, className, label, lang = "fr", theme }: D6IconProps) {
  const { renderer } = useDiceTheme();
  if (!isD6Value(value)) {
    return (
      <span className={className} role="img" aria-label={label ?? String(value)}>
        {value}
      </span>
    );
  }
  const { D6Face } = theme ?? renderer;
  return <D6Face value={value} className={className} label={label ?? d6AriaLabel(value, lang)} />;
}
