/**
 * @bb/game-engine – moteur de jeu Blood Bowl refactorisé
 * Plateau par défaut: 26 x 15 (Blood Bowl-like)
 * Moves supportés (MVP): MOVE (1 pas ortho), END_TURN
 */

// packages/game-engine/src/index.ts
export * from './core/game-state';
export * from './core/types';
export * from './mechanics/ball';
export * from './mechanics/dugout';
export * from './utils/logging';

// Spécifiquement pour assurer les nouvelles
export { enterSetupPhase, placePlayerInSetup } from './core/game-state';
export type { ExtendedGameState, PreMatchState } from './core/game-state';

// Autres exports si besoin (mechanics, etc.)
export { getLegalMoves, applyMove } from './actions/actions';
export { makeRNG } from './utils/rng';
export type { GameState, Position, Move } from './core/types';

// Export des fonctions utilitaires
export * from './utils/rng';
export * from './utils/dice';
export * from './utils/dice-notifications';
export * from './utils/team-value-calculator';
export * from './mechanics/movement';
export * from './actions/actions';
// Export des fonctions de blocage (sans conflit)
export {
  canBlock,
  canBlitz,
  calculateOffensiveAssists,
  calculateDefensiveAssists,
  calculateBlockDiceCount,
  getBlockDiceChooser,
  getPushDirection,
  getPushDirections,
  handlePushWithChoice,
  resolveBlockResult,
} from './mechanics/blocking';

// Export des fonctions de gestion d'état (sans conflit)
export {
  setup,
  setupPreMatch,
  setupPreMatchWithTeams,
  advanceHalfIfNeeded,
  canPlayerAct,
  canPlayerMove,
  canPlayerContinueMoving,
  getPlayerAction,
  setPlayerAction,
  clearPlayerActions,
  getTeamBlitzCount,
  canTeamBlitz,
  incrementTeamBlitzCount,
  clearTeamBlitzCounts,
  shouldEndPlayerTurn,
  endPlayerTurn,
  checkPlayerTurnEnd,
  shouldAutoEndTurn,
  handlePlayerSwitch,
  handlePostTouchdown,
} from './core/game-state';

// Export des fonctions de pré-match
export {
  startPreMatchSequence,
  calculateFanFactor,
  determineWeather,
  addJourneymen,
  processInducements,
  processPrayersToNuffle,
  determineKickingTeam,
} from './core/pre-match-sequence';
export type { JourneymanStats } from './core/pre-match-sequence';

// Export du système d'inducements
export {
  INDUCEMENT_CATALOGUE,
  getInducementDefinition,
  calculatePettyCash,
  getInducementCost,
  validateInducementSelection,
  applyInducementEffects,
  processInducementsWithSelection,
} from './core/inducements';
export type {
  InducementSlug,
  InducementDefinition,
  InducementContext,
  PurchasedInducement,
  InducementSelection,
  InducementValidationResult,
  PettyCashInput,
  PettyCashResult,
} from './core/inducements';

// Export du handler d'inducements
export {
  handleInducementSubmission,
} from './core/inducement-handler';
export type {
  InducementSubmissionParams,
  InducementSubmissionResult,
} from './core/inducement-handler';

// Export des types de météo
export {
  WEATHER_TYPES,
  getWeatherType,
  getWeatherCondition,
  type WeatherType,
  type WeatherTypeDefinition,
  type WeatherCondition,
} from './core/weather-types';

// Export des fonctions de dugout
export { movePlayerToDugoutZone } from './mechanics/dugout';

// Export des prières à Nuffle
export { PRAYERS_TABLE, applyPrayerEffect } from './mechanics/prayers-to-nuffle';
export type { PrayerDefinition, PrayerEffect, PrayerEffectResult } from './mechanics/prayers-to-nuffle';

// Export des fonctions de blessure
export { performInjuryRoll, rollLastingInjuryType } from './mechanics/injury';

// Export des fonctions d'apothecaire
export { applyApothecaryChoice, isApothecaryAvailable } from './mechanics/apothecary';

// Export des fonctions de passe et remise
export { executePass, executeHandoff, getPassRange, getDistance, findInterceptors } from './mechanics/passing';

// Export du Lancer de Coéquipier (Throw Team-Mate)
export { canThrowTeamMate, getThrowRange, executeThrowTeamMate } from './mechanics/throw-team-mate';

// Export des fonctions de faute
export { canFoul, executeFoul, calculateFoulAssists } from './mechanics/foul';

// Export du système d'armes secrètes
export { expelSecretWeapons, getSecretWeaponPlayers } from './mechanics/secret-weapons';

// Export du système d'animosité
export { extractLineage, hasAnimosityAgainst, checkAnimosity } from './mechanics/animosity';

// Export des effets météo
export {
  getWeatherModifiers,
  applyWeatherDriveEffects,
  isPassRangeAllowed,
  type WeatherModifiers,
} from './mechanics/weather-effects';

// Export des événements de kickoff
export {
  KICKOFF_EVENTS,
  rollKickoffEvent,
  applyKickoffEvent,
  type KickoffEvent,
} from './mechanics/kickoff-events';

// Export du calcul de zones de tacle (heatmap)
export {
  calculateTackleZoneHeatmap,
  getTeamTackleZones,
  countTackleZonesAt,
  type TackleZoneCell,
  type TackleZoneHeatmap,
} from './mechanics/tackle-zones';

// Export du simulateur de probabilités
export {
  calculateMoveProbability,
  calculateBlockProbability,
  calculatePassProbability,
  calculateFoulProbability,
  calculateAllProbabilities,
  type ActionProbability,
  type ProbabilityBreakdown,
} from './utils/probability-calculator';

// Export de la configuration des règles
export {
  FULL_RULES,
  SIMPLIFIED_RULES,
  getRulesConfig,
  createCustomRules,
  type RulesMode,
  type RulesConfig,
} from './core/rules-config';

// Export du système de validation (arbitre IA)
export {
  validateMove,
  validateGameState,
  type ValidationResult,
  type ValidationError,
  type ValidationWarning,
} from './utils/referee';

// Export du registre de compétences modulaire
export {
  registerSkill,
  getSkillEffect,
  getAllRegisteredSkills,
  getSkillsForTrigger,
  collectModifiers,
  type SkillEffect,
  type SkillTrigger,
  type SkillContext,
  type SkillModifier,
} from './skills/skill-registry';

// Export du bridge skill-registry → moteur
export {
  getDodgeSkillModifiers,
  getPickupSkillModifiers,
  getArmorSkillContext,
  getInjurySkillModifiers,
  getFoulArmorSkillModifiers,
  canSkillReroll,
  checkGuard,
  checkBlockNegatesBothDown,
  checkDodgeNegatesStumble,
  checkWrestleOnBothDown,
  getMightyBlowBonusFromRegistry,
} from './skills/skill-bridge';

// Export des rosters et positions
export * from './rosters';

// Export des compétences (skills)
export * from './skills';
export * from './skills/skill-effects';

// Enregistrement des règles spéciales des Star Players
export {
  isStarPlayerRuleUsed,
  markStarPlayerRuleUsed,
} from './skills/star-player-rules';

// Export des utilitaires d'avancements
export { 
  getNextAdvancementPspCost, 
  calculateAdvancementsSurcharge, 
  calculatePlayerCurrentValue,
  SURCHARGE_PER_ADVANCEMENT,
  isRandomAdvancement,
  getCategoryAccessType,
  type AdvancementType,
  type PlayerAdvancement
} from './utils/advancements';

// Accès de catégories par position
export { getPositionCategoryAccess, type CategoryAccess, type SkillCategory } from './utils/skill-access';
