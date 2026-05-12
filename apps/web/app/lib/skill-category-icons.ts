export const SKILL_CATEGORY_ICONS: Record<string, string> = {
  General: "/images/Competence-Generale.png",
  Agility: "/images/Competence-Agilite.png",
  Strength: "/images/Competence-Force.png",
  Passing: "/images/Competence-Passe.png",
  Mutation: "/images/Competence-Mutation.png",
  Trait: "/images/Competence-Scelerate.png",
  Extraordinary: "/images/Competence-Scelerate.png",
};

export function getSkillCategoryIcon(category: string): string | null {
  return SKILL_CATEGORY_ICONS[category] ?? null;
}
