/**
 * Données spécifiques des compétences pour la Saison 3 (Blood Bowl 2025)
 * Source: https://mordorbihan.fr/fr/bloodbowl/2025/competences
 *
 * Ce fichier contient :
 * - Les nouvelles compétences de la Saison 3
 * - Les modifications de catégories pour les compétences existantes
 * - Les compétences "Elite" identifiées
 */

export interface Season3SkillData {
  slug: string;
  nameFr: string;
  nameEn: string;
  description: string;
  descriptionEn?: string;
  category: string;
  isElite?: boolean;
  isPassive?: boolean;
  isNew?: boolean; // Nouvelle compétence (n'existe pas en S2)
}

/**
 * Compétences qui changent de catégorie en Saison 3
 * Ces compétences passent à la catégorie "Scélérates"
 */
export const SEASON_3_CATEGORY_CHANGES: Record<string, string> = {
  "shadowing": "Scélérates",        // Poursuite -> Scélérates
  "sneaky-git": "Scélérates",       // Sournois -> Scélérates
  "dirty-player-1": "Scélérates",   // Joueur Déloyal (+1) -> Scélérates
  "dirty-player-2": "Scélérates",   // Joueur Déloyal (+2) -> Scélérates
  "pile-driver": "Scélérates",      // Marteau-Pilon -> Scélérates
  "fumblerooskie": "Scélérates",    // Fumblerooskie -> Scélérates
};

/**
 * Compétences Elite en Saison 3
 * Ces compétences ont le statut "Elite" qui ajoute +10,000 à la valeur d'équipe
 */
export const SEASON_3_ELITE_SKILLS: string[] = [
  "block",        // Blocage
  "dodge",        // Esquive
  "mighty-blow",   // Châtaigne (ancienne version)
  "mighty-blow-1", // Châtaigne (+1)
  "mighty-blow-2", // Châtaigne (+2)
  "guard",        // Garde
];

/**
 * Nouvelles compétences de la Saison 3
 * 
 * NOTE: Cette liste est maintenant vide car toutes les nouvelles compétences S3
 * sont définies directement dans packages/game-engine/src/skills/index.ts
 * avec le flag `season3Only: true`.
 * 
 * Ce fichier est conservé pour :
 * - SEASON_3_CATEGORY_CHANGES : changements de catégorie pour les compétences existantes
 * - SEASON_3_ELITE_SKILLS : liste des compétences Elite en S3
 * - SEASON_3_RENAMED_SKILLS : compétences renommées en S3
 */
export const SEASON_3_NEW_SKILLS: Season3SkillData[] = [];

/**
 * Compétences qui ont été modifiées/renommées en Saison 3
 * (avec un nom anglais différent de Mordorbihan)
 */
export const SEASON_3_RENAMED_SKILLS: Record<string, { nameEn: string; nameFr?: string }> = {
  "big-hand": { nameEn: "Big Hand", nameFr: "Main Démesurée" }, // Grande Main -> Main Démesurée
  "foul-appearance": { nameEn: "Foul Appearance", nameFr: "Répulsion" }, // Apparence Répugnante -> Répulsion
  "no-hands": { nameEn: "No Ball", nameFr: "Sans Ballon" }, // Pas de Mains -> Sans Ballon
};

