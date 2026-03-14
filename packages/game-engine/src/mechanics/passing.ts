/**
 * Mécanique de passe et remise (handoff) pour Blood Bowl
 * Gère les jets de passe, distances, interceptions et réceptions
 */

import { GameState, Player, Position, TeamId, RNG, DiceResult } from '../core/types';
import { rollD6 } from '../utils/dice';
import { samePos, isAdjacent, getAdjacentOpponents } from './movement';
import { createLogEntry } from '../utils/logging';
import { bounceBall, checkTouchdowns, isInOpponentEndzone, awardTouchdown } from './ball';

/**
 * Distances de passe selon BB2020
 */
export type PassRange = 'quick' | 'short' | 'long' | 'bomb';

/**
 * Calcule la distance entre deux positions (distance de Chebyshev)
 */
export function getDistance(from: Position, to: Position): number {
  return Math.max(Math.abs(from.x - to.x), Math.abs(from.y - to.y));
}

/**
 * Détermine la catégorie de distance de passe
 */
export function getPassRange(from: Position, to: Position): PassRange | null {
  const dist = getDistance(from, to);
  if (dist <= 3) return 'quick';
  if (dist <= 6) return 'short';
  if (dist <= 10) return 'long';
  if (dist <= 13) return 'bomb';
  return null; // Hors de portée
}

/**
 * Modificateur de distance pour le jet de passe
 */
export function getPassRangeModifier(range: PassRange): number {
  switch (range) {
    case 'quick': return 1;
    case 'short': return 0;
    case 'long': return -1;
    case 'bomb': return -2;
  }
}

/**
 * Calcule les modificateurs de passe
 */
export function calculatePassModifiers(
  state: GameState,
  passer: Player,
  targetPos: Position
): number {
  let modifiers = 0;

  // Modificateur de distance
  const range = getPassRange(passer.pos, targetPos);
  if (range) {
    modifiers += getPassRangeModifier(range);
  }

  // Malus pour chaque adversaire en zone de tacle du passeur
  const opponentsNearPasser = getAdjacentOpponents(state, passer.pos, passer.team);
  modifiers -= opponentsNearPasser.length;

  return modifiers;
}

/**
 * Effectue un jet de passe
 */
export function performPassRoll(passer: Player, rng: RNG, modifiers: number): DiceResult {
  const diceRoll = rollD6(rng);
  // PA (Passing Ability) est le target de base, ajusté par les modificateurs
  const targetNumber = Math.max(2, Math.min(6, passer.pa - modifiers));
  const success = diceRoll >= targetNumber;

  return {
    type: 'pass',
    playerId: passer.id,
    diceRoll,
    targetNumber,
    success,
    modifiers,
  };
}

/**
 * Calcule les modificateurs de réception
 */
export function calculateCatchModifiers(
  state: GameState,
  catcher: Player
): number {
  let modifiers = 0;

  // Malus pour chaque adversaire en zone de tacle du receveur
  const opponentsNearCatcher = getAdjacentOpponents(state, catcher.pos, catcher.team);
  modifiers -= opponentsNearCatcher.length;

  return modifiers;
}

/**
 * Effectue un jet de réception
 */
export function performCatchRoll(catcher: Player, rng: RNG, modifiers: number): DiceResult {
  const diceRoll = rollD6(rng);
  const targetNumber = Math.max(2, Math.min(6, catcher.ag - modifiers));
  const success = diceRoll >= targetNumber;

  return {
    type: 'catch',
    playerId: catcher.id,
    diceRoll,
    targetNumber,
    success,
    modifiers,
  };
}

/**
 * Trouve les joueurs adverses pouvant tenter une interception
 * Un joueur peut intercepter s'il est sur la trajectoire du ballon (cases traversées)
 */
