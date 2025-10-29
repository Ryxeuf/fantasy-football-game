/**
 * Export des rosters et positions
 */
export * from './positions';
export { TEAM_ROSTERS, getPositionBySlug, getTeamPositions, getDisplayName, getSlugFromDisplayName, LEGACY_POSITION_MAPPING } from './positions';
// Export des Star Players
export * from './star-players';
export { STAR_PLAYERS, getStarPlayerBySlug, getAvailableStarPlayers, TEAM_REGIONAL_RULES } from './star-players';
// Export des utilitaires Star Players
export * from './star-players-utils';
export { parseStarPlayerSkills, getStarPlayerSkillDefinitions, getStarPlayerSkillDisplayNames, getStarPlayerSkillSlugs, formatStarPlayerSkills } from './star-players-utils';
export const ALLOWED_TEAMS = ['skaven', 'lizardmen', 'wood_elf'];
