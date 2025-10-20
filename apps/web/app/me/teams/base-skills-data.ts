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
 * Sépare les compétences en compétences de base et compétences acquises
 * @param positionSlug Le slug de la position du joueur
 * @param allSkillSlugs Tous les slugs de compétences du joueur
 */
export function separateSkills(positionSlug: string, allSkillSlugs: string[]): {
  baseSkills: string[];
  acquiredSkills: string[];
} {
  const baseSkills = getBaseSkillSlugs(positionSlug);
  const acquiredSkills: string[] = [];
  
  for (const skillSlug of allSkillSlugs) {
    if (!baseSkills.includes(skillSlug)) {
      acquiredSkills.push(skillSlug);
    }
  }
  
  return {
    baseSkills: allSkillSlugs.filter(slug => baseSkills.includes(slug)),
    acquiredSkills
  };
}

/**
 * Obtient toutes les positions d'une équipe
 */
export function getTeamPositionsForRoster(teamRoster: string) {
  return getTeamPositions(teamRoster);
}
