/**
 * Negative trait activation checks (Bone Head, Really Stupid, Wild Animal, Animal Savagery, etc.)
 * These are checked at the start of a player's activation before their first action.
 */

import type { GameState, Player, RNG, Position, BlockResult } from '../core/types';
import { hasSkill } from '../skills/skill-effects';
import { hasPlayerActed, setPlayerAction } from '../core/game-state';
import { createLogEntry } from '../utils/logging';
import { getAdjacentPlayers, inBounds, isPositionOccupied } from './movement';
import { blockResultFromRoll } from '../utils/dice';
import { performArmorRoll } from '../utils/dice';
import { performInjuryRoll } from './injury';
import { getPushDirections } from './blocking';
import { checkBlockNegatesBothDown, checkDodgeNegatesStumble } from '../skills/skill-bridge';

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

/**
 * Check Wild Animal activation roll.
 * BB3 Rule: At the start of this player's activation, roll a D6.
 * Add +2 to the result if the player is attempting a Block or Blitz action.
 * - On a total of 1-3: activation ends immediately (NOT a turnover)
 *   -> Block/Blitz: only fails on natural 1 (1+2=3)
 *   -> Other actions: fails on natural 1-3
 *
 * @param moveType The type of action being attempted (used for Block/Blitz modifier)
 * @returns { passed: true, newState } if player doesn't have wild-animal or passes the roll
 * @returns { passed: false, newState } with modified state if roll fails
 */
