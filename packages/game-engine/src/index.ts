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
export * from './core/boardgame-io';

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

// Export des fonctions de blessure
export { performInjuryRoll } from './mechanics/injury';

// Export des rosters et positions
export * from './rosters';

// Export des compétences (skills)
export * from './skills';

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
