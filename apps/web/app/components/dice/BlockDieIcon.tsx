"use client";

import { useDiceTheme } from "../../contexts/DiceThemeContext";
import { BLOCK_DIE_FACE_ARIA } from "./labels";
import type { BlockDieFace, DiceThemeRenderer } from "./types";

export interface BlockDieIconProps {
  readonly face: BlockDieFace;
  readonly className?: string;
  /** Nom accessible ; défaut = nom officiel de la face. */
  readonly label?: string;
  readonly lang?: "fr" | "en";
  /** Force un thème (aperçu du sélecteur) au lieu du thème du coach. */
  readonly theme?: DiceThemeRenderer;
}

/** Une face du Dé de Blocage, dessinée dans le thème de dés du coach. */
export function BlockDieIcon({ face, className, label, lang = "fr", theme }: BlockDieIconProps) {
  const { renderer } = useDiceTheme();
  const { BlockFace } = theme ?? renderer;
  return <BlockFace face={face} className={className} label={label ?? BLOCK_DIE_FACE_ARIA[lang][face]} />;
}
