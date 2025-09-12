/**
 * Système de notifications pour les jets de dés
 * Intègre les notifications toaster avec le système de dés existant
 */

import { RNG, Player, DiceResult, BlockResult } from '../core/types';

// Type pour les callbacks de notification
export type DiceNotificationCallback = (playerName: string, diceResult: DiceResult) => void;
export type BlockDiceNotificationCallback = (playerName: string, blockResult: BlockResult) => void;

// Variables globales pour stocker les callbacks
let diceNotificationCallback: DiceNotificationCallback | null = null;
let blockDiceNotificationCallback: BlockDiceNotificationCallback | null = null;

/**
 * Enregistre un callback pour les notifications de dés
 */
export function setDiceNotificationCallback(callback: DiceNotificationCallback | null) {
  diceNotificationCallback = callback;
}

/**
 * Enregistre un callback pour les notifications de dés de blocage
 */
export function setBlockDiceNotificationCallback(callback: BlockDiceNotificationCallback | null) {
  blockDiceNotificationCallback = callback;
}

/**
 * Notifie le résultat d'un jet de dés
 */
function notifyDiceResult(playerName: string, diceResult: DiceResult) {
  if (diceNotificationCallback) {
    diceNotificationCallback(playerName, diceResult);
  }
}

/**
 * Notifie le résultat d'un dé de blocage
 */
function notifyBlockDiceResult(playerName: string, blockResult: BlockResult) {
  if (blockDiceNotificationCallback) {
    blockDiceNotificationCallback(playerName, blockResult);
  }
}

/**
 * Wrapper pour les fonctions de dés existantes avec notifications
 */

/**
 * Lance un dé à 6 faces avec notification
 */
export function rollD6WithNotification(rng: RNG, playerName: string): number {
  const result = Math.floor(rng() * 6) + 1;
  
  // Créer un DiceResult simple pour la notification
  const diceResult: DiceResult = {
    type: 'dice',
    diceRoll: result,
    targetNumber: 0,
    success: false,
  };
  
  notifyDiceResult(playerName, diceResult);
  return result;
}

/**
 * Lance deux dés à 6 faces avec notification
 */
export function roll2D6WithNotification(rng: RNG, playerName: string): number {
  const die1 = Math.floor(rng() * 6) + 1;
  const die2 = Math.floor(rng() * 6) + 1;
  const result = die1 + die2;
  
  // Créer un DiceResult pour la notification
  const diceResult: DiceResult = {
    type: 'dice',
    diceRoll: result,
    targetNumber: 0,
    success: false,
  };
  
  notifyDiceResult(playerName, diceResult);
  return result;
}

/**
 * Effectue un jet d'esquive avec notification
 */
export function performDodgeRollWithNotification(
  player: Player, 
  rng: RNG, 
  modifiers: number = 0
): DiceResult {
  const diceRoll = Math.floor(rng() * 6) + 1;
  const targetNumber = Math.max(2, Math.min(6, player.ag - modifiers));
  const success = diceRoll >= targetNumber;

  const diceResult: DiceResult = {
    type: 'dodge',
    diceRoll,
    targetNumber,
    success,
    modifiers,
  };

  notifyDiceResult(player.name, diceResult);
  return diceResult;
}

/**
 * Effectue un jet de ramassage avec notification
 */
export function performPickupRollWithNotification(
  player: Player, 
  rng: RNG, 
  modifiers: number = 0
): DiceResult {
  const diceRoll = Math.floor(rng() * 6) + 1;
  const targetNumber = Math.max(2, Math.min(6, player.ag - modifiers));
  const success = diceRoll >= targetNumber;

  const diceResult: DiceResult = {
    type: 'pickup',
    diceRoll,
    targetNumber,
    success,
    modifiers,
  };

  notifyDiceResult(player.name, diceResult);
  return diceResult;
}

/**
 * Effectue un jet d'armure avec notification
 */
export function performArmorRollWithNotification(
  player: Player, 
  rng: RNG, 
  modifiers: number = 0
): DiceResult {
  const diceRoll = Math.floor(rng() * 6) + 1;
  const targetNumber = Math.max(2, Math.min(6, player.av - modifiers));
  const success = diceRoll >= targetNumber;

  const diceResult: DiceResult = {
    type: 'armor',
    diceRoll,
    targetNumber,
    success,
    modifiers,
  };

  notifyDiceResult(player.name, diceResult);
  return diceResult;
}

/**
 * Lance un dé de blocage avec notification
 */
export function rollBlockDiceWithNotification(rng: RNG, playerName: string): BlockResult {
  const roll = Math.floor(rng() * 6) + 1;

  let blockResult: BlockResult;
  switch (roll) {
    case 1:
      blockResult = 'PLAYER_DOWN';
      break;
    case 2:
      blockResult = 'BOTH_DOWN';
      break;
    case 3:
      blockResult = 'PUSH_BACK';
      break;
    case 4:
      blockResult = 'STUMBLE';
      break;
    case 5:
      blockResult = 'POW';
      break;
    case 6:
      blockResult = 'PUSH_BACK';
      break;
    default:
      blockResult = 'PUSH_BACK';
  }

  notifyBlockDiceResult(playerName, blockResult);
  return blockResult;
}

/**
 * Lance plusieurs dés de blocage avec notification
 */
export function rollBlockDiceManyWithNotification(
  rng: RNG, 
  count: number, 
  playerName: string
): BlockResult[] {
  const results: BlockResult[] = [];
  
  for (let i = 0; i < count; i++) {
    const result = rollBlockDiceWithNotification(rng, playerName);
    results.push(result);
  }
  
  return results;
}
