/**
 * Prérequis d'une compétence, résolus pour l'affichage (compendium, admin).
 *
 * Volontairement sans import du moteur : ce module part dans le bundle de la
 * page publique du compendium, qui n'a besoin que de découper un CSV.
 */

export interface SkillPrerequisite {
  readonly slug: string;
  readonly nameFr: string;
  readonly nameEn: string;
}

interface NamedSkill {
  readonly slug: string;
  readonly nameFr: string;
  readonly nameEn: string;
}

/** Slugs d'un CSV `requiredSkills`. `null` ou vide : aucun prérequis. */
export function parseRequiredSkillSlugs(
  raw: string | null | undefined,
): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((slug) => slug.trim())
    .filter(Boolean);
}

/** Prérequis nommés depuis le catalogue ; un slug inconnu s'affiche tel quel. */
export function resolveSkillPrerequisites(
  requiredSkills: string | null | undefined,
  catalog: readonly NamedSkill[],
): SkillPrerequisite[] {
  return parseRequiredSkillSlugs(requiredSkills).map((slug) => {
    const known = catalog.find((skill) => skill.slug === slug);
    return { slug, nameFr: known?.nameFr ?? slug, nameEn: known?.nameEn ?? slug };
  });
}
