/**
 * Utilitaires pour la gestion des Star Players
 * Centralise la logique de parsing et d'affichage des compétences
 */
import { getSkillBySlug } from '../skills/index';
/**
 * Mapping des slugs français/alternatifs vers les slugs anglais officiels
 * Les clés sont normalisées (apostrophes typographiques converties en apostrophes droites)
 */
const SKILL_SLUG_MAPPING = {
    // Variantes normalisées (après conversion des apostrophes)
    "nerfs-d'acier": "nerves-of-steel",  // toutes les variantes d'apostrophes sont normalisées vers '
    "nerfs-dacier": "nerves-of-steel",   // sans apostrophe
    // Autres variantes possibles
    "loner-3": "loner-4",
    "loner-5": "loner-4",
};
/**
 * Normalise un slug de compétence vers le slug officiel
 */
function normalizeSkillSlug(slug) {
    // Normaliser les apostrophes typographiques vers apostrophes droites
    // U+2019 (') → U+0027 (')
    let normalized = slug.replace(/\u2019/g, "'");
    // Nettoyer les espaces et caractères invisibles
    normalized = normalized.trim();
    // Vérifier dans le mapping avec la version normalisée
    if (SKILL_SLUG_MAPPING[normalized]) {
        return SKILL_SLUG_MAPPING[normalized];
    }
    // Retourner le slug normalisé si pas de mapping
    return normalized;
}
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
        // Normaliser le slug d'abord
        const normalizedSlug = normalizeSkillSlug(slug);
        // Essayer avec le slug normalisé
        let skill = getSkillBySlug(normalizedSlug);
        // Si toujours pas trouvé, essayer avec le slug original
        if (!skill) {
            skill = getSkillBySlug(slug);
        }
        if (skill) {
            definitions.push(skill);
        }
        else {
            console.warn(`Compétence non trouvée pour le slug: ${slug} (normalisé: ${normalizedSlug}) (Star Player: ${starPlayer.displayName})`);
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
