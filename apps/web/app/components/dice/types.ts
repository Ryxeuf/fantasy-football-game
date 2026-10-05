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
  /** Taille d'affichage en px CSS : choisit la résolution du PNG. */
  readonly px?: number;
  readonly loading?: "lazy" | "eager";
}

export interface D6FaceProps {
  readonly value: D6Value;
  readonly className?: string;
  /** Nom accessible (déjà résolu par `D6Icon`). */
  readonly label: string;
}

export interface NumberFaceProps {
  /** Valeur tirée (D3, D8, D16, total de 2D6…). */
  readonly value: number;
  /** Nombre de faces du dé, affiché en coin (8 pour un D8). */
  readonly sides?: number;
  readonly className?: string;
  /** Nom accessible (déjà résolu par `NumberDieIcon`). */
  readonly label: string;
}

/**
 * Un thème de dés = un RENDU par famille de dé. Le thème ne connaît ni
 * l'accessibilité (le libellé lui est passé), ni la préférence du coach
 * (résolue par `DiceThemeContext`) : il ne fait que dessiner.
 *
 * Les thèmes sont construits depuis les SKINS de `@bb/ui/dice` (faces PNG du
 * Dé de Blocage + palette des dés numériques) — cf. `themes/registry.ts`.
 * Ajouter un thème : ses PNG dans `public/images/dices/`, un skin dans
 * `packages/ui/src/dice/skins.ts` et une entrée au catalogue serveur
 * (`services/dice-theme-catalogue`).
 */
export interface DiceThemeRenderer {
  readonly id: string;
  readonly BlockFace: ComponentType<BlockFaceProps>;
  readonly D6Face: ComponentType<D6FaceProps>;
  readonly NumberFace: ComponentType<NumberFaceProps>;
}
