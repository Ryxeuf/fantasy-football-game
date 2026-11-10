/**
 * Prérequis d'acquisition d'une compétence (ex. Bras Musclé exige Lancer de
 * Coéquipier) : une contrainte qui s'ajoute à l'accès par catégorie.
 *
 * La valeur vit en base (`Skill.requiredSkills`, éditable en admin) : un CSV
 * de slugs. Plusieurs slugs sont des ALTERNATIVES (le joueur doit en posséder
 * au moins un). `null` ou vide : aucune contrainte.
 *
 * Le contrôle ne vaut qu'à l'ACQUISITION : un joueur qui possède déjà la
 * compétence la conserve.
 */

/** Forme canonique d'un slug : certaines données historiques portent des `_`. */
function canonicalSlug(slug: string): string {
  return slug.trim().toLowerCase().replace(/_/g, "-");
}

/** Slugs requis, sans doublon. `null`, vide ou illisible : liste vide. */
export function parseRequiredSkills(
  raw: string | null | undefined,
): string[] {
  if (!raw) return [];
  return [...new Set(raw.split(",").map(canonicalSlug).filter(Boolean))];
}

/** `true` si le joueur peut acquérir une compétence portant ces prérequis. */
export function meetsSkillPrerequisites(
  required: string | null | undefined,
  ownedSlugs: readonly string[],
): boolean {
  const alternatives = parseRequiredSkills(required);
  if (alternatives.length === 0) return true;
  const owned = new Set(ownedSlugs.map(canonicalSlug));
  return alternatives.some((slug) => owned.has(slug));
}
