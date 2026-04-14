/**
 * Mécanique de Tronçonneuse (Chainsaw) pour Blood Bowl — BB3 Season 2/3.
 *
 * Règles :
 * - Le joueur doit posséder le trait "Chainsaw" (Secret Weapon).
 * - Action spéciale remplaçant un Blocage : cible adjacente (adversaire
 *   debout et actif).
 * - Aucun dé de bloc n'est lancé ni assistance de Force appliquée.
 * - Jet d'armure direct (2D6) contre la cible avec un modificateur de +3
 *   (on soustrait 3 au "target number" de l'armure).
 * - Si l'armure est percée → jet de blessure. Mighty Blow ne s'applique PAS
 *   (ni à l'armure, ni à la blessure).
 * - La cible n'est PAS mise à terre par le jet lui-même (reste debout si
 *   l'armure tient ou si la blessure n'aboutit qu'à un état "stunned").
 * - Un double 1 "naturel" (avant modificateurs) sur le jet d'armure signifie
 *   que la tronçonneuse touche son utilisateur : jet d'armure sur le joueur
 *   à +3, suivi d'un jet de blessure si l'armure est percée, et TURNOVER.
 * - Hors auto-blessure, Chainsaw ne provoque PAS de turnover.
 * - L'activation du Chainsawyer prend fin immédiatement après l'action
 *   (pm = 0).
 */

import { GameState, Player, RNG, DiceResult } from '../core/types';
import { hasSkill } from '../skills/skill-effects';
import { rollD6, calculateArmorTarget } from '../utils/dice';
import { performInjuryRoll } from './injury';
import { createLogEntry } from '../utils/logging';
import { isAdjacent } from './movement';

const CHAINSAW_ARMOR_BONUS = 3;

/**
 * Indique si un joueur peut utiliser Chainsaw sur une cible donnée.
 */
export function canChainsaw(
  state: GameState,
  attacker: Player,
  target: Player,
): boolean {
  if (!hasSkill(attacker, 'chainsaw')) return false;
  if (attacker.team === target.team) return false;
  if (!isAdjacent(attacker.pos, target.pos)) return false;
  if (target.stunned) return false;
  if (target.state !== undefined && target.state !== 'active') return false;
  return true;
}

/**
 * Construit un DiceResult de type 'armor' à partir de deux dés explicites.
 * - `bonus` positif s'ajoute à la somme des dés (+3 pour le modificateur chainsaw).
 * - On conserve la convention existante : `modifiers = -bonus`, cible = av + modifiers
 *   (c.-à-d. av - bonus), dé brut (non modifié) dans `diceRoll`, et
 *   `success = true` signifie "armure tient".
 */
function buildArmorResult(
  player: Player,
  die1: number,
  die2: number,
  bonus: number,
): DiceResult {
  const modifiers = -bonus;
  const targetNumber = calculateArmorTarget(player, modifiers);
  const diceRoll = die1 + die2;
  const success = diceRoll < targetNumber;
  return {
    type: 'armor',
    playerId: player.id,
    diceRoll,
    targetNumber,
    success,
    modifiers,
  };
}

/**
 * Exécute une action Chainsaw : jet d'armure direct avec +3.
 */
export function executeChainsaw(
  state: GameState,
  attacker: Player,
  target: Player,
  rng: RNG,
): GameState {
  let newState = structuredClone(state) as GameState;

  // Log d'action
  const actionLog = createLogEntry(
    'action',
    `${attacker.name} attaque ${target.name} à la tronçonneuse !`,
    attacker.id,
    attacker.team,
  );
  newState.gameLog = [...newState.gameLog, actionLog];

  // Jet 2D6 explicite pour détecter le double 1 naturel.
  const die1 = rollD6(rng);
  const die2 = rollD6(rng);
  const naturalDoubleOne = die1 === 1 && die2 === 1;

  if (naturalDoubleOne) {
    // La tronçonneuse rebondit sur son utilisateur.
    const selfHitLog = createLogEntry(
      'action',
      `Double 1 ! La tronçonneuse échappe et frappe ${attacker.name} !`,
      attacker.id,
      attacker.team,
    );
    newState.gameLog = [...newState.gameLog, selfHitLog];

    // Jet d'armure sur l'attaquant avec +3.
    const selfDie1 = rollD6(rng);
    const selfDie2 = rollD6(rng);
    const selfArmor = buildArmorResult(attacker, selfDie1, selfDie2, CHAINSAW_ARMOR_BONUS);
    newState.lastDiceResult = selfArmor;

    const armorLog = createLogEntry(
      'dice',
      `Jet d'armure de ${attacker.name}: ${selfDie1 + selfDie2}+${CHAINSAW_ARMOR_BONUS} vs ${attacker.av} ${selfArmor.success ? '(tient)' : '(percée)'}`,
      attacker.id,
      attacker.team,
      { diceRoll: selfArmor.diceRoll, targetNumber: selfArmor.targetNumber, chainsawBonus: CHAINSAW_ARMOR_BONUS },
    );
    newState.gameLog = [...newState.gameLog, armorLog];

    if (!selfArmor.success) {
      const currentAttacker = newState.players.find(p => p.id === attacker.id);
      if (currentAttacker) {
        newState = performInjuryRoll(newState, currentAttacker, rng, 0, attacker.id);
      }
    }

    // Turnover systématique sur auto-blessure à la tronçonneuse.
    newState.isTurnover = true;
  } else {
    // Jet d'armure sur la cible avec +3 (pas de Mighty Blow).
    const armorResult = buildArmorResult(target, die1, die2, CHAINSAW_ARMOR_BONUS);
    newState.lastDiceResult = armorResult;

    const armorLog = createLogEntry(
      'dice',
      `Jet d'armure de ${target.name}: ${die1 + die2}+${CHAINSAW_ARMOR_BONUS} vs ${target.av} ${armorResult.success ? '(tient)' : '(percée)'}`,
      target.id,
      target.team,
      { diceRoll: armorResult.diceRoll, targetNumber: armorResult.targetNumber, chainsawBonus: CHAINSAW_ARMOR_BONUS },
    );
    newState.gameLog = [...newState.gameLog, armorLog];

    if (!armorResult.success) {
      const currentTarget = newState.players.find(p => p.id === target.id);
      if (currentTarget) {
        newState = performInjuryRoll(newState, currentTarget, rng, 0, attacker.id);
      }
    }
  }

  // L'activation de l'attaquant prend fin.
  newState.players = newState.players.map(p =>
    p.id === attacker.id ? { ...p, pm: 0 } : p,
  );

  return newState;
}
