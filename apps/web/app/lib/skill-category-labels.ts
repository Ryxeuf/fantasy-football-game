/**
 * Libellés courts (badge / tooltip) traduits par catégorie de compétence.
 *
 * Les catégories sont stockées en base en anglais ("General", "Agility"…) — sauf
 * "Scélérates" (déjà en français). Ce module centralise leur traduction pour
 * l'affichage. Les clés couvrent les variantes rencontrées dans les données
 * (singulier/pluriel).
 *
 * Source unique réutilisée par `SkillTooltip` (roster + fiche joueur) et la page
 * `/skills`. Pour la version longue (« Compétences Générales »), voir
 * `categoryNames` dans `app/skills/SkillsClient.tsx`.
 */
export const SKILL_CATEGORY_TAG_LABELS: Record<
  string,
  { fr: string; en: string }
> = {
  General: { fr: "Générale", en: "General" },
  Agility: { fr: "Agilité", en: "Agility" },
  Strength: { fr: "Force", en: "Strength" },
  Passing: { fr: "Passe", en: "Passing" },
  Mutation: { fr: "Mutation", en: "Mutation" },
  Mutations: { fr: "Mutation", en: "Mutation" },
  Trait: { fr: "Trait", en: "Trait" },
  Traits: { fr: "Trait", en: "Trait" },
  Extraordinary: { fr: "Extraordinaire", en: "Extraordinary" },
  "Scélérates": { fr: "Scélérates", en: "Villainous" },
};

/**
 * Retourne le libellé traduit d'une catégorie. Repli sur la valeur brute si la
 * catégorie est inconnue (ne casse jamais l'affichage).
 */
export function getSkillCategoryLabel(
  category: string,
  language: string,
): string {
  const entry = SKILL_CATEGORY_TAG_LABELS[category];
  if (!entry) return category;
  return language === "fr" ? entry.fr : entry.en;
}
