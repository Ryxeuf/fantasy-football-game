"use client";

import { useState } from "react";
import { useDiceTheme } from "../../contexts/DiceThemeContext";
import { BlockDieIcon } from "../../components/dice/BlockDieIcon";
import { D6Icon } from "../../components/dice/D6Icon";
import { DICE_THEME_CATALOGUE } from "../../components/dice/themes/catalogue";
import { getDiceThemeRenderer } from "../../components/dice/themes/registry";
import { D6_VALUES, type BlockDieFace } from "../../components/dice/types";

const PREVIEW_BLOCK_FACES: readonly BlockDieFace[] = ["down", "bothdown", "push", "stumble", "pow"];

/**
 * Choix du thème de dés (Dé de Blocage + D6) dans le profil.
 *
 * Masqué quand le flag `dice_themes` est OFF. Un thème non possédé
 * s'affiche verrouillé avec son prix en Crowns : l'achat n'existe pas
 * encore, le bouton reste inerte.
 */
export default function DiceThemePicker() {
  const { enabled, loading, themeId, ownedThemeIds, selectTheme } = useDiceTheme();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!enabled) return null;

  async function choose(id: string): Promise<void> {
    setSavingId(id);
    setError(null);
    try {
      await selectTheme(id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur d'enregistrement du thème");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6" data-testid="dice-theme-picker">
      <h3 className="text-xl font-bold mb-2">Thème de dés</h3>
      <p className="text-sm text-gray-600 mb-4">
        L&apos;apparence de vos dés de blocage et de vos D6, partout sur le site :
        accueil, feuille de match, et bientôt les parties en ligne.
      </p>

      {error && (
        <p className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {DICE_THEME_CATALOGUE.map((t) => {
          const selected = t.id === themeId;
          const owned = ownedThemeIds.has(t.id);
          const renderer = getDiceThemeRenderer(t.id);
          return (
            <li
              key={t.id}
              data-testid={`dice-theme-${t.id}`}
              data-selected={selected ? "true" : "false"}
              className={`rounded-lg border p-3 ${
                selected ? "border-nuffle-bronze ring-2 ring-nuffle-bronze/40" : "border-gray-200"
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">{t.name.fr}</span>
                {t.priceCrowns !== null && (
                  <span className="text-xs text-gray-500">{t.priceCrowns} Crowns</span>
                )}
              </div>
              <p className="text-xs text-gray-500">{t.description.fr}</p>

              <div className="mt-2 flex flex-wrap gap-1" aria-label={`Aperçu du thème ${t.name.fr}`}>
                {PREVIEW_BLOCK_FACES.map((f) => (
                  <BlockDieIcon key={f} face={f} theme={renderer} className="h-7 w-7" />
                ))}
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {D6_VALUES.map((v) => (
                  <D6Icon key={v} value={v} theme={renderer} className="h-7 w-7" />
                ))}
              </div>

              <div className="mt-3">
                {selected ? (
                  <span className="text-sm font-medium text-nuffle-bronze">✓ Thème actif</span>
                ) : owned ? (
                  <button
                    type="button"
                    onClick={() => void choose(t.id)}
                    disabled={loading || savingId !== null}
                    className="rounded bg-nuffle-bronze px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {savingId === t.id ? "Enregistrement…" : "Choisir"}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-500"
                    title="L'achat de thèmes avec des Crowns arrive bientôt"
                  >
                    🔒 Bientôt disponible
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
