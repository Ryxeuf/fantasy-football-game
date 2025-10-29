/**
 * Utilitaires pour la gestion des Star Players
 * Centralise la logique de parsing et d'affichage des compétences
 */
import { getSkillBySlug } from '../skills/index';
/**
 * Parse les compétences d'un star player (qui sont stockées comme string)
 * et retourne un tableau de slugs
 */
export function parseStarPlayerSkills(skillsString) {
    if (!skillsString || skillsString.trim() === "") {
        return [];
    }
    return skillsString
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);
}
/**
 * Obtient les définitions complètes des compétences d'un star player
 */
export function getStarPlayerSkillDefinitions(starPlayer) {
    const slugs = parseStarPlayerSkills(starPlayer.skills);
    const definitions = [];
    for (const slug of slugs) {
        const skill = getSkillBySlug(slug);
        if (skill) {
            definitions.push(skill);
        }
        else {
            console.warn(`Compétence non trouvée pour le slug: ${slug} (Star Player: ${starPlayer.displayName})`);
        }
    }
    return definitions;
}
/**
 * Obtient les noms d'affichage (français) des compétences d'un star player
 */
export function getStarPlayerSkillDisplayNames(starPlayer) {
    return getStarPlayerSkillDefinitions(starPlayer).map(skill => skill.nameFr);
}
/**
 * Obtient les slugs des compétences d'un star player (dédupliqués et nettoyés)
 */
export function getStarPlayerSkillSlugs(starPlayer) {
    return parseStarPlayerSkills(starPlayer.skills);
}
/**
 * Formate les compétences d'un star player pour l'affichage
 * Retourne un objet avec les slugs et les noms d'affichage
 */
export function formatStarPlayerSkills(starPlayer) {
    const slugs = parseStarPlayerSkills(starPlayer.skills);
    const definitions = getStarPlayerSkillDefinitions(starPlayer);
    const displayNames = definitions.map(d => d.nameFr);
    return {
        slugs,
        displayNames,
        definitions
    };
}
