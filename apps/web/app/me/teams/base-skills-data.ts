/**
 * Compétences de base par position - maintenant basé sur le game-engine
 * Ce fichier utilise les définitions centralisées du game-engine
 */

import { getPositionBySlug, getTeamPositions, parseSkillSlugs } from "@bb/game-engine";

/**
 * Obtient les slugs de compétences de base pour un joueur selon son slug de position
 */
export function getBaseSkillSlugs(positionSlug: string): string[] {
  const position = getPositionBySlug(positionSlug);
  if (!position) {
    return [];
  }
  return parseSkillSlugs(position.skills);
}

/**
 * Obtient les slugs de compétences de base pour une position par nom d'équipe et position
 * Cette fonction est conservée pour compatibilité ascendante
 */
export function getBaseSkills(teamName: string, positionSlug: string): string[] {
  return getBaseSkillSlugs(positionSlug);
}

/**
 * Vérifie si un slug de compétence est une compétence de base pour une position
 */
export function isBaseSkill(positionSlug: string, skillSlug: string): boolean {
  const baseSkills = getBaseSkillSlugs(positionSlug);
  return baseSkills.includes(skillSlug);
}

/**
 * Normalise un slug de compétence pour la comparaison
 * Les variantes loner-3, loner-4, loner-5 sont maintenant des compétences distinctes
 * Cette fonction peut être étendue pour d'autres normalisations si nécessaire
 */
function normalizeSkillSlug(slug: string): string {
  // Les variantes loner sont maintenant des compétences distinctes, pas besoin de normalisation
  return slug;
}

/**
 * Sépare les compétences en compétences de base et compétences acquises
 * @param positionSlug Le slug de la position du joueur
 * @param allSkillSlugs Tous les slugs de compétences du joueur
 */
export function separateSkills(positionSlug: string, allSkillSlugs: string[]): {
  baseSkills: string[];
  acquiredSkills: string[];
} {
  const baseSkills = getBaseSkillSlugs(positionSlug);
  // Créer un Set pour une recherche plus rapide
  const baseSkillsSet = new Set(baseSkills);
  const normalizedBaseSkillsSet = new Set(baseSkills.map(normalizeSkillSlug));
  
  const baseSkillsResult: string[] = [];
  const acquiredSkillsResult: string[] = [];
  
  for (const skillSlug of allSkillSlugs) {
    const normalizedSlug = normalizeSkillSlug(skillSlug);
    // Vérifier si la compétence est une compétence de base (exacte ou normalisée)
    if (baseSkillsSet.has(skillSlug) || normalizedBaseSkillsSet.has(normalizedSlug)) {
      baseSkillsResult.push(skillSlug);
    } else {
      acquiredSkillsResult.push(skillSlug);
    }
  }
  
  return {
    baseSkills: baseSkillsResult,
    acquiredSkills: acquiredSkillsResult
  };
}

/**
 * Obtient toutes les positions d'une équipe
 */
export function getTeamPositionsForRoster(teamRoster: string) {
  return getTeamPositions(teamRoster);
}
