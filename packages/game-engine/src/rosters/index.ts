/**
 * Export des rosters et positions
 */

export * from './positions';
export { TEAM_ROSTERS, getPositionBySlug, getTeamPositions, getDisplayName, getSlugFromDisplayName, LEGACY_POSITION_MAPPING } from './positions';

// Types pour compatibilité
export type AllowedRoster = 'skaven' | 'lizardmen' | 'wood_elf';
export const ALLOWED_TEAMS: AllowedRoster[] = ['skaven', 'lizardmen', 'wood_elf'];
