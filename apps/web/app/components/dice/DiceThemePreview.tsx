"use client";

import { BlockDieIcon } from "./BlockDieIcon";
import { D6Icon } from "./D6Icon";
import { NumberDieIcon } from "./NumberDieIcon";
import { getDiceThemeRenderer } from "./themes/registry";
import { D6_VALUES, type BlockDieFace } from "./types";

/** Les cinq faces du Dé de Blocage, dans l'ordre du livre. */
export const PREVIEW_BLOCK_FACES: readonly BlockDieFace[] = ["down", "bothdown", "push", "stumble", "pow"];

const SIZES = {
  sm: { block: "h-8 w-8", px: 32, number: "h-6 w-6" },
  md: { block: "h-12 w-12", px: 48, number: "h-9 w-9" },
} as const;

export interface DiceThemePreviewProps {
  readonly themeId: string;
  readonly size?: keyof typeof SIZES;
  /** Ajoute un D8 chiffré à la ligne des D6 (aperçu des dés numériques). */
  readonly withNumberDie?: boolean;
}

/**
 * Aperçu complet d'un thème de dés : les 5 faces du Dé de Blocage, les 6
 * faces du D6 et, au besoin, un dé chiffré. Images en chargement différé
 * (boutique et admin listent 36 thèmes).
 */
export function DiceThemePreview({ themeId, size = "sm", withNumberDie = false }: DiceThemePreviewProps) {
  const theme = getDiceThemeRenderer(themeId);
  const s = SIZES[size];
  return (
    <div className="space-y-1" data-testid={`dice-preview-${themeId}`}>
      <div className="flex flex-wrap gap-1">
        {PREVIEW_BLOCK_FACES.map((f) => (
          <BlockDieIcon key={f} face={f} theme={theme} px={s.px} loading="lazy" className={s.block} />
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {D6_VALUES.map((v) => (
          <D6Icon key={v} value={v} theme={theme} className={s.number} />
        ))}
        {withNumberDie && <NumberDieIcon value={8} sides={8} theme={theme} className={s.number} />}
      </div>
    </div>
  );
}
