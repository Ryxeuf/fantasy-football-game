"use client";
import Link from "next/link";
import type { SheetEntryMode } from "../lib/sheet-entry-profile";

/**
 * Choix du mode de saisie des feuilles de match d'une coupe. Partagé par la
 * création et l'édition : les deux écrans ne peuvent pas dériver l'un de
 * l'autre (même posture que `StandingsOrderField` pour les ligues).
 */

const OPTIONS: ReadonlyArray<{
  value: SheetEntryMode;
  title: string;
  description: string;
}> = [
  {
    value: "simplified",
    title: "Simplifiée — recommandé",
    description:
      "Forfait, touchdowns, éliminations sur blocage et sur agression, passes réussies et interceptions : tout ce que comptent le classement et les tops.",
  },
  {
    value: "full",
    title: "Complète",
    description:
      "Toute la feuille de la ligue (météo, coups de pouce, prières, blessures…), sans effet de plus sur le classement de la coupe.",
  },
];

export interface SheetEntryModeFieldProps {
  readonly value: SheetEntryMode;
  readonly onChange: (mode: SheetEntryMode) => void;
  readonly disabled?: boolean;
}

export function SheetEntryModeField({
  value,
  onChange,
  disabled = false,
}: SheetEntryModeFieldProps) {
  return (
    <fieldset data-testid="sheet-entry-mode-field" className="space-y-2">
      <legend className="text-sm font-semibold text-gray-800">
        Saisie des feuilles de match
      </legend>
      {OPTIONS.map((option) => (
        <label
          key={option.value}
          className="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 p-2 text-sm"
        >
          <input
            type="radio"
            name="sheetEntryMode"
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            disabled={disabled}
            data-testid={`sheet-entry-mode-${option.value}`}
            className="mt-0.5"
          />
          <span>
            <span className="block font-medium text-gray-800">
              {option.title}
            </span>
            <span className="block text-xs text-gray-500">
              {option.description}
            </span>
          </span>
        </label>
      ))}
      <p className="text-xs text-gray-500">
        Le même parcours dans les deux cas (soumission des deux coachs,
        validation du commissaire). Le réglage se change à tout moment, coupe
        lancée comprise.{" "}
        <Link
          href="/aide#saisie-de-coupe"
          data-testid="sheet-entry-mode-help"
          className="font-medium text-nuffle-bronze hover:underline"
        >
          En savoir plus
        </Link>
      </p>
    </fieldset>
  );
}
