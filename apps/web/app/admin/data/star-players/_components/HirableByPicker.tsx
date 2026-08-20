"use client";

/**
 * Sélection des règles de recrutement d'un Star Player, sur le même
 * principe que les compétences des positions : chips + recherche avec
 * suggestions (`ChipMultiSelect`).
 *
 * Deux listes indépendantes :
 *  - les règles globales (`all`, ligues régionales, « Favori de… »), qui
 *    sont enregistrées sans roster cible ;
 *  - les rosters explicitement autorisés, enregistrés en couple
 *    `{ rule: slug, rosterId }` pour ne pas perdre le lien.
 */

import { useMemo } from "react";
import { REGIONAL_LEAGUES } from "@bb/game-engine";
import {
  ChipMultiSelect,
  type ChipGroupStyle,
  type ChipOption,
} from "../../_components/ChipMultiSelect";
import {
  HIRABLE_RULE_ALL,
  HIRABLE_RULE_OPTIONS,
  type HirableSelection,
} from "./star-player-options";

export interface RosterOption {
  id: string;
  slug: string;
  name: string;
}

const RULE_GROUP_STYLES: Record<string, ChipGroupStyle> = {
  generic: {
    label: "Générique",
    chipClass: "bg-blue-100 text-blue-800 border-blue-300",
  },
  league: {
    label: "Ligues régionales",
    chipClass: "bg-green-100 text-green-800 border-green-300",
  },
  other: {
    label: "Favoris & autres règles",
    chipClass: "bg-purple-100 text-purple-800 border-purple-300",
  },
};

const REGIONAL_LEAGUE_SLUGS = new Set(REGIONAL_LEAGUES.map((l) => l.slug));

/** Catalogue des règles, groupé pour les filtres du sélecteur. */
const RULE_CHIP_OPTIONS: ChipOption[] = HIRABLE_RULE_OPTIONS.map((option) => ({
  value: option.slug,
  label: option.label,
  sublabel: option.slug,
  group:
    option.slug === HIRABLE_RULE_ALL
      ? "generic"
      : REGIONAL_LEAGUE_SLUGS.has(option.slug)
        ? "league"
        : "other",
}));

export function HirableByPicker({
  rosters,
  selection,
  onChangeRules,
  onChangeRosters,
  testId = "star-player-hirable",
}: {
  rosters: readonly RosterOption[];
  selection: HirableSelection;
  onChangeRules: (rules: string[]) => void;
  onChangeRosters: (rosterIds: string[]) => void;
  testId?: string;
}) {
  const rosterOptions: ChipOption[] = useMemo(
    () =>
      (Array.isArray(rosters) ? rosters : []).map((roster) => ({
        value: roster.id,
        label: roster.name || roster.slug,
        sublabel: roster.slug,
      })),
    [rosters],
  );

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-semibold uppercase text-gray-500 mb-1">
          Règles et ligues
        </div>
        <ChipMultiSelect
          options={RULE_CHIP_OPTIONS}
          selected={selection.rules}
          onChange={onChangeRules}
          groups={RULE_GROUP_STYLES}
          placeholder="Rechercher une règle ou une ligue…"
          selectedLabel="Règles sélectionnées"
          addLabel="Ajouter une règle ou une ligue"
          emptyLabel="Aucune règle sélectionnée"
          testId={`${testId}-rules`}
        />
        <p className="text-xs text-gray-500 mt-1">
          « Toutes les équipes » rend le Star Player recrutable partout et
          rend les autres entrées inutiles. Sélection multiple.
        </p>
      </div>

      <div>
        <div className="text-xs font-semibold uppercase text-gray-500 mb-1">
          Rosters spécifiques
        </div>
        <ChipMultiSelect
          options={rosterOptions}
          selected={selection.rosterIds}
          onChange={onChangeRosters}
          placeholder="Rechercher un roster…"
          selectedLabel="Rosters sélectionnés"
          addLabel="Ajouter un roster"
          emptyLabel="Aucun roster sélectionné"
          testId={`${testId}-rosters`}
        />
        <p className="text-xs text-gray-500 mt-1">
          Optionnel : autorise un roster précis en plus des règles
          ci-dessus. Seuls les rosters du même ruleset sont proposés.
        </p>
      </div>
    </div>
  );
}
