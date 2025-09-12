/**
 * @bb/game-engine – moteur de jeu Blood Bowl refactorisé
 * Plateau par défaut: 26 x 15 (Blood Bowl-like)
 * Moves supportés (MVP): MOVE (1 pas ortho), END_TURN
 */

// Export des types
export * from './types';

// Export des fonctions utilitaires
export * from './rng';
export * from './dice';
export * from './logging';
export * from './movement';
export * from './ball';
export * from './actions';
export * from './boardgame-io';

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
  resolveBlockResult
} from './blocking';

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
  clearDiceResult
} from './game-state';
