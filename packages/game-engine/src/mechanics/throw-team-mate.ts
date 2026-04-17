/**
 * Mécanique de Lancer de Coéquipier (Throw Team-Mate) pour Blood Bowl
 *
 * Règles BB2020/BB3 :
 * - Le lanceur doit posséder le trait "Throw Team-Mate"
 * - Le coéquipier lancé doit posséder le trait "Right Stuff" et être adjacent
 * - Portée max : Long Pass (distance ≤ 10), pas de Bomb
 * - Jet de passe (PA) avec modificateurs de distance et zones de tacle
 * - Fumble (nat 1) : le lancé est déposé et les deux tombent, Turnover
 * - Passe ratée (pas fumble) : le lancé dévie 3 fois depuis la cible
 * - Passe réussie : le lancé dévie 1 fois depuis la cible
 * - Atterrissage : jet d'AG, échec = chute + jet d'armure
 * - Stunty donne +1 au jet de passe
 */

import { GameState, Player, Position, RNG, DiceResult } from '../core/types';
import { hasSkill } from '../skills/skill-effects';
import { rollD6 } from '../utils/dice';
import { createLogEntry } from '../utils/logging';
import { isAdjacent, inBounds, samePos } from './movement';
import { getRandomDirection, bounceBall, checkTouchdowns, isInOpponentEndzone, awardTouchdown } from './ball';
import { performInjuryRoll } from './injury';
import { getDistance, getPassRangeModifier } from './passing';
import { getAdjacentOpponents } from './movement';
import { checkAlwaysHungry } from './negative-traits';
import { getDisturbingPresenceModifier } from './disturbing-presence';

export type ThrowRange = 'quick' | 'short' | 'long';

/**
 * Détermine la catégorie de distance de lancer pour TTM (pas de Bomb)
 */
export function getThrowRange(from: Position, to: Position): ThrowRange | null {
  const dist = getDistance(from, to);
  if (dist <= 3) return 'quick';
  if (dist <= 6) return 'short';
  if (dist <= 10) return 'long';
  return null; // Hors de portée (pas de Bomb pour TTM)
}

/**
 * Vérifie si un joueur peut lancer un coéquipier
 */
export function canThrowTeamMate(
  state: GameState,
  thrower: Player,
  thrown: Player,
): boolean {
  // Le lanceur doit avoir le trait TTM
  if (!hasSkill(thrower, 'throw-team-mate')) return false;
  // Le lancé doit avoir le trait Right Stuff ET une Force ≤ 3 (BB2020)
  if (!hasSkill(thrown, 'right-stuff')) return false;
  if (thrown.st > 3) return false;
  // Même équipe
  if (thrower.team !== thrown.team) return false;
  // Adjacents
  if (!isAdjacent(thrower.pos, thrown.pos)) return false;
  // Le lancé doit être debout et actif
  if (thrown.stunned || (thrown.state !== undefined && thrown.state !== 'active')) return false;

  return true;
}

/**
 * Calcule les modificateurs du jet de passe pour TTM
 */
function calculateThrowModifiers(
  state: GameState,
  thrower: Player,
  thrown: Player,
  targetPos: Position,
): number {
  let modifiers = 0;

  // Modificateur de distance
  const range = getThrowRange(thrower.pos, targetPos);
  if (range) {
    modifiers += getPassRangeModifier(range);
  }

  // Malus pour chaque adversaire en zone de tacle du lanceur
  const opponentsNearThrower = getAdjacentOpponents(state, thrower.pos, thrower.team);
  modifiers -= opponentsNearThrower.length;

  // Bonus Stunty : +1 si le lancé a Stunty (plus facile à lancer)
  if (hasSkill(thrown, 'stunty')) {
    modifiers += 1;
  }

  // Disturbing Presence : -1 par adversaire avec le skill a <= 3 cases du lanceur
  modifiers += getDisturbingPresenceModifier(state, thrower.pos, thrower.team);

  return modifiers;
}

/**
 * Effectue un jet de lancer (PA du lanceur)
 */
function performThrowRoll(thrower: Player, rng: RNG, modifiers: number): DiceResult & { naturalRoll: number } {
  const diceRoll = rollD6(rng);
  const targetNumber = Math.max(2, Math.min(6, thrower.pa - modifiers));
  const success = diceRoll >= targetNumber && diceRoll !== 1; // Natural 1 is always a fumble

  return {
    type: 'pass',
    playerId: thrower.id,
    diceRoll,
    targetNumber,
    success,
    modifiers,
    naturalRoll: diceRoll,
  };
}

/**
 * Effectue un jet d'atterrissage (AG du joueur lancé)
 */
