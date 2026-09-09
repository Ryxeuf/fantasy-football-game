/**
 * CODE COULEUR OFFICIEL des catégories de compétences.
 *
 *   Générale → bleu · Agilité → jaune · Force → rouge
 *   Mutation → vert · Passe → blanc  · Scélérate → violet
 *
 * Source UNIQUE : badges de compétence (roster public, fiche d'équipe),
 * sélecteur de l'admin, liste `/skills`, badges d'accès d'un poste et
 * sélecteur de catégorie de l'éditeur d'améliorations. Ces consommateurs
 * portaient chacun leur propre `switch`, et ils avaient divergé — la liste
 * `/skills` peignait encore la Passe en violet et la Mutation en orange.
 *
 * CONTRASTE : la palette officielle nomme des teintes, pas des couleurs de
 * texte. Deux d'entre elles ne se lisent pas telles quelles et sont traitées
 * à part :
 *  - le **blanc** de la Passe disparaîtrait sur les cartes blanches du site :
 *    il garde une bordure grise franche et un texte anthracite ;
 *  - le **jaune** de l'Agilité ne supporte pas de texte blanc : sa variante
 *    pleine reste sur un texte très sombre.
 * Les autres portent un texte `-900` sur fond `-100` (variante douce) ou du
 * blanc sur fond `-600` (variante pleine) : au-dessus de 4,5:1 dans les deux
 * cas.
 *
 * Les catégories sont stockées en base en anglais ("General", "Agility"…) —
 * sauf "Scélérates", déjà en français. Les variantes singulier/pluriel des
 * données sont couvertes, ainsi que les codes d'accès d'un poste
 * (G/A/S/P/M/K, cf. `SkillAccessBadges`).
 */

/** Palette d'une catégorie, déclinée en variante douce et variante pleine. */
export interface SkillCategoryColor {
  /** Fond clair + texte foncé (badges sans bordure). */
  readonly base: string;
  /** Classe de bordure associée à la variante douce. */
  readonly border: string;
  /** Variante pleine (chip sélectionnée) : fond soutenu + texte + bordure. */
  readonly solid: string;
}

const GRAY: SkillCategoryColor = {
  base: "bg-gray-100 text-gray-600",
  border: "border-gray-300",
  solid: "bg-gray-600 text-white border-gray-700",
};

/** Traits & co : hors code couleur officiel, gris lisible. */
const NEUTRAL: SkillCategoryColor = {
  base: "bg-gray-100 text-gray-800",
  border: "border-gray-300",
  solid: "bg-gray-700 text-white border-gray-800",
};

/** Générale — bleu. */
export const GENERAL_COLOR: SkillCategoryColor = {
  base: "bg-blue-100 text-blue-900",
  border: "border-blue-400",
  solid: "bg-blue-600 text-white border-blue-700",
};

/** Agilité — jaune. Jamais de texte blanc : illisible sur du jaune. */
export const AGILITY_COLOR: SkillCategoryColor = {
  base: "bg-yellow-100 text-yellow-900",
  border: "border-yellow-500",
  solid: "bg-yellow-400 text-yellow-950 border-yellow-600",
};

/** Force — rouge. */
export const STRENGTH_COLOR: SkillCategoryColor = {
  base: "bg-red-100 text-red-900",
  border: "border-red-400",
  solid: "bg-red-600 text-white border-red-700",
};

/** Mutation — vert. */
export const MUTATION_COLOR: SkillCategoryColor = {
  base: "bg-green-100 text-green-900",
  border: "border-green-400",
  solid: "bg-green-600 text-white border-green-700",
};

/**
 * Passe — blanc. Le fond ne porte donc AUCUN contraste : la lisibilité tient
 * entièrement au texte anthracite et à la bordure grise, qui n'est pas
 * décorative ici mais la seule chose qui détache le badge de la carte.
 */
export const PASSING_COLOR: SkillCategoryColor = {
  base: "bg-white text-gray-900",
  border: "border-gray-400",
  solid: "bg-white text-gray-900 border-gray-900",
};

/** Scélérate — violet. */
export const VILLAINY_COLOR: SkillCategoryColor = {
  base: "bg-purple-100 text-purple-900",
  border: "border-purple-400",
  solid: "bg-purple-600 text-white border-purple-700",
};

export const SKILL_CATEGORY_COLORS: Record<string, SkillCategoryColor> = {
  General: GENERAL_COLOR,
  Agility: AGILITY_COLOR,
  Strength: STRENGTH_COLOR,
  Mutation: MUTATION_COLOR,
  Mutations: MUTATION_COLOR,
  Passing: PASSING_COLOR,
  "Scélérates": VILLAINY_COLOR,
  "Scélérate": VILLAINY_COLOR,
  Trait: NEUTRAL,
  Traits: NEUTRAL,
  StarPlayerRule: NEUTRAL,
};

/**
 * Codes d'accès d'un poste (CSV « G,A,S ») → même code couleur. `F` est
 * l'alias français de `S` (Force), `K` la Sournoiserie/Scélérate.
 */
export const SKILL_ACCESS_CODE_COLORS: Record<string, SkillCategoryColor> = {
  G: GENERAL_COLOR,
  A: AGILITY_COLOR,
  S: STRENGTH_COLOR,
  F: STRENGTH_COLOR,
  M: MUTATION_COLOR,
  P: PASSING_COLOR,
  K: VILLAINY_COLOR,
};

/** Palette d'une catégorie. Repli gris neutre pour une catégorie inconnue. */
export function getSkillCategoryPalette(
  category: string | null | undefined,
): SkillCategoryColor {
  return (category && SKILL_CATEGORY_COLORS[category]) || GRAY;
}

/** Palette d'un code d'accès (G/A/S/F/P/M/K). Repli gris neutre. */
export function getSkillAccessPalette(
  code: string | null | undefined,
): SkillCategoryColor {
  return (code && SKILL_ACCESS_CODE_COLORS[code.toUpperCase()]) || GRAY;
}

/**
 * Classes du badge d'une catégorie (variante douce). Repli sur le gris
 * neutre pour une catégorie inconnue (ne casse jamais l'affichage).
 *
 * @param withBorder ajoute la classe de bordure (badges bordés).
 */
export function getSkillCategoryColor(
  category: string | null | undefined,
  withBorder = false,
): string {
  const entry = getSkillCategoryPalette(category);
  return withBorder ? `${entry.base} ${entry.border}` : entry.base;
}

/** Classes de la variante PLEINE (chip sélectionnée) d'une catégorie. */
export function getSkillCategorySolidColor(
  category: string | null | undefined,
): string {
  return getSkillCategoryPalette(category).solid;
}
