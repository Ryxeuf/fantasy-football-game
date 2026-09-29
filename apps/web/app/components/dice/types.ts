import type { ComponentType } from "react";

/** Les cinq icônes du Dé de Blocage (six faces, `push` en occupe deux). */
export type BlockDieFace = "pow" | "push" | "stumble" | "bothdown" | "down";

export type D6Value = 1 | 2 | 3 | 4 | 5 | 6;

export const D6_VALUES: readonly D6Value[] = [1, 2, 3, 4, 5, 6];

export function isD6Value(n: number): n is D6Value {
  return Number.isInteger(n) && n >= 1 && n <= 6;
}

export interface BlockFaceProps {
  readonly face: BlockDieFace;
  readonly className?: string;
  /** Nom accessible (déjà résolu par `BlockDieIcon`). */
  readonly label: string;
}

export interface D6FaceProps {
  readonly value: D6Value;
  readonly className?: string;
  /** Nom accessible (déjà résolu par `D6Icon`). */
  readonly label: string;
}

/**
 * Un thème de dés = un RENDU par famille de dé. Le thème ne connaît ni
 * l'accessibilité (le libellé lui est passé), ni la préférence du coach
 * (résolue par `DiceThemeContext`) : il ne fait que dessiner.
 *
 * Pour ajouter un thème : un fichier dans `themes/`, une entrée dans
 * `DICE_THEME_RENDERERS` (registry) ET dans le catalogue (id + prix), côté
 * web comme côté serveur (`services/dice-theme-catalogue`).
 */
export interface DiceThemeRenderer {
  readonly id: string;
  readonly BlockFace: ComponentType<BlockFaceProps>;
  readonly D6Face: ComponentType<D6FaceProps>;
}