function performLandingRoll(
  state: GameState,
  player: Player,
  landingPos: Position,
  rng: RNG,
): DiceResult {
  const diceRoll = rollD6(rng);

  // Modificateurs d'atterrissage
  let modifiers = 0;

  // Malus pour chaque adversaire en zone de tacle de la position d'atterrissage
  const opponentsNearLanding = getAdjacentOpponents(state, landingPos, player.team);
  modifiers -= opponentsNearLanding.length;

  // Bonus Stunty pour l'atterrissage
  if (hasSkill(player, 'stunty')) {
    modifiers += 1;
  }

  const targetNumber = Math.max(2, Math.min(6, player.ag - modifiers));
  const success = diceRoll >= targetNumber;

  return {
    type: 'landing',
    playerId: player.id,
    diceRoll,
    targetNumber,
    success,
    modifiers,
  };
}

/**
 * Applique les scatters à une position
 */
function applyScatters(
  state: GameState,
  startPos: Position,
  count: number,
  rng: RNG,
): Position {
  let pos = { ...startPos };
  for (let i = 0; i < count; i++) {
    const dir = getRandomDirection(rng);
    pos = {
      x: pos.x + dir.x,
      y: pos.y + dir.y,
    };
  }
  return pos;
}

/**
 * Exécute un Lancer de Coéquipier complet
 */
