/**
 * Juggernaut (BB2020 / BB3 rules).
 *
 * When a player with the Juggernaut skill performs a Blitz action, during the
 * block step the following effects apply:
 *  - A `BOTH_DOWN` result may be applied as if it were a `PUSH_BACK` result.
 *  - The `Fend` and `Stand Firm` skills of the opposing player are cancelled
 *    for that block step.
 *
 * Outside of a Blitz action (e.g. during a standard Block action), Juggernaut
 * has no effect.
 *
 * Auto-resolution note: when the attacker also has the `Block` skill, keeping
 * the `BOTH_DOWN` result yields a strictly better outcome (defender falls,
 * attacker stays up). In that case the conversion is skipped.
 */

import type { GameState, Player } from '../core/types';
import { getPlayerAction } from '../core/game-state';
import { hasSkill } from '../skills/skill-effects';

/**
 * Returns true when the player currently has an active Blitz action and owns
 * the Juggernaut skill. Used by the block resolution and by opponent skills
 * (Fend, Stand Firm) that Juggernaut can cancel.
 */
export function isJuggernautActive(state: GameState, attacker: Player): boolean {
  if (!hasSkill(attacker, 'juggernaut')) return false;
  return getPlayerAction(state, attacker.id) === 'BLITZ';
}

/**
 * Returns true when Juggernaut should convert a `BOTH_DOWN` block result into
 * a `PUSH_BACK`. The conversion is skipped when the attacker also has `Block`
 * because the standard Block handling yields a better outcome for the
 * attacker (defender falls, attacker stays up, no turnover).
 */
export function shouldConvertBothDownToPushBack(
  state: GameState,
  attacker: Player,
): boolean {
  if (!isJuggernautActive(state, attacker)) return false;
  if (hasSkill(attacker, 'block')) return false;
  return true;
}
