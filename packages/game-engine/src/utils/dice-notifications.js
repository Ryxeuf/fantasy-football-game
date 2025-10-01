/**
 * Système de notifications pour les jets de dés
 * Intègre les notifications toaster avec le système de dés existant
 */
// Variables globales pour stocker les callbacks
let diceNotificationCallback = null;
let blockDiceNotificationCallback = null;
/**
 * Enregistre un callback pour les notifications de dés
 */
export function setDiceNotificationCallback(callback) {
    diceNotificationCallback = callback;
}
/**
 * Enregistre un callback pour les notifications de dés de blocage
 */
export function setBlockDiceNotificationCallback(callback) {
    blockDiceNotificationCallback = callback;
}
/**
 * Notifie le résultat d'un jet de dés
 */
function notifyDiceResult(playerName, diceResult) {
    if (diceNotificationCallback) {
        diceNotificationCallback(playerName, diceResult);
    }
}
/**
 * Notifie le résultat d'un dé de blocage
 */
function notifyBlockDiceResult(playerName, blockResult) {
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
export function rollD6WithNotification(rng, playerName) {
    const result = Math.floor(rng() * 6) + 1;
    // Créer un DiceResult simple pour la notification
    const diceResult = {
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
export function roll2D6WithNotification(rng, playerName) {
    const die1 = Math.floor(rng() * 6) + 1;
    const die2 = Math.floor(rng() * 6) + 1;
    const result = die1 + die2;
    // Créer un DiceResult pour la notification
    const diceResult = {
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
export function performDodgeRollWithNotification(player, rng, modifiers = 0) {
    const diceRoll = Math.floor(rng() * 6) + 1;
    const targetNumber = Math.max(2, Math.min(6, player.ag - modifiers));
    const success = diceRoll >= targetNumber;
    const diceResult = {
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
export function performPickupRollWithNotification(player, rng, modifiers = 0) {
    const diceRoll = Math.floor(rng() * 6) + 1;
    const targetNumber = Math.max(2, Math.min(6, player.ag - modifiers));
    const success = diceRoll >= targetNumber;
    const diceResult = {
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
export function performArmorRollWithNotification(player, rng, modifiers = 0) {
    const diceRoll = Math.floor(rng() * 6) + 1;
    const targetNumber = Math.max(2, Math.min(6, player.av - modifiers));
    const success = diceRoll >= targetNumber;
    const diceResult = {
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
export function rollBlockDiceWithNotification(rng, playerName) {
    const roll = Math.floor(rng() * 6) + 1;
    let blockResult;
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
export function rollBlockDiceManyWithNotification(rng, count, playerName) {
    const results = [];
    for (let i = 0; i < count; i++) {
        const result = rollBlockDiceWithNotification(rng, playerName);
        results.push(result);
    }
    return results;
}
