/**
 * Mécanique de passe et remise (handoff) pour Blood Bowl
 * Gère les jets de passe, distances, interceptions et réceptions
 */

import { GameState, Player, Position, TeamId, RNG, DiceResult } from '../core/types';
import { rollD6 } from '../utils/dice';
import { samePos, isAdjacent, getAdjacentOpponents } from './movement';
import { createLogEntry } from '../utils/logging';
import { bounceBall, checkTouchdowns, isInOpponentEndzone, awardTouchdown } from './ball';
import { hasSkill } from '../skills/skill-effects';
import { getDisturbingPresenceModifier } from './disturbing-presence';

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
 * Détermine si un joueur peut tenter une passe sur une distance donnée.
 * Les joueurs Stunty ne peuvent pas tenter de passes Long ni Long Bomb :
 * l'action est restreinte aux portées Quick et Short.
 * Les joueurs avec Hail Mary Pass peuvent viser n'importe quelle case du
 * terrain (la règle de portée est ignorée, même au-delà de Long Bomb).
 */
export function canAttemptPassForRange(passer: Player, range: PassRange | null): boolean {
  if (!range) {
    return hasSkill(passer, 'hail-mary-pass') || hasSkill(passer, 'hail_mary_pass');
  }
  if (hasSkill(passer, 'stunty') && (range === 'long' || range === 'bomb')) {
    return false;
  }
  return true;
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

  // Accurate (O.1 batch 3b) : +1 sur Quick et Short.
  if (
    range &&
    (range === 'quick' || range === 'short') &&
    (passer.skills.includes('accurate') || passer.skills.includes('Accurate'))
  ) {
    modifiers += 1;
  }

  // Strong Arm (O.1 batch 3b) : +1 sur Short, Long et Bomb.
  if (
    range &&
    (range === 'short' || range === 'long' || range === 'bomb') &&
    (passer.skills.includes('strong-arm') ||
      passer.skills.includes('strong_arm') ||
      passer.skills.includes('Strong Arm'))
  ) {
    modifiers += 1;
  }

  // Malus pour chaque adversaire en zone de tacle du passeur.
  // Nerves of Steel (O.1 batch 3) annule ce malus.
  const opponentsNearPasser = getAdjacentOpponents(state, passer.pos, passer.team);
  const hasNervesOfSteel =
    passer.skills.includes('nerves-of-steel') ||
    passer.skills.includes('nerves_of_steel');
  if (!hasNervesOfSteel) {
    modifiers -= opponentsNearPasser.length;
  }

  // Disturbing Presence : -1 par adversaire avec le skill a <= 3 cases
  modifiers += getDisturbingPresenceModifier(state, passer.pos, passer.team);

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

  // Malus pour chaque adversaire en zone de tacle du receveur.
  // Nerves of Steel (O.1 batch 3) annule ce malus.
  const opponentsNearCatcher = getAdjacentOpponents(state, catcher.pos, catcher.team);
  const hasNervesOfSteel =
    catcher.skills.includes('nerves-of-steel') ||
    catcher.skills.includes('nerves_of_steel');
  if (!hasNervesOfSteel) {
    modifiers -= opponentsNearCatcher.length;
  }

  // Extra Arms (O.1 batch 3) : +1 au jet de reception.
  if (
    catcher.skills.includes('extra-arms') ||
    catcher.skills.includes('extra_arms')
  ) {
    modifiers += 1;
  }

  // Diving Catch (O.1 batch 3d) : +1 au jet de reception du ballon.
  // Note : l'effet "peut receptionner sur une case adjacente" n'est pas
  // encore implemente (deviation/scatter vers une case voisine suite a une
  // passe ratee).
  if (
    catcher.skills.includes('diving-catch') ||
    catcher.skills.includes('diving_catch')
  ) {
    modifiers += 1;
  }

  // Disturbing Presence : -1 par adversaire avec le skill a <= 3 cases
  modifiers += getDisturbingPresenceModifier(state, catcher.pos, catcher.team);

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
 * Effectue un jet d'interception (AG du joueur, -2 de base).
 * Applique egalement le malus Disturbing Presence (-1 par adversaire avec
 * le skill a <= 3 cases de l'intercepteur).
 */
export function performInterceptionRoll(
  interceptor: Player,
  rng: RNG,
  state?: GameState,
): DiceResult {
  const diceRoll = rollD6(rng);
  const dpModifier = state
    ? getDisturbingPresenceModifier(state, interceptor.pos, interceptor.team)
    : 0;
  // Total modifier = -2 (interception de base) + DP (negatif ou nul)
  const totalModifier = -2 + dpModifier;
  // targetNumber base = interceptor.ag - totalModifier (un modificateur negatif augmente le target)
  const targetNumber = Math.max(2, Math.min(6, interceptor.ag - totalModifier));
  const success = diceRoll >= targetNumber;

  return {
    type: 'catch',
    playerId: interceptor.id,
    diceRoll,
    targetNumber,
    success,
    modifiers: totalModifier,
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
  const newState = structuredClone(state) as GameState;

  // Retirer le ballon du passeur
  newState.players = newState.players.map(p =>
    p.id === passer.id ? { ...p, hasBall: false } : p
  );
  newState.ball = undefined;

  // Vérifier les interceptions
  const interceptors = findInterceptors(newState, passer.pos, target.pos, passer.team);
  for (const interceptor of interceptors) {
    const interceptResult = performInterceptionRoll(interceptor, rng, newState);

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
    // Safe Pass : sur echec, le passeur garde le ballon. Pas de turnover,
    // pas de rebond, l'activation se termine (geree par handlePass via
    // setPlayerAction + checkPlayerTurnEnd).
    if (hasSkill(passer, 'safe-pass') || hasSkill(passer, 'safe_pass')) {
      newState.players = newState.players.map(p =>
        p.id === passer.id ? { ...p, hasBall: true } : p
      );
      newState.ball = undefined;
      const safePassLog = createLogEntry(
        'info',
        `Passe Assuree : ${passer.name} garde possession du ballon.`,
        passer.id,
        passer.team,
        { skill: 'safe-pass' }
      );
      newState.gameLog = [...newState.gameLog, safePassLog];
      return newState;
    }

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

  // Hail Mary Pass : la passe n'est jamais precise. Meme sur un jet reussi,
  // le ballon ne va pas directement dans les mains du receveur. Il devie depuis
  // la case cible, sans turnover (le receveur ou un autre joueur peut tenter
  // de le rattraper via le rebond).
  if (hasSkill(passer, 'hail-mary-pass') || hasSkill(passer, 'hail_mary_pass')) {
    const hmpLog = createLogEntry(
      'info',
      `Passe Desesperee : la passe n'est jamais precise, le ballon devie depuis la cible.`,
      passer.id,
      passer.team,
      { skill: 'hail-mary-pass' }
    );
    newState.gameLog = [...newState.gameLog, hmpLog];
    newState.ball = { ...target.pos };
    return bounceBall(newState, rng);
  }

  // No Hands: receiver cannot catch the ball (no roll)
  if (hasSkill(target, 'no-hands')) {
    const noHandsLog = createLogEntry(
      'info',
      `Sans Ballon: ${target.name} ne peut pas réceptionner le ballon !`,
      target.id,
      target.team,
      { skill: 'no-hands' }
    );
    const failLog = createLogEntry(
      'turnover',
      `Réception impossible (Sans Ballon) - Turnover !`,
      target.id,
      target.team
    );
    newState.gameLog = [...newState.gameLog, noHandsLog, failLog];
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
  const newState = structuredClone(state) as GameState;

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

  // No Hands: receiver cannot catch the ball (no roll)
  if (hasSkill(target, 'no-hands')) {
    const noHandsLog = createLogEntry(
      'info',
      `Sans Ballon: ${target.name} ne peut pas réceptionner le ballon !`,
      target.id,
      target.team,
      { skill: 'no-hands' }
    );
    const failLog = createLogEntry(
      'turnover',
      `Remise impossible (Sans Ballon) - Turnover !`,
      target.id,
      target.team
    );
    newState.gameLog = [...newState.gameLog, noHandsLog, failLog];
    newState.isTurnover = true;
    newState.ball = { ...target.pos };
    return bounceBall(newState, rng);
  }

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
