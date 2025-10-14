/**
 * Utilitaires pour les positions des joueurs
 */

// Mapping des slugs vers les noms d'affichage
const POSITION_DISPLAY_NAMES: Record<string, string> = {
  // Skaven
  'skaven_lineman': 'Lineman',
  'skaven_thrower': 'Thrower', 
  'skaven_blitzer': 'Blitzer',
  'skaven_gutter_runner': 'Gutter Runner',
  'skaven_rat_ogre': 'Rat Ogre',
  
  // Lizardmen
  'lizardmen_saurus': 'Saurus',
  'lizardmen_skink': 'Skink',
  'lizardmen_kroxigor': 'Kroxigor',
};

/**
 * Convertit un slug de position en nom d'affichage
 */
export function getPositionDisplayName(slug: string): string {
  return POSITION_DISPLAY_NAMES[slug] || slug;
}

/**
 * Convertit un nom d'affichage en slug de position
 */
export function getPositionSlug(displayName: string): string {
  const entry = Object.entries(POSITION_DISPLAY_NAMES).find(
    ([_, name]) => name === displayName
  );
  return entry ? entry[0] : displayName;
}
