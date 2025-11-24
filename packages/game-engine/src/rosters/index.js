/**
 * Export des rosters et positions
 */
import { TEAM_ROSTERS } from './positions';
export * from './positions';
export { TEAM_ROSTERS, TEAM_ROSTERS_BY_RULESET, RULESETS, DEFAULT_RULESET, getPositionBySlug, getTeamPositions, getDisplayName, getSlugFromDisplayName, LEGACY_POSITION_MAPPING } from './positions';
// Export des Star Players
export * from './star-players';
export { STAR_PLAYERS, getStarPlayerBySlug, getAvailableStarPlayers, TEAM_REGIONAL_RULES, TEAM_REGIONAL_RULES_BY_RULESET, getRegionalRulesForTeam } from './star-players';
// Export des utilitaires Star Players
export * from './star-players-utils';
export { parseStarPlayerSkills, getStarPlayerSkillDefinitions, getStarPlayerSkillDisplayNames, getStarPlayerSkillSlugs, formatStarPlayerSkills } from './star-players-utils';
export const ALLOWED_TEAMS = Object.keys(TEAM_ROSTERS);
