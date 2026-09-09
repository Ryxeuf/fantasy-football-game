/**
 * Couleurs de badge par catégorie de compétence.
 *
 * Source unique réutilisée par les deux `SkillTooltip` (roster public et
 * fiche d'équipe) et le sélecteur de compétences de l'admin. Ces trois
 * consommateurs portaient chacun leur propre `switch`, et les catégories
 * absentes de la liste tombaient sur le gris du cas `default` : les
 * compétences **Scélérates** étaient donc indiscernables des Traits.
 *
 * Elles ont désormais leur teinte propre (ambre), cohérente avec le code
 * couleur déjà utilisé par l'éditeur d'équipe pour la Sournoiserie (K).
 *
 * Les catégories sont stockées en base en anglais ("General", "Agility"…)
 * — sauf "Scélérates", déjà en français. Comme pour
 * `SKILL_CATEGORY_TAG_LABELS`, les variantes singulier/pluriel des données
 * sont couvertes.
 */

/** Palette d'une catégorie, déclinée avec et sans bordure. */
export interface SkillCategoryColor {
  /** Fond + texte (badges sans bordure). */
  readonly base: string;
  /** Classe de bordure associée. */
  readonly border: string;
}

const GRAY: SkillCategoryColor = {
  base: "bg-gray-100 text-gray-600",
  border: "border-gray-300",
};

export const SKILL_CATEGORY_COLORS: Record<string, SkillCategoryColor> = {
  General: { base: "bg-blue-100 text-blue-800", border: "border-blue-300" },
  Agility: { base: "bg-green-100 text-green-800", border: "border-green-300" },
  Strength: { base: "bg-red-100 text-red-800", border: "border-red-300" },
  Passing: {
    base: "bg-purple-100 text-purple-800",
    border: "border-purple-300",
  },
  Mutation: {
    base: "bg-orange-100 text-orange-800",
    border: "border-orange-300",
  },
  Mutations: {
    base: "bg-orange-100 text-orange-800",
    border: "border-orange-300",
  },
  Trait: { base: "bg-gray-100 text-gray-800", border: "border-gray-300" },
  Traits: { base: "bg-gray-100 text-gray-800", border: "border-gray-300" },
  // Compétences Scélérates (Saison 3) : teinte dédiée, distincte du gris
  // des Traits sur lequel elles retombaient jusqu'ici.
  "Scélérates": { base: "bg-amber-100 text-amber-800", border: "border-amber-400" },
};

/**
 * Classes du badge d'une catégorie. Repli sur le gris neutre pour une
 * catégorie inconnue (ne casse jamais l'affichage).
 *
 * @param withBorder ajoute la classe de bordure (badges bordés).
 */
export function getSkillCategoryColor(
  category: string | null | undefined,
  withBorder = false,
): string {
  const entry = (category && SKILL_CATEGORY_COLORS[category]) || GRAY;
  return withBorder ? `${entry.base} ${entry.border}` : entry.base;
}
