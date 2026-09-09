"use client";

/**
 * Sélecteur de compétences partagé (positions ET Star Players) : chips
 * colorées par catégorie + recherche avec suggestions, via
 * `ChipMultiSelect`. Un seul composant pour que les deux écrans restent
 * d'accord sur la visualisation et l'ajout d'une compétence.
 */

import { useMemo } from "react";
import { ChipMultiSelect, type ChipGroupStyle, type ChipOption } from "./ChipMultiSelect";
import { getSkillCategoryColor } from "../../../lib/skill-category-colors";

export interface SkillOption {
  slug: string;
  nameFr: string;
  nameEn?: string;
  category?: string;
}

/**
 * Couleurs et libellés FR des catégories de compétences BB. Les couleurs
 * viennent de la source unique `lib/skill-category-colors` : les badges de
 * l'admin et ceux du roster ne peuvent donc pas diverger.
 */
export const SKILL_CATEGORY_STYLES: Record<string, ChipGroupStyle> = {
  General: { label: "Général", chipClass: getSkillCategoryColor("General", true) },
  Agility: { label: "Agilité", chipClass: getSkillCategoryColor("Agility", true) },
  Strength: { label: "Force", chipClass: getSkillCategoryColor("Strength", true) },
  Passing: { label: "Passe", chipClass: getSkillCategoryColor("Passing", true) },
  Mutation: { label: "Mutation", chipClass: getSkillCategoryColor("Mutation", true) },
  Trait: { label: "Trait", chipClass: getSkillCategoryColor("Trait", true) },
  "Scélérates": {
    label: "Scélérate",
    chipClass: getSkillCategoryColor("Scélérates", true),
  },
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
