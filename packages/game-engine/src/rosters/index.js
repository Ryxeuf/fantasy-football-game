/**
 * Export des rosters et positions
 */
export * from './positions';
export { TEAM_ROSTERS, getPositionBySlug, getTeamPositions, getDisplayName, getSlugFromDisplayName, LEGACY_POSITION_MAPPING } from './positions';
export const ALLOWED_TEAMS = ['skaven', 'lizardmen'];
