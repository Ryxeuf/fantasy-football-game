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
import { movePlayerToDugoutZone } from './dugout';
import { bounceBall } from './ball';

export interface ActivationCheckResult {
  passed: boolean;
  newState: GameState;
}

export interface AlwaysHungryResult {
  /** true = le lancer de coéquipier peut se dérouler normalement */
  passed: boolean;
  /** true = le coéquipier a été mangé (retiré du jeu comme casualty) */
  eaten: boolean;
  /** true = le coéquipier s'est échappé mais est tombé à terre */
  escaped: boolean;
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
 * Détermine la cible Bloodlust en fonction de la variante du trait.
 * - `bloodlust`   → cible 4+ (variante par défaut BB3)
 * - `bloodlust-2` → cible 2+
 * - `bloodlust-3` → cible 3+
 * @returns la cible à atteindre, ou null si le joueur n'a pas le trait
 */
function getBloodlustTarget(player: Player): number | null {
  if (hasSkill(player, 'bloodlust-2')) return 2;
  if (hasSkill(player, 'bloodlust-3')) return 3;
  if (hasSkill(player, 'bloodlust')) return 4;
  return null;
}

/**
 * Check Bloodlust activation roll.
 * BB3 Rule: At the start of this player's activation, after declaring their action,
 * roll a D6 and add +1 if the declared action is a Block or Blitz.
 * - If the result is >= target number (from the variant): act normally.
 * - If the result is < target number OR natural 1: activation fails. The Vampire
 *   could bite an adjacent Thrall teammate — in this simplified implementation,
 *   the activation ends (NOT a turnover), mirroring other negative-trait patterns.
 *
 * Three variants are supported:
 * - `bloodlust`   → cible 4+ (défaut)
 * - `bloodlust-2` → cible 2+
 * - `bloodlust-3` → cible 3+
 *
 * @param moveType Action déclarée (BLOCK/BLITZ bénéficient d'un +1)
 * @returns { passed, newState } — newState inchangé si aucun trait présent
 */
export function checkBloodlust(
  state: GameState,
  player: Player,
  rng: RNG,
  moveType: string
): ActivationCheckResult {
  const targetNumber = getBloodlustTarget(player);

  // No bloodlust variant: always pass (no state change)
  if (targetNumber === null) {
    return { passed: true, newState: state };
  }

  // Already acted this turn: skip check (not first action)
  if (hasPlayerActed(state, player.id)) {
    return { passed: true, newState: state };
  }

  // Roll D6
  const roll = Math.floor(rng() * 6) + 1;
  const isBlockOrBlitz = moveType === 'BLOCK' || moveType === 'BLITZ';
  const modifier = isBlockOrBlitz ? 1 : 0;
  const total = roll + modifier;
  // Natural 1 always fails, regardless of modifier
  const success = roll !== 1 && total >= targetNumber;

  const modifierText = modifier > 0 ? ` (+${modifier})` : '';
  const rollLog = createLogEntry(
    'dice',
    `Soif de Sang: ${roll}${modifierText}/${targetNumber} ${success ? '✓' : '✗'}`,
    player.id,
    player.team,
    { diceRoll: roll, targetNumber, success, skill: 'bloodlust', modifier }
  );

  let newState: GameState = {
    ...state,
    gameLog: [...state.gameLog, rollLog],
  };

  if (!success) {
    // Failed: activation ends immediately, NOT a turnover.
    // Full rule allows biting an adjacent Thrall teammate — simplified here
    // by just ending the activation (same pattern as bone-head/take-root).
    const failLog = createLogEntry(
      'info',
      `${player.name} cède à sa soif de sang et ne peut pas agir !`,
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

/**
 * Check Always Hungry activation roll (BB3).
 *
 * Règle BB3 : lorsque le joueur tente une action Lancer de Coéquipier
 * (Throw Team-Mate), après son déplacement mais avant le lancer, il doit
 * effectuer un jet d'activation.
 *
 * - D6 = 2+ : le lancer se poursuit normalement.
 * - D6 = 1  : le joueur tente de manger son coéquipier. Relancez un D6 :
 *     - 1   : le coéquipier est avalé (mis en casualty, retiré du jeu).
 *             Turnover.
 *     - 2-6 : le coéquipier s'échappe mais tombe à terre (jet de blessure).
 *             Turnover.
 *
 * Dans tous les cas d'échec, le ballon porté par le coéquipier est lâché
 * à la position actuelle puis rebondit.
 *
 * @param state  État courant du jeu
 * @param thrower Joueur qui voulait effectuer le TTM
 * @param thrown Coéquipier qui devait être lancé
 * @param rng    Générateur déterministe
 * @returns      Résultat du test avec nouvel état
 */
export function checkAlwaysHungry(
  state: GameState,
  thrower: Player,
  thrown: Player,
  rng: RNG
): AlwaysHungryResult {
  // No always-hungry: always pass (no state change)
  if (!hasSkill(thrower, 'always-hungry')) {
    return { passed: true, eaten: false, escaped: false, newState: state };
  }

  // Roll D6: succeed on 2+
  const hungerRoll = Math.floor(rng() * 6) + 1;
  const success = hungerRoll >= 2;

  const rollLog = createLogEntry(
    'dice',
    `Toujours Affamé: ${hungerRoll}/2 ${success ? '✓' : '✗'}`,
    thrower.id,
    thrower.team,
    { diceRoll: hungerRoll, targetNumber: 2, success, skill: 'always-hungry' }
  );

  let newState: GameState = {
    ...state,
    gameLog: [...state.gameLog, rollLog],
  };

  if (success) {
    return { passed: true, eaten: false, escaped: false, newState };
  }

  // Failed hunger check: attempt to eat teammate (second D6)
  const attemptLog = createLogEntry(
    'action',
    `${thrower.name} tente de manger ${thrown.name} au lieu de le lancer !`,
    thrower.id,
    thrower.team,
    { skill: 'always-hungry', targetId: thrown.id }
  );
  newState = {
    ...newState,
    gameLog: [...newState.gameLog, attemptLog],
  };

  const eatRoll = Math.floor(rng() * 6) + 1;
  const eaten = eatRoll === 1;

  const eatLog = createLogEntry(
    'dice',
    `Jet d'appétit: ${eatRoll} — ${eaten ? 'coéquipier avalé' : "coéquipier s'échappe"}`,
    thrower.id,
    thrower.team,
    { diceRoll: eatRoll, skill: 'always-hungry', eaten }
  );
  newState = {
    ...newState,
    gameLog: [...newState.gameLog, eatLog],
  };

  // In both outcomes: the teammate drops the ball if carried
  const thrownCarried = newState.players.find(p => p.id === thrown.id)?.hasBall;
  if (thrownCarried) {
    const dropPos: Position = { ...thrown.pos };
    newState = {
      ...newState,
      players: newState.players.map(p =>
        p.id === thrown.id ? { ...p, hasBall: false } : p
      ),
      ball: dropPos,
    };
    newState = bounceBall(newState, rng);
  }

  // The thrower loses their TTM action (turnover)
  newState = setPlayerAction(newState, thrower.id, 'THROW_TEAM_MATE');
  newState = {
    ...newState,
    isTurnover: true,
    players: newState.players.map(p =>
      p.id === thrower.id ? { ...p, pm: 0, gfiUsed: 2 } : p
    ),
  };

  if (eaten) {
    // Teammate is removed from play as a casualty (no armor/injury roll)
    newState = movePlayerToDugoutZone(newState, thrown.id, 'casualty', thrown.team);
    newState = {
      ...newState,
      players: newState.players.map(p =>
        p.id === thrown.id
          ? { ...p, state: 'casualty', stunned: false, pos: { x: -1, y: -1 } }
          : p
      ),
    };

    const eatenLog = createLogEntry(
      'action',
      `${thrown.name} a été avalé — retiré du jeu (Turnover)`,
      thrown.id,
      thrown.team,
      { skill: 'always-hungry' }
    );
    newState = {
      ...newState,
      gameLog: [...newState.gameLog, eatenLog],
    };

    return { passed: false, eaten: true, escaped: false, newState };
  }

  // Teammate escapes but is placed prone; perform armor + injury roll
  const escapeLog = createLogEntry(
    'action',
    `${thrown.name} s'échappe mais tombe à terre !`,
    thrown.id,
    thrown.team,
    { skill: 'always-hungry' }
  );
  newState = {
    ...newState,
    gameLog: [...newState.gameLog, escapeLog],
    players: newState.players.map(p =>
      p.id === thrown.id ? { ...p, stunned: true } : p
    ),
  };

  // Armor roll: if it breaks, perform injury roll
  const updatedThrown = newState.players.find(p => p.id === thrown.id);
  if (updatedThrown) {
    const armorResult = performArmorRoll(updatedThrown, rng);
    const armorLog = createLogEntry(
      'dice',
      `Jet d'armure: ${armorResult.diceRoll}/${armorResult.targetNumber} ${armorResult.success ? '✓' : '✗'}`,
      updatedThrown.id,
      updatedThrown.team,
      {
        diceRoll: armorResult.diceRoll,
        targetNumber: armorResult.targetNumber,
        success: armorResult.success,
      }
    );
    newState = { ...newState, gameLog: [...newState.gameLog, armorLog] };

    if (!armorResult.success) {
      newState = performInjuryRoll(newState, updatedThrown, rng);
    }
  }

  return { passed: false, eaten: false, escaped: true, newState };
}
