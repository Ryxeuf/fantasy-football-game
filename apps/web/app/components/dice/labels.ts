import type { BlockDieFace, D6Value } from "./types";

/**
 * Noms accessibles des faces. Ceux du Dé de Blocage sont les noms
 * OFFICIELS (livre 2025), alignés sur `components/home/block-dice-faces`.
 */
export const BLOCK_DIE_FACE_ARIA: Record<"fr" | "en", Record<BlockDieFace, string>> = {
  fr: {
    pow: "Défenseur Plaqué",
    push: "Repoussé",
    stumble: "Bousculé",
    bothdown: "Les Deux Plaqués",
    down: "Attaquant Plaqué",
  },
  en: {
    pow: "Defender Down",
    push: "Push Back",
    stumble: "Stumble",
    bothdown: "Both Down",
    down: "Attacker Down",
  },
};

export function d6AriaLabel(value: D6Value, lang: "fr" | "en"): string {
  return lang === "en" ? `D6: ${value}` : `D6 : ${value}`;
}
