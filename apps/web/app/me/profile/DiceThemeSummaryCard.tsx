"use client";

import Link from "next/link";
import { useDiceTheme } from "../../contexts/DiceThemeContext";
import { BlockDieIcon } from "../../components/dice/BlockDieIcon";
import { D6Icon } from "../../components/dice/D6Icon";
import type { BlockDieFace } from "../../components/dice/types";

const PREVIEW_BLOCK_FACES: readonly BlockDieFace[] = ["down", "bothdown", "push", "stumble", "pow"];

/**
 * Thème de dés du coach sur son profil : aperçu du thème actif et lien vers
 * la boutique. Masqué quand le flag `dice_themes` est OFF.
 */
export default function DiceThemeSummaryCard() {
  const { enabled, themeId, themes, ownedThemeIds } = useDiceTheme();
  if (!enabled) return null;
  const active = themes.find((t) => t.id === themeId);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6" data-testid="dice-theme-summary">
      <h3 className="text-xl font-bold mb-2">Thème de dés</h3>
      <p className="text-sm text-gray-600 mb-4">
        L&apos;apparence de vos dés de blocage et de vos dés chiffrés, partout sur le site.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex gap-1" aria-label="Aperçu de votre thème de dés">
          {PREVIEW_BLOCK_FACES.map((f) => (
            <BlockDieIcon key={f} face={f} px={40} className="h-10 w-10" />
          ))}
          <D6Icon value={6} className="h-10 w-10" />
        </div>
        <div>
          <p className="font-semibold" data-testid="dice-theme-summary-name">
            {active?.name.fr ?? "Original · Or & charbon"}
          </p>
          <p className="text-xs text-gray-500">
            {ownedThemeIds.size} thème{ownedThemeIds.size > 1 ? "s" : ""} possédé{ownedThemeIds.size > 1 ? "s" : ""}
          </p>
        </div>
      </div>
      <Link
        href="/me/dice-themes"
        className="mt-4 inline-block rounded bg-nuffle-bronze px-4 py-2 text-sm font-medium text-white hover:bg-nuffle-gold"
        data-testid="dice-theme-summary-link"
      >
        🎲 Changer de thème
      </Link>
    </div>
  );
}
