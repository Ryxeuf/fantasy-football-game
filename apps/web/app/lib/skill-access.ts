/**
 * Accès Principale/Secondaire d'un poste, côté web — lu EN BASE.
 *
 * Audit statique vs base — lot 5 (W4). L'éditeur d'avancements et la feuille
 * de match proposaient les catégories de `getPositionCategoryAccess`
 * (`ACCESS_BY_POSITION`, 12 postes Saison 2 ; tous les autres tombaient sur
 * TOUTES les catégories, Trait compris). Le serveur, lui, valide désormais sur
 * `Position.primarySkills` / `secondarySkills` : le coach se voyait proposer
 * des catégories que la requête refusait ensuite.
 *
 * Miroir client de `apps/server/src/services/skill-access.ts` — mêmes codes,
 * même tolérance de format (CSV `"G,S"` ou concaténé `"GS"`, alias `F → S`).
 * 100 % pur : testable sans rendu React.
 */

export type SkillCategoryCode = "G" | "A" | "S" | "P" | "M" | "K";

/** Code canonique → nom de catégorie DB (`Skill.category`). */
export const CATEGORY_BY_CODE: Readonly<Record<SkillCategoryCode, string>> = {
  G: "General",
  A: "Agility",
  S: "Strength",
  P: "Passing",
  M: "Mutation",
  K: "Scélérates",
};

/** Ordre canonique d'affichage. */
const CODE_ORDER: readonly SkillCategoryCode[] = ["G", "A", "S", "P", "M", "K"];

function normalizeAccessLetter(letter: string): SkillCategoryCode | null {
  const u = letter.trim().toUpperCase();
  // La saisie admin historique abrège Force « F », le code stocké est « S ».
  if (u === "F") return "S";
  return (CODE_ORDER as readonly string[]).includes(u)
    ? (u as SkillCategoryCode)
    : null;
}

/** Parse un CSV/concaténation d'accès en codes canoniques dédoublonnés. */
export function parseAccessCsv(
  csv: string | null | undefined,
): SkillCategoryCode[] {
  const seen = new Set<SkillCategoryCode>();
  for (const ch of csv ?? "") {
    const code = normalizeAccessLetter(ch);
    if (code) seen.add(code);
  }
  return CODE_ORDER.filter((c) => seen.has(c));
}

/**
 * Catégories (noms DB) autorisées pour ce type d'avancement.
 *
 * `null` = accès NON RENSEIGNÉ pour cette position (les deux colonnes sont
 * nulles, cas des rosters Saison 2) : l'appelant doit alors retomber sur le
 * catalogue compilé, comme le serveur qui n'impose rien dans ce cas.
 * `[]` = accès renseigné mais pool vide (positions animales) — c'est une
 * réponse, pas une absence de réponse.
 */
export function allowedCategoriesFor(
  access: {
    readonly primarySkills?: string | null;
    readonly secondarySkills?: string | null;
  } | null
    | undefined,
  type: "primary" | "secondary" | "random-primary",
): string[] | null {
  if (!access) return null;
  const { primarySkills, secondarySkills } = access;
  if (primarySkills == null && secondarySkills == null) return null;
  const csv =
    type === "secondary" ? secondarySkills : primarySkills;
  return parseAccessCsv(csv).map((code) => CATEGORY_BY_CODE[code]);
}
