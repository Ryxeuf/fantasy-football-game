"use client";

/**
 * Coups de pouce achetés À LA CRÉATION de l'équipe (coupe en mode `build`,
 * règlement de tournoi) : ils valent pour chaque rencontre et se paient sur
 * le budget d'or. Le catalogue (prix et plafonds pour CE roster) vient du
 * serveur ; ce composant ne fait qu'en éditer les quantités.
 */

import {
  selectionCostK,
  withQuantity,
  type BuildInducementOption,
  type InducementSelection,
} from "./build-inducements";

export interface BuildInducementPickerProps {
  readonly options: readonly BuildInducementOption[];
  readonly selection: InducementSelection;
  readonly onChange: (next: InducementSelection) => void;
  /** Budget encore disponible hors coups de pouce, en kpo. */
  readonly availableBudgetK: number;
  /** Rappel affiché sous le titre (« Règlement NAF : l'or non dépensé… »). */
  readonly hint?: string;
  readonly loading?: boolean;
}

function formatK(po: number): string {
  return `${Math.round(po / 1000)}k`;
}

export default function BuildInducementPicker({
  options,
  selection,
  onChange,
  availableBudgetK,
  hint,
  loading = false,
}: BuildInducementPickerProps) {
  const totalK = selectionCostK(selection, options);
  const remainingK = availableBudgetK - totalK;

  return (
    <section
      data-testid="build-inducements"
      className="rounded-lg border border-gray-200 bg-white p-3 space-y-2"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">
          🎁 Coups de pouce (achetés à la création)
        </h3>
        <span
          data-testid="build-inducements-total"
          className={`text-xs font-mono ${remainingK < 0 ? "text-red-600" : "text-gray-600"}`}
        >
          {totalK}k
        </span>
      </div>
      <p className="text-xs text-gray-600">
        Valables à chaque rencontre de la compétition, payés sur le budget
        d&apos;or. Aucun coup de pouce ne s&apos;achète en avant-match.
      </p>
      {hint && (
        <p
          data-testid="build-inducements-hint"
          className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2"
        >
          {hint}
        </p>
      )}
      {loading ? (
        <p className="text-xs text-gray-400">Chargement du catalogue…</p>
      ) : options.length === 0 ? (
        <p className="text-xs text-gray-500">
          Aucun coup de pouce n&apos;est disponible pour ce roster.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {options.map((option) => {
            const qty = selection[option.slug] ?? 0;
            const canAdd =
              qty < option.maxQuantity && option.cost / 1000 <= remainingK;
            return (
              <li
                key={option.slug}
                data-testid={`build-inducement-${option.slug}`}
                className="flex items-center gap-2 py-1.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-gray-900">{option.name}</div>
                  <div className="text-[11px] text-gray-500">
                    {formatK(option.cost)} · 0-{option.maxQuantity}
                    {option.description ? ` · ${option.description}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={`Retirer ${option.name}`}
                    data-testid={`build-inducement-${option.slug}-minus`}
                    disabled={qty === 0}
                    onClick={() =>
                      onChange(withQuantity(selection, option.slug, qty - 1, options))
                    }
                    className="h-7 w-7 rounded border border-gray-300 text-sm disabled:opacity-40"
                  >
                    −
                  </button>
                  <span
                    data-testid={`build-inducement-${option.slug}-qty`}
                    className="w-6 text-center text-sm font-mono"
                  >
                    {qty}
                  </span>
                  <button
                    type="button"
                    aria-label={`Ajouter ${option.name}`}
                    data-testid={`build-inducement-${option.slug}-plus`}
                    disabled={!canAdd}
                    onClick={() =>
                      onChange(withQuantity(selection, option.slug, qty + 1, options))
                    }
                    className="h-7 w-7 rounded border border-gray-300 text-sm disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