export function findInterceptors(
  state: GameState,
  from: Position,
  to: Position,
  passingTeam: TeamId
): Player[] {
  const interceptors: Player[] = [];

  // Les adversaires adjacents aux cases traversées par le ballon (Bresenham simplifié)
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));

  if (steps === 0) return [];

  const visited = new Set<string>();
  visited.add(`${from.x},${from.y}`);
  visited.add(`${to.x},${to.y}`);

  for (let i = 1; i < steps; i++) {
    const x = Math.round(from.x + (dx * i) / steps);
    const y = Math.round(from.y + (dy * i) / steps);
    visited.add(`${x},${y}`);
  }

  // Chercher les adversaires debout sur les cases traversées (pas from/to)
  for (const player of state.players) {
    if (player.team === passingTeam) continue;
    if (player.stunned || player.state === 'knocked_out' || player.state === 'casualty') continue;
    if (samePos(player.pos, from) || samePos(player.pos, to)) continue;

    const key = `${player.pos.x},${player.pos.y}`;
    if (visited.has(key)) {
      interceptors.push(player);
    }
  }

  return interceptors;
}

/**
 * Effectue un jet d'interception (AG du joueur, -2 de base)
 */
export function performInterceptionRoll(interceptor: Player, rng: RNG): DiceResult {
  const diceRoll = rollD6(rng);
  const targetNumber = Math.max(2, Math.min(6, interceptor.ag + 2)); // Plus difficile : AG + 2
  const success = diceRoll >= targetNumber;

  return {
    type: 'catch',
    playerId: interceptor.id,
    diceRoll,
    targetNumber,
    success,
    modifiers: -2,
  };
}

/**
 * Exécute une passe complète
 */
export function executePass(
  state: GameState,
  passer: Player,
  target: Player,
  rng: RNG
): GameState {
  let newState = structuredClone(state) as GameState;

  // Retirer le ballon du passeur
  newState.players = newState.players.map(p =>
    p.id === passer.id ? { ...p, hasBall: false } : p
  );
  newState.ball = undefined;

  // Vérifier les interceptions
  const interceptors = findInterceptors(newState, passer.pos, target.pos, passer.team);
  for (const interceptor of interceptors) {
    const interceptResult = performInterceptionRoll(interceptor, rng);

    const interceptLog = createLogEntry(
      'dice',
      `Tentative d'interception de ${interceptor.name}: ${interceptResult.diceRoll}/${interceptResult.targetNumber} ${interceptResult.success ? '✓' : '✗'}`,
      interceptor.id,
      interceptor.team,
      { diceRoll: interceptResult.diceRoll, targetNumber: interceptResult.targetNumber }
    );
    newState.gameLog = [...newState.gameLog, interceptLog];

    if (interceptResult.success) {
      // Interception réussie !
      newState.players = newState.players.map(p =>
        p.id === interceptor.id ? { ...p, hasBall: true } : p
      );

      // Tracker la stat d'interception
      if (!newState.matchStats[interceptor.id]) {
        newState.matchStats[interceptor.id] = { touchdowns: 0, casualties: 0, completions: 0, interceptions: 0, mvp: false };
      }
      newState.matchStats[interceptor.id].interceptions += 1;

      const interceptSuccessLog = createLogEntry(
        'turnover',
        `Interception par ${interceptor.name} ! Turnover !`,
        interceptor.id,
        interceptor.team
      );
      newState.gameLog = [...newState.gameLog, interceptSuccessLog];
      newState.isTurnover = true;

      return checkTouchdowns(newState);
    }
  }

  // Jet de passe
  const passModifiers = calculatePassModifiers(newState, passer, target.pos);
  const passResult = performPassRoll(passer, rng, passModifiers);

  newState.lastDiceResult = passResult;

  const passLog = createLogEntry(
    'dice',
    `Jet de passe de ${passer.name}: ${passResult.diceRoll}/${passResult.targetNumber} ${passResult.success ? '✓' : '✗'}`,
    passer.id,
    passer.team,
    { diceRoll: passResult.diceRoll, targetNumber: passResult.targetNumber, modifiers: passModifiers }
  );
  newState.gameLog = [...newState.gameLog, passLog];

  if (!passResult.success) {
    // Passe ratée : le ballon dévie depuis la cible
    const failLog = createLogEntry(
      'turnover',
      `Passe ratée - Turnover !`,
      passer.id,
      passer.team
    );
    newState.gameLog = [...newState.gameLog, failLog];
    newState.isTurnover = true;
    newState.ball = { ...target.pos };
    return bounceBall(newState, rng);
  }

  // Passe réussie : le receveur doit réceptionner
  const catchModifiers = calculateCatchModifiers(newState, target);
  const catchResult = performCatchRoll(target, rng, catchModifiers);

  const catchLog = createLogEntry(
    'dice',
    `Jet de réception de ${target.name}: ${catchResult.diceRoll}/${catchResult.targetNumber} ${catchResult.success ? '✓' : '✗'}`,
    target.id,
    target.team,
    { diceRoll: catchResult.diceRoll, targetNumber: catchResult.targetNumber }
  );
  newState.gameLog = [...newState.gameLog, catchLog];

  if (catchResult.success) {
    // Réception réussie
    newState.players = newState.players.map(p =>
      p.id === target.id ? { ...p, hasBall: true } : p
    );

    // Tracker la complétion pour le passeur
    if (!newState.matchStats[passer.id]) {
      newState.matchStats[passer.id] = { touchdowns: 0, casualties: 0, completions: 0, interceptions: 0, mvp: false };
    }
    newState.matchStats[passer.id].completions += 1;

    const successLog = createLogEntry(
      'action',
      `Passe réussie de ${passer.name} à ${target.name}`,
      passer.id,
      passer.team
    );
    newState.gameLog = [...newState.gameLog, successLog];

    // Vérifier touchdown
    const receiver = newState.players.find(p => p.id === target.id)!;
    if (isInOpponentEndzone(newState, receiver)) {
      return awardTouchdown(newState, receiver.team, receiver);
    }

    return newState;
  } else {
    // Réception ratée : turnover, le ballon rebondit
    const failCatchLog = createLogEntry(
      'turnover',
      `Réception ratée par ${target.name} - Turnover !`,
      target.id,
      target.team
    );
    newState.gameLog = [...newState.gameLog, failCatchLog];
    newState.isTurnover = true;
    newState.ball = { ...target.pos };
    return bounceBall(newState, rng);
  }
}

