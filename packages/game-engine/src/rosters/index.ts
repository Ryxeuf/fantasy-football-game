/**
 * Export des rosters et positions
 */

// Import explicite pour garantir la présence de TEAM_ROSTERS au runtime
import { TEAM_ROSTERS } from './positions';

export * from './positions';
export {
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

// Export des couleurs d'equipes (H.6 — sprite sheets par equipe, etape 1)
export {
  DEFAULT_TEAM_COLORS,
  ROSTER_COLORS,
  getTeamColors,
  type TeamColors,
} from './team-colors';

// Export du registry de sprite manifests (H.6 — sub-task 4/5)
export {
  TEAM_SPRITE_MANIFESTS,
  getTeamSpriteManifest,
  hasTeamSprite,
  isTeamSpriteManifest,
  type SpriteFrame,
  type TeamSpriteManifest,
} from './team-sprites';

// Export des equipes prioritaires (P2.7)
export {
  PRIORITY_TEAM_ROSTERS,
  getStarPlayersHirableByPriorityTeams,
  type PriorityTeamRoster,
} from './priority-teams';

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
