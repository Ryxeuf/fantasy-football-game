"use client";
import { moveRule, toggleRule } from "./tie-break-order";

/**
 * Éditeur de critères de départage : une liste ORDONNÉE (monter /
 * descendre / retirer) plus les critères disponibles à ajouter.
 *
 * Agnostique du CATALOGUE : la coupe et la ligue n'ont pas les mêmes
 * critères (une ligue départage aux points bonus et aux forfaits, une coupe
 * aux points d'action), mais la manipulation de la liste est la même — d'où
 * un seul composant plutôt que deux écrans qui divergeraient au premier
 * correctif.
 *
 * Un slug absent du dictionnaire de libellés s'affiche TEL QUEL plutôt que
 * de disparaître : le serveur peut être en avance sur le client, et le
 * coach doit voir qu'un critère s'applique même sans son libellé.
 */

interface TieBreakOrderEditorProps {
  /** Critères retenus, dans l'ordre d'application. Vide = ordre par défaut. */
  value: readonly string[];
  onChange: (next: string[]) => void;
  /** Catalogue proposé à l'ajout (le plus courant en tête). */
  catalogue: readonly string[];
  labels: Readonly<Record<string, string>>;
  /** Préfixe des `data-testid` (ex : "cup-tiebreak", "league-tiebreak"). */
  testIdPrefix: string;
  disabled?: boolean;
}

export function TieBreakOrderEditor({
  value,
  onChange,
  catalogue,
  labels,
  testIdPrefix,
  disabled = false,
}: TieBreakOrderEditorProps) {
  const available = catalogue.filter((slug) => !value.includes(slug));
  return (
    <div className="space-y-2">
      <ul className="space-y-1" data-testid={`${testIdPrefix}-editor`}>
        {value.map((slug, index) => (
          <li
            key={slug}
            className="flex items-center gap-2 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-sm"
          >
            <span className="w-5 tabular-nums text-gray-400">{index + 1}.</span>
            <span className="flex-1">{labels[slug] ?? slug}</span>
            <button
              type="button"
              aria-label="Monter"
              data-testid={`${testIdPrefix}-up-${slug}`}
              disabled={disabled || index === 0}
              onClick={() => onChange(moveRule(value, slug, -1))}
              className="px-1 text-gray-500 disabled:opacity-30"
            >
              ↑
            </button>
            <button
              type="button"
              aria-label="Descendre"
              data-testid={`${testIdPrefix}-down-${slug}`}
              disabled={disabled || index === value.length - 1}
              onClick={() => onChange(moveRule(value, slug, 1))}
              className="px-1 text-gray-500 disabled:opacity-30"
            >
              ↓
            </button>
            <button
              type="button"
              data-testid={`${testIdPrefix}-remove-${slug}`}
              disabled={disabled}
              onClick={() => onChange(toggleRule(value, slug))}
              className="px-1 text-xs text-red-600 hover:underline disabled:opacity-30"
            >
              Retirer
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-1.5 pt-1">
        {available.map((slug) => (
          <button
            key={slug}
            type="button"
            data-testid={`${testIdPrefix}-add-${slug}`}
            disabled={disabled}
            onClick={() => onChange(toggleRule(value, slug))}
            className="rounded-full border border-gray-300 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            + {labels[slug] ?? slug}
          </button>
        ))}
      </div>
    </div>
  );
}
