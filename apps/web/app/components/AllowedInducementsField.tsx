"use client";

/**
 * Liste à cocher des coups de pouce autorisés par une compétition (ligue,
 * coupe). Aucune case cochée = tout le catalogue est autorisé. Les Star
 * Players n'y figurent pas : ils dépendent des rosters.
 *
 * Extrait de `LeagueForm` pour que la coupe propose exactement la même liste
 * (même source : catalogue officiel du game-engine).
 */

import type { ReactNode } from "react";
import { INDUCEMENT_CATALOGUE } from "@bb/game-engine";

export interface AllowedInducementOption {
  readonly slug: string;
  readonly name: string;
}

export const ALLOWED_INDUCEMENT_OPTIONS: readonly AllowedInducementOption[] =
  INDUCEMENT_CATALOGUE.filter((d) => d.slug !== "star_player").map((d) => ({
    slug: d.slug,
    name: d.displayNameFr,
  }));

/** Nouvelle liste avec `slug` coché s'il ne l'était pas, décoché sinon. */
export function toggleAllowedInducement(
  list: readonly string[],
  slug: string,
): string[] {
  return list.includes(slug)
    ? list.filter((s) => s !== slug)
    : [...list, slug];
}

export interface AllowedInducementsFieldProps {
  readonly value: readonly string[];
  readonly onChange: (next: string[]) => void;
  readonly testId?: string;
  readonly legend?: ReactNode;
  readonly hint?: ReactNode;
  readonly disabled?: boolean;
}

export function AllowedInducementsField({
  value,
  onChange,
  testId = "allowed-inducements-field",
  legend = "Coups de pouce autorisés",
  hint = (
    <>
      Aucune case cochée = tous les coups de pouce sont autorisés. Les Star
      Players ne sont pas concernés (ils dépendent des rosters).
    </>
  ),
  disabled = false,
}: AllowedInducementsFieldProps) {
  return (
    <fieldset className="block" data-testid={testId} disabled={disabled}>
      <legend className="text-sm font-medium text-gray-700">{legend}</legend>
      {hint ? <p className="text-xs text-gray-500 mt-0.5">{hint}</p> : null}
      <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
        {ALLOWED_INDUCEMENT_OPTIONS.map((opt) => {
          const checked = value.includes(opt.slug);
          return (
            <label
              key={opt.slug}
              data-testid={`${testId}-${opt.slug}`}
              className={`flex items-center gap-2 px-3 py-2 rounded border text-sm cursor-pointer ${
                checked
                  ? "border-nuffle-gold bg-nuffle-gold/10"
                  : "border-gray-300 bg-white"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onChange(toggleAllowedInducement(value, opt.slug))}
              />
              <span>{opt.name}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
