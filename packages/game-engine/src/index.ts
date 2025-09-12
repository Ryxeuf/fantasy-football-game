/**
 * @bb/game-engine – moteur de jeu Blood Bowl refactorisé
 * Plateau par défaut: 26 x 15 (Blood Bowl-like)
 * Moves supportés (MVP): MOVE (1 pas ortho), END_TURN
 */

// Export des types
export * from './core/types';

// Export des fonctions utilitaires
export * from './utils/rng';
export * from './utils/dice';
export * from './utils/logging';
export * from './utils/dice-notifications';
export * from './mechanics/movement';
export * from './mechanics/ball';
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
  advanceHalfIfNeeded,
  hasPlayerActed,
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
  clearDiceResult,
} from './core/game-state';
