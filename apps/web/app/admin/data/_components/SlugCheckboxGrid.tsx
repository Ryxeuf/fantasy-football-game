"use client";

/**
 * Briques partagees par les deux ecrans d'administration d'un roster
 * (`/admin/data/rosters/[id]` et `.../[id]/edit`) : catalogues de slugs,
 * grille de cases a cocher et parse tolerant des listes renvoyees par
 * l'API. Extraits ici pour que les deux formulaires restent d'accord.
 */

import { TEAM_SPECIAL_RULES, REGIONAL_LEAGUES } from "@bb/game-engine";

/**
 * Parse tolerant d'une liste de slugs renvoyee par l'API : tableau natif,
 * chaine JSON serialisee ou CSV historique. Miroir de `parseSlugList`
 * cote serveur (routes/public-rosters.ts).
 */
export function parseSlugList(raw: unknown): string[] {
  const fromArray = (arr: unknown[]): string[] =>
    arr
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .map((s) => s.trim());
  if (Array.isArray(raw)) return fromArray(raw);
  if (typeof raw !== "string") return [];
  const trimmed = raw.trim();
  if (trimmed.length === 0) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return fromArray(parsed);
  } catch {
    // Pas du JSON : on retombe sur un split CSV.
  }
  return trimmed
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Option d'une grille de cases à cocher (catalogue de slugs). */
export interface SlugOption {
  /** Valeur cochée, remontée telle quelle par `onToggle`. */
  slug: string;
  label: string;
  /**
   * Texte affiché entre parenthèses après le libellé. Par défaut le
   * `slug` lui-même ; à surcharger quand la valeur cochée n'est pas
   * lisible (ex. un id de roster : on affiche son slug à la place).
   */
  hint?: string;
}

/** Catalogue des règles spéciales d'équipe (source game-engine). */
export const SPECIAL_RULE_OPTIONS: SlugOption[] = TEAM_SPECIAL_RULES.map((r) => ({
  slug: r.slug,
  label: r.nameFr,
}));

/** Catalogue des ligues régionales (source game-engine). */
export const REGIONAL_LEAGUE_OPTIONS: SlugOption[] = REGIONAL_LEAGUES.map((l) => ({
  slug: l.slug,
  label: l.nameFr,
}));

/**
 * Grille de cases à cocher sur un catalogue de slugs.
 *
 * Les slugs déjà en base mais absents du catalogue (données héritées,
 * ex. `favoured_of`) sont conservés et affichés « hors catalogue » : on
 * ne perd jamais une valeur existante à l'enregistrement.
 */
export function SlugCheckboxGrid({
  catalog,
  selected,
  onToggle,
  testId,
}: {
  catalog: SlugOption[];
  selected: string[];
  onToggle: (slug: string) => void;
  testId: string;
}) {
  const knownSlugs = catalog.map((o) => o.slug);
  const options: SlugOption[] = [
    ...catalog,
    ...selected
      .filter((s) => !knownSlugs.includes(s))
      .map((s) => ({ slug: s, label: `${s} (hors catalogue)` })),
  ];
  return (
    <div
      data-testid={testId}
      className="grid grid-cols-1 sm:grid-cols-2 gap-2 border rounded px-3 py-3"
    >
      {options.map((opt) => (
        <label
          key={opt.slug}
          className="flex items-center gap-2 text-sm cursor-pointer"
        >
          <input
            type="checkbox"
            data-testid={`${testId}-${opt.slug}`}
            checked={selected.includes(opt.slug)}
            onChange={() => onToggle(opt.slug)}
          />
          <span>
            {opt.label}{" "}
            <span className="text-gray-400 text-xs">({opt.hint ?? opt.slug})</span>
          </span>
        </label>
      ))}
    </div>
  );
}

export function toggleSlug(prev: string[], slug: string): string[] {
  return prev.includes(slug)
    ? prev.filter((s) => s !== slug)
    : [...prev, slug];
}
