/**
 * Break Tackle (BB3 Season 2/3 rules).
 *
 * Once per activation, after this player has performed a Dodge action (Agility
 * test), they may modify the dice roll by:
 *   - +1 if their Strength (ST) characteristic is 4 or less,
 *   - +2 if their Strength (ST) characteristic is 5 or more.
 *
 * Rules of thumb:
 *   - Only triggers when the Dodge roll failed, and only when applying the
 *     modifier would turn the failure into a success (otherwise the skill
 *     is kept for later in the activation).
 *   - A natural 1 on the D6 remains a failure regardless of modifiers (BB3
 *     standard: natural 1 always fails).
 *   - The skill can only be used once per activation; the `breakTackleUsed`
 *     flag is reset at the end of the team turn together with `gfiUsed`.
 */

import type { GameState, Player } from '../core/types';
import { hasSkill } from '../skills/skill-effects';
import { createLogEntry } from '../utils/logging';

export interface BreakTackleResult {
  /** Whether the skill actually triggered. */
  triggered: boolean;
  /** Modifier applied when triggered (+1 or +2). */
  modifier?: number;
  /** New success state after the modifier is applied. */
  newSuccess?: boolean;
  /** Game state, possibly with `breakTackleUsed` set on the player and a log entry. */
  newState: GameState;
}

const NO_TRIGGER = (state: GameState): BreakTackleResult => ({
  triggered: false,
  newState: state,
});

export function hasBreakTackle(player: Player): boolean {
  return hasSkill(player, 'break-tackle') || hasSkill(player, 'break_tackle');
}

export function getBreakTackleModifier(player: Player): number {
  return player.st >= 5 ? 2 : 1;
}

/**
 * Try to apply Break Tackle to a dodge roll.
 *
 * @param state - Current game state
 * @param player - Player attempting the dodge
 * @param diceRoll - Raw D6 rolled for the dodge (1-6)
 * @param targetNumber - Effective target for the roll (already modified by
 *                       tackle zones and other skill modifiers)
 * @param currentSuccess - Whether the dodge already succeeded
 * @returns BreakTackleResult describing whether the skill fired and the
 *          updated game state.
 */
export function checkBreakTackle(
  state: GameState,
  player: Player,
  diceRoll: number,
  targetNumber: number,
  currentSuccess: boolean
): BreakTackleResult {
  if (!hasBreakTackle(player)) return NO_TRIGGER(state);
  if (currentSuccess) return NO_TRIGGER(state);
  if (player.breakTackleUsed) return NO_TRIGGER(state);
  // BB3: natural 1 always fails, cannot be saved by modifiers.
  if (diceRoll === 1) return NO_TRIGGER(state);

  const modifier = getBreakTackleModifier(player);
  const newSuccess = diceRoll + modifier >= targetNumber;

  // Only burn the once-per-activation use if it actually succeeds.
  if (!newSuccess) return NO_TRIGGER(state);

  const idx = state.players.findIndex((p) => p.id === player.id);
  if (idx === -1) return NO_TRIGGER(state);

  const updatedPlayer: Player = {
    ...state.players[idx],
    breakTackleUsed: true,
  };
  const newPlayers = state.players.map((p, i) => (i === idx ? updatedPlayer : p));

  const logEntry = createLogEntry(
    'dice',
    `Esquive en Force (Break Tackle) — ${player.name}: +${modifier} (D6=${diceRoll}+${modifier}=${diceRoll + modifier} >= ${targetNumber}) ✓`,
    player.id,
    player.team,
    {
      diceRoll,
      targetNumber,
      modifier,
      newSuccess: true,
      skill: 'break-tackle',
    }
  );

  return {
    triggered: true,
    modifier,
    newSuccess: true,
    newState: {
      ...state,
      players: newPlayers,
      gameLog: [...state.gameLog, logEntry],
    },
  };
}