export function checkWildAnimal(
  state: GameState,
  player: Player,
  rng: RNG,
  moveType: string
): ActivationCheckResult {
  // No wild-animal: always pass (no state change)
  if (!hasSkill(player, 'wild-animal')) {
    return { passed: true, newState: state };
  }

  // Already acted this turn: skip check (not first action)
  if (hasPlayerActed(state, player.id)) {
    return { passed: true, newState: state };
  }

  // Roll D6
  const roll = Math.floor(rng() * 6) + 1;
  // +2 modifier for Block or Blitz actions
  const isBlockOrBlitz = moveType === 'BLOCK' || moveType === 'BLITZ';
  const modifier = isBlockOrBlitz ? 2 : 0;
  const total = roll + modifier;
  const success = total >= 4;

  const modifierText = modifier > 0 ? ` (+${modifier})` : '';
  const rollLog = createLogEntry(
    'dice',
    `Fureur Debridee: ${roll}${modifierText}/${4} ${success ? '✓' : '✗'}`,
    player.id,
    player.team,
    { diceRoll: roll, targetNumber: 4, success, skill: 'wild-animal', modifier }
  );

  let newState: GameState = {
    ...state,
    gameLog: [...state.gameLog, rollLog],
  };

  if (!success) {
    // Failed: activation ends immediately, NOT a turnover
    const failLog = createLogEntry(
      'info',
      `${player.name} est pris de fureur et ne peut pas agir !`,
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
 * Auto-push a target player away from the attacker.
 * Picks the first available direction. No pending state.
 */
function autoPushPlayer(
  state: GameState,
  attacker: Player,
  target: Player,
): { newState: GameState; pushed: boolean } {
  const pushDirections = getPushDirections(attacker.pos, target.pos);
  for (const dir of pushDirections) {
    const newPos: Position = {
      x: target.pos.x + dir.x,
      y: target.pos.y + dir.y,
    };
    if (inBounds(state, newPos) && !isPositionOccupied(state, newPos)) {
      const pushLog = createLogEntry(
        'action',
        `${target.name} repoussé vers (${newPos.x}, ${newPos.y})`,
        attacker.id,
        attacker.team
      );
      return {
        newState: {
          ...state,
          players: state.players.map(p =>
            p.id === target.id ? { ...p, pos: newPos } : p
          ),
          gameLog: [...state.gameLog, pushLog],
        },
        pushed: true,
      };
    }
  }
  return { newState: state, pushed: false };
}

/**
 * Knock down a player in place: set stunned, perform armor + injury rolls.
 */
function knockDownPlayer(
  state: GameState,
  player: Player,
  rng: RNG
): GameState {
  let newState: GameState = {
    ...state,
    players: state.players.map(p =>
      p.id === player.id ? { ...p, stunned: true } : p
    ),
  };

  const armorResult = performArmorRoll(player, rng);
  const armorLog = createLogEntry(
    'dice',
    `Jet d'armure: ${armorResult.diceRoll}/${armorResult.targetNumber} ${armorResult.success ? '✓' : '✗'}`,
    player.id,
    player.team,
    { diceRoll: armorResult.diceRoll, targetNumber: armorResult.targetNumber, success: armorResult.success }
  );
  newState = { ...newState, gameLog: [...newState.gameLog, armorLog] };

  if (!armorResult.success) {
    newState = performInjuryRoll(newState, player, rng);
  }

  return newState;
}

/**
 * Resolve a forced Animal Savagery block inline (no pending states).
 * Returns the updated state and whether the attacker is still standing.
 */
function resolveAnimalSavageryBlock(
  state: GameState,
  attacker: Player,
  target: Player,
  blockResult: BlockResult,
  rng: RNG
): { newState: GameState; attackerStanding: boolean } {
  let newState = state;

  switch (blockResult) {
    case 'PLAYER_DOWN': {
      const downLog = createLogEntry(
        'action',
        `${attacker.name} tombe en attaquant sauvagement !`,
        attacker.id,
        attacker.team
      );
      newState = { ...newState, gameLog: [...newState.gameLog, downLog] };
      newState = knockDownPlayer(newState, attacker, rng);
      return { newState, attackerStanding: false };
    }

    case 'BOTH_DOWN': {
      const attackerHasBlock = checkBlockNegatesBothDown(attacker, state);
      const targetHasBlock = checkBlockNegatesBothDown(target, state);
      const attackerFalls = !attackerHasBlock;
      const targetFalls = !targetHasBlock;

      if (!attackerFalls && !targetFalls) {
        const log = createLogEntry(
          'action',
          `Les Deux Plaqués — ${attacker.name} et ${target.name} restent debout (Block)`,
          attacker.id,
          attacker.team
        );
        return { newState: { ...newState, gameLog: [...newState.gameLog, log] }, attackerStanding: true };
      }

      const log = createLogEntry(
        'action',
        `Les Deux Plaqués — ${attackerFalls ? attacker.name + ' tombe' : attacker.name + ' (Block)'}, ${targetFalls ? target.name + ' tombe' : target.name + ' (Block)'}`,
        attacker.id,
        attacker.team
      );
      newState = { ...newState, gameLog: [...newState.gameLog, log] };

      if (targetFalls) {
        const { newState: pushed } = autoPushPlayer(newState, attacker, target);
        newState = pushed;
        newState = knockDownPlayer(newState, target, rng);
      }
      if (attackerFalls) {
        newState = knockDownPlayer(newState, attacker, rng);
      }

      return { newState, attackerStanding: !attackerFalls };
    }

    case 'PUSH_BACK': {
      const { newState: pushed } = autoPushPlayer(newState, attacker, target);
      newState = pushed;
      return { newState, attackerStanding: true };
    }

    case 'STUMBLE': {
      const dodgeNegates = checkDodgeNegatesStumble(target, attacker, state);
      const { newState: pushed } = autoPushPlayer(newState, attacker, target);
      newState = pushed;
      if (!dodgeNegates) {
        newState = knockDownPlayer(newState, target, rng);
      }
      return { newState, attackerStanding: true };
    }

    case 'POW': {
      const { newState: pushed } = autoPushPlayer(newState, attacker, target);
      newState = pushed;
      newState = knockDownPlayer(newState, target, rng);
      return { newState, attackerStanding: true };
    }

    default:
      return { newState, attackerStanding: true };
  }
}

/**
 * Check Animal Savagery activation roll.
 * BB3 Rule: At the start of this player's activation, roll a D6.
 * - On a 2+: player may perform their declared action as normal.
 * - On a 1: player lashes out at a random adjacent standing teammate.
 *   -> If adjacent standing teammate exists: perform forced 1-die block, then
 *      if attacker is still standing, continue declared action.
 *   -> If no adjacent standing teammate: activation ends immediately (NOT a turnover).
 *
 * @returns { passed: true, newState } if player can continue their action
 * @returns { passed: false, newState } if activation is lost
 */
export function checkAnimalSavagery(
  state: GameState,
  player: Player,
  rng: RNG
): ActivationCheckResult {
  if (!hasSkill(player, 'animal-savagery')) {
    return { passed: true, newState: state };
  }

  if (hasPlayerActed(state, player.id)) {
    return { passed: true, newState: state };
  }

  const roll = Math.floor(rng() * 6) + 1;
  const success = roll >= 2;

  const rollLog = createLogEntry(
    'dice',
    `Sauvagerie Animale: ${roll}/2 ${success ? '✓' : '✗'}`,
    player.id,
    player.team,
    { diceRoll: roll, targetNumber: 2, success, skill: 'animal-savagery' }
  );

  let newState: GameState = {
    ...state,
    gameLog: [...state.gameLog, rollLog],
  };

  if (success) {
    return { passed: true, newState };
  }

  // Failed (roll 1): lash out at random adjacent standing teammate
  const adjacents = getAdjacentPlayers(newState, player.pos);
  const standingTeammates = adjacents.filter(
    p => p.team === player.team && p.id !== player.id && p.state === 'active'
  );

  if (standingTeammates.length === 0) {
    const failLog = createLogEntry(
      'info',
      `${player.name} est pris de sauvagerie mais n'a aucun coéquipier adjacent !`,
      player.id,
      player.team
    );
    newState = {
      ...newState,
      gameLog: [...newState.gameLog, failLog],
    };

    newState = setPlayerAction(newState, player.id, 'MOVE');
    newState = {
      ...newState,
      players: newState.players.map(p =>
        p.id === player.id ? { ...p, pm: 0, gfiUsed: 2 } : p
      ),
    };

    return { passed: false, newState };
  }

  // Pick random adjacent teammate
  const targetIndex = Math.floor(rng() * standingTeammates.length);
  const target = standingTeammates[targetIndex];

  // Perform forced 1-die block against teammate
  const blockRoll = Math.floor(rng() * 6) + 1;
  const blockResult = blockResultFromRoll(blockRoll);

  const lashLog = createLogEntry(
    'action',
    `${player.name} attaque sauvagement ${target.name} ! (${blockResult})`,
    player.id,
    player.team,
    { skill: 'animal-savagery', targetId: target.id, blockResult, diceRoll: blockRoll }
  );
  newState = { ...newState, gameLog: [...newState.gameLog, lashLog] };

  // Resolve forced block inline
  const resolution = resolveAnimalSavageryBlock(newState, player, target, blockResult, rng);
  newState = resolution.newState;

  if (!resolution.attackerStanding) {
    newState = setPlayerAction(newState, player.id, 'MOVE');
    newState = {
      ...newState,
      isTurnover: true,
      players: newState.players.map(p =>
        p.id === player.id ? { ...p, pm: 0, gfiUsed: 2 } : p
      ),
    };
    return { passed: false, newState };
  }

  // Attacker still standing: can continue their declared action
  return { passed: true, newState };
}

/**
 * Check Take Root activation roll.
 * BB3 Rule: At the start of this player's activation, roll a D6.
 * On a 1, the player becomes "rooted" — they can't perform any action
 * and their activation ends immediately.
 * On 2+, the player acts normally.
 * This is NOT a turnover.
 *
 * @returns { passed: true, newState } if player doesn't have take-root or passes the roll
 * @returns { passed: false, newState } with modified state if roll fails
 */
export function checkTakeRoot(
  state: GameState,
  player: Player,
  rng: RNG
): ActivationCheckResult {
  // No take-root: always pass (no state change)
  if (!hasSkill(player, 'take-root')) {
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
    `Prendre Racine: ${roll}/2 ${success ? '✓' : '✗'}`,
    player.id,
    player.team,
    { diceRoll: roll, targetNumber: 2, success, skill: 'take-root' }
  );

  let newState: GameState = {
    ...state,
    gameLog: [...state.gameLog, rollLog],
  };

  if (!success) {
    // Failed: player is rooted, activation ends immediately, NOT a turnover
    const failLog = createLogEntry(
      'info',
      `${player.name} est enraciné et ne peut pas agir !`,
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