export function executeThrowTeamMate(
  state: GameState,
  thrower: Player,
  thrown: Player,
  targetPos: Position,
  rng: RNG,
): GameState {
  let newState = structuredClone(state) as GameState;

  // Log de l'action
  const actionLog = createLogEntry(
    'action',
    `${thrower.name} tente un Lancer de Coéquipier sur ${thrown.name}`,
    thrower.id,
    thrower.team,
  );
  newState.gameLog = [...newState.gameLog, actionLog];

  // --- Always Hungry: test d'appétit avant le lancer ---
  // Si le lanceur a le trait, il peut avaler son coéquipier au lieu de le lancer.
  const currentThrower = newState.players.find(p => p.id === thrower.id)!;
  const currentThrown = newState.players.find(p => p.id === thrown.id)!;
  const hungryResult = checkAlwaysHungry(newState, currentThrower, currentThrown, rng);
  newState = hungryResult.newState;
  if (!hungryResult.passed) {
    // Le TTM est annulé (coéquipier mangé ou s'est échappé) — turnover géré par checkAlwaysHungry
    return checkTouchdowns(newState);
  }

  // --- Jet de passe ---
  const throwModifiers = calculateThrowModifiers(newState, thrower, thrown, targetPos);
  const throwResult = performThrowRoll(thrower, rng, throwModifiers);
  newState.lastDiceResult = throwResult;

  const throwLog = createLogEntry(
    'dice',
    `Jet de lancer de ${thrower.name}: ${throwResult.diceRoll}/${throwResult.targetNumber} ${throwResult.success ? '✓' : '✗'}`,
    thrower.id,
    thrower.team,
    { diceRoll: throwResult.diceRoll, targetNumber: throwResult.targetNumber, modifiers: throwModifiers },
  );
  newState.gameLog = [...newState.gameLog, throwLog];

  // --- Fumble (natural 1) ---
  if (throwResult.naturalRoll === 1) {
    const fumbleLog = createLogEntry(
      'turnover',
      `Fumble ! ${thrower.name} laisse tomber ${thrown.name} - Turnover !`,
      thrower.id,
      thrower.team,
    );
    newState.gameLog = [...newState.gameLog, fumbleLog];
    newState.isTurnover = true;

    // Both players are knocked down — thrower stays in place, thrown stays in place
    newState.players = newState.players.map(p => {
      if (p.id === thrower.id) return { ...p, stunned: true };
      if (p.id === thrown.id) return { ...p, stunned: true };
      return p;
    });

    // If thrown player had ball, it bounces
    const thrownPlayer = newState.players.find(p => p.id === thrown.id)!;
    if (thrownPlayer.hasBall) {
      newState.players = newState.players.map(p =>
        p.id === thrown.id ? { ...p, hasBall: false } : p,
      );
      newState.ball = { ...thrownPlayer.pos };
      newState = bounceBall(newState, rng);
    }

    return newState;
  }

  // --- Determine scatter count ---
  const scatterCount = throwResult.success ? 1 : 3;

  if (!throwResult.success) {
    const inaccurateLog = createLogEntry(
      'action',
      `Lancer imprécis ! ${thrown.name} dévie de 3 cases`,
      thrower.id,
      thrower.team,
    );
    newState.gameLog = [...newState.gameLog, inaccurateLog];
  }

  // --- Scatter from target position ---
  const landingPos = applyScatters(newState, targetPos, scatterCount, rng);

  // --- Check if landing position is valid ---
  const isOutOfBounds = !inBounds(newState, landingPos);
  const occupiedBy = !isOutOfBounds
    ? newState.players.find(p => samePos(p.pos, landingPos) && p.id !== thrown.id)
    : null;

  // --- Out of bounds: crowd injury ---
  if (isOutOfBounds) {
    const oobLog = createLogEntry(
      'action',
      `${thrown.name} est lancé hors du terrain ! Blessure par la foule !`,
      thrown.id,
      thrown.team,
    );
    newState.gameLog = [...newState.gameLog, oobLog];

    // Remove thrown player from field (crowd injury)
    if (newState.players.find(p => p.id === thrown.id)?.hasBall) {
      newState.players = newState.players.map(p =>
        p.id === thrown.id ? { ...p, hasBall: false } : p,
      );
      // Ball placed at edge of field before crowd push
      const edgePos = {
        x: Math.max(0, Math.min(newState.width - 1, landingPos.x)),
        y: Math.max(0, Math.min(newState.height - 1, landingPos.y)),
      };
      newState.ball = edgePos;
      newState = bounceBall(newState, rng);
    }

    // Injury by crowd
    newState = performInjuryRoll(newState, newState.players.find(p => p.id === thrown.id)!, rng, 1);
    return checkTouchdowns(newState);
  }

  // --- Move thrown player to landing position ---
  newState.players = newState.players.map(p =>
    p.id === thrown.id ? { ...p, pos: { ...landingPos } } : p,
  );

  const landLog = createLogEntry(
    'action',
    `${thrown.name} atterrit à (${landingPos.x}, ${landingPos.y})`,
    thrown.id,
    thrown.team,
  );
  newState.gameLog = [...newState.gameLog, landLog];

  // --- Landing on occupied square: automatic crash ---
  if (occupiedBy) {
    const crashLog = createLogEntry(
      'action',
      `${thrown.name} atterrit sur ${occupiedBy.name} ! Crash !`,
      thrown.id,
      thrown.team,
    );
    newState.gameLog = [...newState.gameLog, crashLog];

    return handleCrashLanding(newState, thrown.id, rng);
  }

  // --- Landing roll (AG) ---
  const landingResult = performLandingRoll(newState, newState.players.find(p => p.id === thrown.id)!, landingPos, rng);
  newState.lastDiceResult = landingResult;

  const landingRollLog = createLogEntry(
    'dice',
    `Jet d'atterrissage de ${thrown.name}: ${landingResult.diceRoll}/${landingResult.targetNumber} ${landingResult.success ? '✓' : '✗'}`,
    thrown.id,
    thrown.team,
    { diceRoll: landingResult.diceRoll, targetNumber: landingResult.targetNumber },
  );
  newState.gameLog = [...newState.gameLog, landingRollLog];

  if (landingResult.success) {
    // Successful landing
    const successLog = createLogEntry(
      'action',
      `${thrown.name} atterrit sur ses pieds !`,
      thrown.id,
      thrown.team,
    );
    newState.gameLog = [...newState.gameLog, successLog];

    // Check touchdown if player has ball and lands in endzone
    const landedPlayer = newState.players.find(p => p.id === thrown.id)!;
    if (landedPlayer.hasBall && isInOpponentEndzone(newState, landedPlayer)) {
      return awardTouchdown(newState, landedPlayer.team, landedPlayer);
    }

    return checkTouchdowns(newState);
  }

  // --- Failed landing: crash ---
  return handleCrashLanding(newState, thrown.id, rng);
}

/**
 * Gère un atterrissage raté (crash) : le joueur tombe + jet d'armure
 */
function handleCrashLanding(state: GameState, playerId: string, rng: RNG): GameState {
  let newState = structuredClone(state) as GameState;

  const player = newState.players.find(p => p.id === playerId)!;

  const crashLog = createLogEntry(
    'action',
    `${player.name} s'écrase au sol !`,
    player.id,
    player.team,
  );
  newState.gameLog = [...newState.gameLog, crashLog];

  // Player is knocked down
  newState.players = newState.players.map(p =>
    p.id === playerId ? { ...p, stunned: true } : p,
  );

  // If player had ball, it bounces
  if (player.hasBall) {
    newState.players = newState.players.map(p =>
      p.id === playerId ? { ...p, hasBall: false } : p,
    );
    newState.ball = { ...player.pos };
    newState = bounceBall(newState, rng);
  }

  // Armor roll → injury
  const updatedPlayer = newState.players.find(p => p.id === playerId)!;
  newState = performInjuryRoll(newState, updatedPlayer, rng);

  return checkTouchdowns(newState);
}
