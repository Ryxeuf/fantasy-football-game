/**
 * Interface avec le système de compétences du game-engine
 * Ce fichier sert de pont entre les slugs et l'affichage dans l'interface web
 */

import { 
  getSkillBySlug, 
  getSkillByNameFr, 
  getSkillByNameEn, 
  parseSkillSlugs,
  getDisplayNames,
  convertNamesToSlugs,
  type SkillDefinition 
} from "@bb/game-engine";

export interface SkillDescription {
  name: string;
  description: string;
  category: string;
}

/**
 * Obtient la description d'une compétence par son slug
 */
export function getSkillDescription(slugOrName: string): SkillDescription | null {
  // Essayer d'abord comme slug
  let skill = getSkillBySlug(slugOrName);
  
  // Si pas trouvé, essayer comme nom français (pour compatibilité)
  if (!skill) {
    skill = getSkillByNameFr(slugOrName);
  }
  
  // Si toujours pas trouvé, essayer comme nom anglais
  if (!skill) {
    skill = getSkillByNameEn(slugOrName);
  }
  
  if (!skill) {
    return null;
  }
  
  return {
    name: skill.nameFr,
    description: skill.description,
    category: skill.category
  };
}

/**
 * Parse une chaîne de compétences et retourne les slugs
 * Supporte à la fois les slugs et les noms (pour migration)
 */
export function parseSkills(skillsString: string): string[] {
  if (!skillsString || skillsString.trim() === "") {
    return [];
  }
  
  const parts = skillsString.split(",").map(s => s.trim()).filter(s => s.length > 0);
  const slugs: string[] = [];
  
  for (const part of parts) {
    // Si c'est déjà un slug valide (avec des tirets), l'utiliser directement
    if (part.includes("-") || getSkillBySlug(part)) {
      slugs.push(part);
    } else {
      // Sinon, essayer de le convertir depuis un nom
      const skill = getSkillByNameFr(part) || getSkillByNameEn(part);
      if (skill) {
        slugs.push(skill.slug);
      } else {
        // Si on ne trouve pas la compétence, garder le texte original
        // (pour debug ou compétences non encore ajoutées)
        slugs.push(part);
      }
    }
  }
  
  return slugs;
}

/**
 * Obtient les noms d'affichage (français) à partir d'une chaîne de compétences
 */
export function getSkillDisplayNames(skillsString: string): string[] {
  const slugs = parseSkills(skillsString);
  return slugs.map(slug => {
    const skill = getSkillBySlug(slug);
    return skill ? skill.nameFr : slug;
  });
}

/**
 * Convertit une liste de slugs en noms français pour l'affichage
 */
export function slugsToDisplayNames(slugs: string[]): string[] {
  return slugs.map(slug => {
    const skill = getSkillBySlug(slug);
    return skill ? skill.nameFr : slug;
  });
}

/**
 * Convertit une chaîne de noms (français ou anglais) en chaîne de slugs
 * Utile pour la migration des données existantes
 */
export function migrateNamesToSlugs(skillsString: string): string {
  return convertNamesToSlugs(skillsString);
}
