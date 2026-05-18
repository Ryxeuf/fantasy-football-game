/**
 * Système de notifications pour les jets de dés
 * Intègre les notifications toaster avec le système de dés existant.
 *
 * AUDIT round 4 — Note de dette technique
 * ----------------------------------------
 * Les callbacks sont stockes dans des variables module-level. Cela
 * pose plusieurs problemes connus mais difficile a fix sans
 * refactor invasif :
 *   - Pas de support concurrent : deux matchs en parallele dans le
 *     meme process partagent le meme callback.
 *   - Pas d'isolation entre tests : un test qui set un callback peut
 *     contaminer le suivant — d'ou le helper `resetDiceNotifications`
 *     ci-dessous a appeler en `beforeEach`.
 *   - Aucun impact sur la determinisme du sim (les callbacks ne sont
 *     PAS appeles dans le path full-driver, juste depuis l'UI demo).
 *
 * Refactor cible (pas dans ce PR) : passer le callback en argument
 * de `rollD6WithNotification` etc., ou utiliser un Context React. La
 * seule consommatrice actuelle est `DiceNotificationDemo` (sandbox UI).
 */

import { RNG, Player, DiceResult, BlockResult } from '../core/types';
import { calculateArmorTarget } from './dice';

// Type pour les callbacks de notification
export type DiceNotificationCallback = (playerName: string, diceResult: DiceResult) => void;
export type BlockDiceNotificationCallback = (playerName: string, blockResult: BlockResult) => void;

// Variables globales pour stocker les callbacks. Cf. note ci-dessus.
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
 * Audit round 4 — helper pour reset les 2 globals en `beforeEach`
 * test ou au demarrage d'un match isole. Evite les fuites de callback
 * entre suites de tests / matchs.
 */
export function resetDiceNotifications(): void {
  diceNotificationCallback = null;
  blockDiceNotificationCallback = null;
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
    type: 'block', // Utiliser 'block' comme type générique pour les dés simples
    playerId: '',
    diceRoll: result,
    targetNumber: 0,
    success: false,
    modifiers: 0,
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
    type: 'block', // Utiliser 'block' comme type générique pour les dés simples
    playerId: '',
    diceRoll: result,
    targetNumber: 0,
    success: false,
    modifiers: 0,
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
    playerId: player.id,
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
    playerId: player.id,
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
  // Armor rolls use 2D6, not 1D6
  const die1 = Math.floor(rng() * 6) + 1;
  const die2 = Math.floor(rng() * 6) + 1;
  const diceRoll = die1 + die2;
  // Target = AV + modifiers, capped at 12 (matching performArmorRoll in dice.ts)
  // calculateArmorTarget applique également le malus Stunty (-1 AV).
  const targetNumber = calculateArmorTarget(player, modifiers);
  // Armor holds (success) when roll is below target; broken when roll >= target
  const success = diceRoll < targetNumber;

  const diceResult: DiceResult = {
    type: 'armor',
    playerId: player.id,
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
