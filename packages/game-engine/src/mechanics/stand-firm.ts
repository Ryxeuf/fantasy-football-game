/**
 * Stand Firm (BB3 Season 2/3 rules).
 *
 * A player with this skill may choose whether or not to be pushed back
 * following a Block action. If they choose not to be pushed back, they
 * remain in the square they occupy.
 *
 * Mechanical consequences:
 *  - On PUSH_BACK: the defender stays put; no follow-up is granted because
 *    the defender still occupies the target square.
 *  - On POW / STUMBLE (without Dodge): the defender falls in their own
 *    square instead of being pushed then falling. No follow-up is granted.
 *  - BOTH_DOWN does not involve a push, so Stand Firm has no effect there.
 *  - Stand Firm also resists chain pushes.
 *
 * Countered by:
 *  - Juggernaut (only when the attacker is performing a Blitz action).
 *
 * Primary users: Dwarf Deathroller, Treemen (Gnomes/Halflings/Wood Elves),
 * Bodyguards/Bloaters, and several Star Players.
 *
 * In practice, we always let the player "choose" to resist the push — it is
 * always advantageous for the defender, so there is no reason to decline.
 */

import type { GameState, Player } from '../core/types';
import { hasSkill } from '../skills/skill-effects';
import { isJuggernautActiveForBlock } from './juggernaut';

/**
 * Returns true if the player owns the Stand Firm skill (accepts slug variants).
 */
export function hasStandFirm(player: Player): boolean {
  return hasSkill(player, 'stand-firm') || hasSkill(player, 'stand_firm');
}

/**
 * Returns true if the defender has Stand Firm AND the attacker is not
 * suppressing it via Juggernaut (on a Blitz).
 */
export function isStandFirmActiveAgainstBlock(
  state: GameState,
  target: Player,
  attacker: Player,
): boolean {
  if (!hasStandFirm(target)) return false;
  if (isJuggernautActiveForBlock(state, attacker)) return false;
  return true;
}

/**
 * Returns true if the chain-pushed victim can use Stand Firm to resist the
 * chain push. Juggernaut does NOT nullify Stand Firm on chain-pushed victims
 * (only on the direct target of the Blitz).
 */
export function isStandFirmActiveAgainstChainPush(player: Player): boolean {
  return hasStandFirm(player);
}
