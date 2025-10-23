/**
 * Export des rosters et positions
 */

export * from './positions';
export { TEAM_ROSTERS, getPositionBySlug, getTeamPositions, getDisplayName, getSlugFromDisplayName, LEGACY_POSITION_MAPPING } from './positions';

// Export des Star Players
export * from './star-players';
export { 
  STAR_PLAYERS, 
  getStarPlayerBySlug, 
  getAvailableStarPlayers, 
  TEAM_REGIONAL_RULES,
  type StarPlayerDefinition,
  type RegionalRule
} from './star-players';

// Types pour compatibilité
export type AllowedRoster = 'skaven' | 'lizardmen' | 'wood_elf';
export const ALLOWED_TEAMS: AllowedRoster[] = ['skaven', 'lizardmen', 'wood_elf'];
