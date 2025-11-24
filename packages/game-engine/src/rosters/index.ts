/**
 * Export des rosters et positions
 */

export * from './positions';
export {
  TEAM_ROSTERS,
  TEAM_ROSTERS_BY_RULESET,
  RULESETS,
  DEFAULT_RULESET,
  getPositionBySlug,
  getTeamPositions,
  getDisplayName,
  getSlugFromDisplayName,
  LEGACY_POSITION_MAPPING,
  type Ruleset,
} from './positions';

// Export des Star Players
export * from './star-players';
export { 
  STAR_PLAYERS, 
  getStarPlayerBySlug, 
  getAvailableStarPlayers, 
  TEAM_REGIONAL_RULES,
  TEAM_REGIONAL_RULES_BY_RULESET,
  getRegionalRulesForTeam,
  type StarPlayerDefinition,
  type RegionalRule
} from './star-players';

// Export des utilitaires Star Players
export * from './star-players-utils';
export {
  parseStarPlayerSkills,
  getStarPlayerSkillDefinitions,
  getStarPlayerSkillDisplayNames,
  getStarPlayerSkillSlugs,
  formatStarPlayerSkills
} from './star-players-utils';

// Types pour compatibilité
export type AllowedRoster = keyof typeof TEAM_ROSTERS;
export const ALLOWED_TEAMS: AllowedRoster[] = Object.keys(TEAM_ROSTERS) as AllowedRoster[];