/**
 * Exécute un handoff (remise)
 * Pas de jet de passe, seulement un jet de réception
 */
export function executeHandoff(
  state: GameState,
  passer: Player,
  target: Player,
  rng: RNG
): GameState {
  let newState = structuredClone(state) as GameState;

  // Retirer le ballon du passeur
  newState.players = newState.players.map(p =>
    p.id === passer.id ? { ...p, hasBall: false } : p
  );
  newState.ball = undefined;

  const handoffLog = createLogEntry(
    'action',
    `${passer.name} tente une remise à ${target.name}`,
    passer.id,
    passer.team
  );
  newState.gameLog = [...newState.gameLog, handoffLog];

  // Jet de réception pour le receveur
  const catchModifiers = calculateCatchModifiers(newState, target);
  const catchResult = performCatchRoll(target, rng, catchModifiers);

  newState.lastDiceResult = catchResult;

  const catchLog = createLogEntry(
    'dice',
    `Jet de réception de ${target.name}: ${catchResult.diceRoll}/${catchResult.targetNumber} ${catchResult.success ? '✓' : '✗'}`,
    target.id,
    target.team,
    { diceRoll: catchResult.diceRoll, targetNumber: catchResult.targetNumber }
  );
  newState.gameLog = [...newState.gameLog, catchLog];

  if (catchResult.success) {
    // Réception réussie
    newState.players = newState.players.map(p =>
      p.id === target.id ? { ...p, hasBall: true } : p
    );

    const successLog = createLogEntry(
      'action',
      `Remise réussie de ${passer.name} à ${target.name}`,
      passer.id,
      passer.team
    );
    newState.gameLog = [...newState.gameLog, successLog];

    // Vérifier touchdown
    const receiver = newState.players.find(p => p.id === target.id)!;
    if (isInOpponentEndzone(newState, receiver)) {
      return awardTouchdown(newState, receiver.team, receiver);
    }

    return newState;
  } else {
    // Réception ratée : turnover, le ballon rebondit
    const failLog = createLogEntry(
      'turnover',
      `Remise ratée - ${target.name} échappe le ballon - Turnover !`,
      target.id,
      target.team
    );
    newState.gameLog = [...newState.gameLog, failLog];
    newState.isTurnover = true;
    newState.ball = { ...target.pos };
    return bounceBall(newState, rng);
  }
}
