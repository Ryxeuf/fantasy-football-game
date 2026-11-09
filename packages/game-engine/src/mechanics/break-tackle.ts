/**
 * Break Tackle — Esquive en Force (Blood Bowl 2025, Saison 3).
 *
 * Once per (team) turn, when this player attempts to Dodge, they may apply a
 * modifier to the Agility test:
 *   - +1 if their Strength (ST) characteristic is 3 or less,
 *   - +2 if their Strength (ST) characteristic is 4,
 *   - +3 if their Strength (ST) characteristic is 5 or more.
 *
 * A Season 2 match keeps the 2020 text: +1 for ST ≤ 4, +2 for ST ≥ 5. Its
 * "once per activation" needs no separate flag: a player is activated once
 * per team turn, so the use given back at END_TURN covers both wordings.
 *
 * Rules of thumb:
 *   - Only triggers when the Dodge roll failed, and only when applying the
 *     modifier would turn the failure into a success (otherwise the skill
 *     is kept for later in the turn).
 *   - A natural 1 on the D6 remains a failure regardless of modifiers (BB3
 *     standard: natural 1 always fails).
 *   - The skill can only be used once per team turn; the `breakTackleUsed`
 *     flag is reset at the end of the team turn (END_TURN) together with
 *     `gfiUsed`.
 */

import type { GameState, Player } from '../core/types';
import { isSeason2Rules, type GameRuleset } from '../core/ruleset';
import { hasSkill } from '../skills/skill-effects';
import { createLogEntry } from '../utils/logging';

export interface BreakTackleResult {
  /** Whether the skill actually triggered. */
  triggered: boolean;
  /** Modifier applied when triggered (+1, +2 or +3). */
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

/** 2025: ST ≤ 3 ⇒ +1, ST 4 ⇒ +2, ST ≥ 5 ⇒ +3. 2020: ST ≤ 4 ⇒ +1, ST ≥ 5 ⇒ +2. */
export function getBreakTackleModifier(
  player: Player,
  ruleset?: GameRuleset,
): number {
  if (isSeason2Rules(ruleset)) return player.st >= 5 ? 2 : 1;
  if (player.st >= 5) return 3;
  if (player.st === 4) return 2;
  return 1;
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

  const modifier = getBreakTackleModifier(player, state.ruleset);
  const newSuccess = diceRoll + modifier >= targetNumber;

  // Only burn the once-per-turn use if it actually succeeds.
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
