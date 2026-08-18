"use client";

/**
 * Selection des regles de recrutement d'un Star Player en cases a cocher.
 *
 * Deux listes independantes :
 *  - les regles globales (`all`, ligues regionales, « Favori de… »), qui
 *    sont enregistrees sans roster cible ;
 *  - les rosters explicitement autorises, enregistres en couple
 *    `{ rule: slug, rosterId }` pour ne pas perdre le lien.
 */

import { useMemo, useState } from "react";
import {
  SlugCheckboxGrid,
  type SlugOption,
} from "../../_components/SlugCheckboxGrid";
import { HIRABLE_RULE_OPTIONS, type HirableSelection } from "./star-player-options";

export interface RosterOption {
  id: string;
  slug: string;
  name: string;
}

export function HirableByPicker({
  rosters,
  selection,
  onToggleRule,
  onToggleRoster,
  testId = "star-player-hirable",
}: {
  rosters: readonly RosterOption[];
  selection: HirableSelection;
  onToggleRule: (slug: string) => void;
  onToggleRoster: (rosterId: string) => void;
  testId?: string;
}) {
  const [query, setQuery] = useState("");

  const rosterOptions: SlugOption[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (Array.isArray(rosters) ? rosters : [])
      .filter(
        (r) =>
          !q ||
          r.slug.toLowerCase().includes(q) ||
          (r.name ?? "").toLowerCase().includes(q) ||
          selection.rosterIds.includes(r.id),
      )
      .map((r) => ({ slug: r.id, label: r.name || r.slug, hint: r.slug }));
  }, [rosters, query, selection.rosterIds]);

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-semibold uppercase text-gray-500 mb-1">
          Règles et ligues
        </div>
        <SlugCheckboxGrid
          catalog={HIRABLE_RULE_OPTIONS}
          selected={selection.rules}
          onToggle={onToggleRule}
          testId={`${testId}-rules`}
        />
        <p className="text-xs text-gray-500 mt-1">
          « Toutes les équipes » rend le Star Player recrutable partout et
          rend les autres cases inutiles. Sélection multiple.
        </p>
      </div>

      <div>
        <div className="text-xs font-semibold uppercase text-gray-500 mb-1">
          Rosters spécifiques
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrer les rosters…"
          aria-label="Filtrer les rosters"
          data-testid={`${testId}-rosters-search`}
          className="border rounded px-3 py-1.5 text-sm w-full mb-2"
        />
        {rosterOptions.length === 0 ? (
          <p
            data-testid={`${testId}-rosters-empty`}
            className="text-sm text-gray-500 italic"
          >
            Aucun roster ne correspond au filtre.
          </p>
        ) : (
          <SlugCheckboxGrid
            catalog={rosterOptions}
            selected={selection.rosterIds}
            onToggle={onToggleRoster}
            testId={`${testId}-rosters`}
          />
        )}
        <p className="text-xs text-gray-500 mt-1">
          Optionnel : autorise un roster précis en plus des règles
          ci-dessus. Seuls les rosters du même ruleset sont proposés.
        </p>
      </div>
    </div>
  );
}
