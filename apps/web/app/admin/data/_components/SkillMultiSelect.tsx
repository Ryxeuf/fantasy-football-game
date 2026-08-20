"use client";

/**
 * Sélecteur de compétences partagé (positions ET Star Players) : chips
 * colorées par catégorie + recherche avec suggestions, via
 * `ChipMultiSelect`. Un seul composant pour que les deux écrans restent
 * d'accord sur la visualisation et l'ajout d'une compétence.
 */

import { useMemo } from "react";
import { ChipMultiSelect, type ChipGroupStyle, type ChipOption } from "./ChipMultiSelect";

export interface SkillOption {
  slug: string;
  nameFr: string;
  nameEn?: string;
  category?: string;
}

/** Couleurs et libellés FR des catégories de compétences BB. */
export const SKILL_CATEGORY_STYLES: Record<string, ChipGroupStyle> = {
  General: { label: "Général", chipClass: "bg-blue-100 text-blue-800 border-blue-300" },
  Agility: { label: "Agilité", chipClass: "bg-green-100 text-green-800 border-green-300" },
  Strength: { label: "Force", chipClass: "bg-red-100 text-red-800 border-red-300" },
  Passing: { label: "Passe", chipClass: "bg-purple-100 text-purple-800 border-purple-300" },
  Mutation: { label: "Mutation", chipClass: "bg-orange-100 text-orange-800 border-orange-300" },
  Trait: { label: "Trait", chipClass: "bg-gray-100 text-gray-800 border-gray-300" },
};

interface SkillMultiSelectProps {
  skills: readonly SkillOption[];
  selectedSlugs: readonly string[];
  onChange: (slugs: string[]) => void;
  testId?: string;
}

export function SkillMultiSelect({
  skills,
  selectedSlugs,
  onChange,
  testId = "skill-select",
}: SkillMultiSelectProps) {
  const options: ChipOption[] = useMemo(
    () =>
      (Array.isArray(skills) ? skills : []).map((skill) => ({
        value: skill.slug,
        label: skill.nameFr || skill.slug,
        sublabel: skill.nameEn,
        group: skill.category,
      })),
    [skills],
  );

  return (
    <ChipMultiSelect
      options={options}
      selected={selectedSlugs as string[]}
      onChange={onChange}
      groups={SKILL_CATEGORY_STYLES}
      placeholder="Rechercher une compétence..."
      selectedLabel="Compétences sélectionnées"
      addLabel="Ajouter une compétence"
      emptyLabel="Aucune compétence sélectionnée"
      testId={testId}
    />
  );
}
