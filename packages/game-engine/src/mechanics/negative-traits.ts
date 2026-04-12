/**
 * Negative trait activation checks (Bone Head, Really Stupid, Wild Animal, etc.)
 * These are checked at the start of a player's activation before their first action.
 */

import type { GameState, Player, RNG } from '../core/types';
import { hasSkill } from '../skills/skill-effects';
import { hasPlayerActed, setPlayerAction } from '../core/game-state';
import { createLogEntry } from '../utils/logging';
import { getAdjacentPlayers } from './movement';

export interface ActivationCheckResult {
  passed: boolean;
  newState: GameState;
}

/**
 * Check Bone Head activation roll.
 * BB3 Rule: At the start of this player's activation, roll a D6.
 * On a 1, the player can't perform any action and their activation ends immediately.
 * This is NOT a turnover.
 *
 * @returns { passed: true, newState } if player doesn't have bone-head or passes the roll
 * @returns { passed: false, newState } with modified state if roll fails
 */
export function checkBoneHead(
  state: GameState,
  player: Player,
  rng: RNG
): ActivationCheckResult {
  // No bone-head: always pass (no state change)
  if (!hasSkill(player, 'bone-head')) {
    return { passed: true, newState: state };
  }

  // Already acted this turn: skip check (not first action)
  if (hasPlayerActed(state, player.id)) {
    return { passed: true, newState: state };
  }

  // Roll D6: succeed on 2+
  const roll = Math.floor(rng() * 6) + 1;
  const success = roll >= 2;

  const rollLog = createLogEntry(
    'dice',
    `Cerveau Lent: ${roll}/2 ${success ? '✓' : '✗'}`,
    player.id,
    player.team,
    { diceRoll: roll, targetNumber: 2, success, skill: 'bone-head' }
  );

  let newState: GameState = {
    ...state,
    gameLog: [...state.gameLog, rollLog],
  };

  if (!success) {
    // Failed: activation ends immediately, NOT a turnover
    const failLog = createLogEntry(
      'info',
      `${player.name} est confus et ne peut pas agir !`,
      player.id,
      player.team
    );
    newState = {
      ...newState,
      gameLog: [...newState.gameLog, failLog],
    };

    // Mark player as having acted and remove all movement points
    newState = setPlayerAction(newState, player.id, 'MOVE');
    newState = {
      ...newState,
      players: newState.players.map(p =>
        p.id === player.id ? { ...p, pm: 0, gfiUsed: 2 } : p
      ),
    };
  }

  return { passed: success, newState };
}

/**
 * Check if a player has any variant of the Really Stupid trait.
 */
function hasReallyStupid(player: Player): boolean {
  return hasSkill(player, 'really-stupid') || hasSkill(player, 'really-stupid-2');
}

/**
 * Check if a Really Stupid player has at least one standing, non-Really-Stupid
 * teammate adjacent to them.
 */
function hasGuidingTeammate(state: GameState, player: Player): boolean {
  const adjacents = getAdjacentPlayers(state, player.pos);
  return adjacents.some(
    p =>
      p.team === player.team &&
      p.id !== player.id &&
      p.state === 'active' &&
      !hasReallyStupid(p)
  );
}

/**
 * Check Really Stupid activation roll.
 * BB3 Rule: At the start of this player's activation, roll a D6.
 * - If adjacent to a standing teammate without Really Stupid: +2 modifier → succeed on 2+
 * - If NOT adjacent to such a teammate: succeed on 4+ (fail on 1-3)
 * - On failure: activation ends immediately, NOT a turnover
 *
 * @returns { passed: true, newState } if player doesn't have really-stupid or passes the roll
 * @returns { passed: false, newState } with modified state if roll fails
 */
export function checkReallyStupid(
  state: GameState,
  player: Player,
  rng: RNG
): ActivationCheckResult {
  // No really-stupid: always pass (no state change)
  if (!hasReallyStupid(player)) {
    return { passed: true, newState: state };
  }

  // Already acted this turn: skip check (not first action)
  if (hasPlayerActed(state, player.id)) {
    return { passed: true, newState: state };
  }

  // Determine target number based on adjacent teammate
  const hasHelper = hasGuidingTeammate(state, player);
  const targetNumber = hasHelper ? 2 : 4;

  // Roll D6
  const roll = Math.floor(rng() * 6) + 1;
  const success = roll >= targetNumber;

  const rollLog = createLogEntry(
    'dice',
    `Gros Débile: ${roll}/${targetNumber} ${success ? '✓' : '✗'}`,
    player.id,
    player.team,
    { diceRoll: roll, targetNumber, success, skill: 'really-stupid' }
  );

  let newState: GameState = {
    ...state,
    gameLog: [...state.gameLog, rollLog],
  };

  if (!success) {
    // Failed: activation ends immediately, NOT a turnover
    const failLog = createLogEntry(
      'info',
      `${player.name} est vraiment stupide et ne peut pas agir !`,
      player.id,
      player.team
    );
    newState = {
      ...newState,
      gameLog: [...newState.gameLog, failLog],
    };

    // Mark player as having acted and remove all movement points
    newState = setPlayerAction(newState, player.id, 'MOVE');
    newState = {
      ...newState,
      players: newState.players.map(p =>
        p.id === player.id ? { ...p, pm: 0, gfiUsed: 2 } : p
      ),
    };
  }

  return { passed: success, newState };
}
