/**
 * Mécanique de Regard Hypnotique (Hypnotic Gaze) pour Blood Bowl
 *
 * Règles BB2020/BB3 :
 * - Le joueur doit posséder le trait "Hypnotic Gaze"
 * - La cible doit être un adversaire adjacent, debout et actif
 * - Jet d'AG (Agilité) avec un target de 2+
 * - Modificateur : -1 par zone de tacle adverse (hors cible) sur le joueur
 * - Nat 1 : toujours un échec
 * - Succès : la cible perd sa zone de tacle jusqu'à sa prochaine activation
 * - Échec : l'activation du joueur prend fin immédiatement (pas de turnover)
 */

import { GameState, Player, RNG, DiceResult } from '../core/types';
import { hasSkill } from '../skills/skill-effects';
import { rollD6 } from '../utils/dice';
import { createLogEntry } from '../utils/logging';
import { isAdjacent, getAdjacentOpponents } from './movement';

/**
 * Vérifie si un joueur peut utiliser Regard Hypnotique sur une cible
 */
export function canHypnoticGaze(
  state: GameState,
  gazer: Player,
  target: Player,
): boolean {
  // Le joueur doit avoir le trait Hypnotic Gaze
  if (!hasSkill(gazer, 'hypnotic-gaze')) return false;
  // La cible doit être un adversaire
  if (gazer.team === target.team) return false;
  // Adjacents
  if (!isAdjacent(gazer.pos, target.pos)) return false;
  // La cible doit être debout et active
  if (target.stunned) return false;
  if (target.state !== undefined && target.state !== 'active') return false;

  return true;
}

/**
 * Calcule les modificateurs du jet de Regard Hypnotique
 * -1 par adversaire en zone de tacle du joueur (hors cible)
 */
export function calculateGazeModifiers(
  state: GameState,
  gazer: Player,
  target: Player,
): number {
  // Compter les adversaires adjacents au gazer, en excluant la cible
  const adjacentOpponents = getAdjacentOpponents(state, gazer.pos, gazer.team);
  const othersCount = adjacentOpponents.filter(p => p.id !== target.id).length;
  return othersCount === 0 ? 0 : -othersCount;
}

/**
 * Exécute un Regard Hypnotique complet
 */
export function executeHypnoticGaze(
  state: GameState,
  gazer: Player,
  target: Player,
  rng: RNG,
): GameState {
  let newState = structuredClone(state) as GameState;

  // Log de l'action
  const actionLog = createLogEntry(
    'action',
    `${gazer.name} tente un Regard Hypnotique sur ${target.name}`,
    gazer.id,
    gazer.team,
  );
  newState.gameLog = [...newState.gameLog, actionLog];

  // Calcul des modificateurs et jet de dé
  const modifiers = calculateGazeModifiers(newState, gazer, target);
  const diceRoll = rollD6(rng);
  const targetNumber = Math.max(2, Math.min(6, gazer.ag - modifiers));
  const success = diceRoll >= targetNumber && diceRoll !== 1;

  const diceResult: DiceResult = {
    type: 'gaze',
    playerId: gazer.id,
    diceRoll,
    targetNumber,
    success,
    modifiers,
  };
  newState.lastDiceResult = diceResult;

  const rollLog = createLogEntry(
    'dice',
    `Jet de Regard Hypnotique de ${gazer.name}: ${diceRoll}/${targetNumber} ${success ? '✓' : '✗'}`,
    gazer.id,
    gazer.team,
    { diceRoll, targetNumber, modifiers },
  );
  newState.gameLog = [...newState.gameLog, rollLog];

  if (success) {
    // Succès : la cible perd sa zone de tacle
    const hypnotizedPlayers = [...(newState.hypnotizedPlayers ?? []), target.id];
    newState = { ...newState, hypnotizedPlayers };

    const successLog = createLogEntry(
      'action',
      `${target.name} est hypnotisé ! Il perd sa zone de tacle.`,
      target.id,
      target.team,
    );
    newState.gameLog = [...newState.gameLog, successLog];
  } else {
    // Échec : l'activation du joueur prend fin (pm = 0), PAS de turnover
    newState.players = newState.players.map(p =>
      p.id === gazer.id ? { ...p, pm: 0 } : p,
    );

    const failLog = createLogEntry(
      'action',
      `Le Regard Hypnotique de ${gazer.name} échoue ! Son activation prend fin.`,
      gazer.id,
      gazer.team,
    );
    newState.gameLog = [...newState.gameLog, failLog];
  }

  return newState;
}
