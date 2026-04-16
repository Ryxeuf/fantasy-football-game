/**
 * Juggernaut (BB3 Season 2/3 rules).
 *
 * When this player performs a Blitz action:
 *  1. They may choose to treat a BOTH_DOWN result as a PUSH_BACK instead
 *     (no one falls, no armor rolls, no turnover).
 *  2. Opposing players targeted by this Blitz cannot use the Fend, Stand Firm,
 *     or Wrestle skills.
 *
 * Juggernaut has NO effect during a normal Block action.
 *
 * Primary users: Dwarf Deathroller (Season 2 & 3), Pump Wagon (Snotlings S3
 * bestiary).
 *
 * This file only exposes predicates; the actual block-resolution wiring lives
 * in `blocking.ts` (inside `handleBothDown`). The conversion is "may choose",
 * so the engine auto-resolves it to whichever option yields the best outcome
 * for the attacker — see `shouldConvertBothDownToPushBack`.
 */

import type { GameState, Player } from '../core/types';
import { hasSkill } from '../skills/skill-effects';

/**
 * Returns true if the player owns the Juggernaut skill (accepts slug variants).
 */
export function hasJuggernaut(player: Player): boolean {
  return hasSkill(player, 'juggernaut');
}

/**
 * Returns true if the attacker has Juggernaut AND is currently performing a
 * Blitz action (the skill's BOTH_DOWN → PUSH_BACK conversion and the
 * anti-Fend/Stand Firm/Wrestle clauses only apply on a Blitz).
 */
export function isJuggernautActiveForBlock(
  state: GameState,
  attacker: Player,
): boolean {
  if (!hasJuggernaut(attacker)) return false;
  return state.playerActions?.[attacker.id] === 'BLITZ';
}

/**
 * Decides whether a BOTH_DOWN block result should be converted to PUSH_BACK
 * under Juggernaut. The rule says "may choose", so we pick the option that is
 * strictly best for the attacker:
 *
 *  - Without Block: convert to PUSH_BACK (nobody falls, no turnover).
 *  - With Block: keep BOTH_DOWN so the standard Block handling applies
 *    (attacker stays up, defender falls prone — strictly better outcome).
 *
 * The anti-Fend/Stand Firm/Wrestle clauses still apply even when the
 * conversion is skipped — callers that care about those should use
 * `isJuggernautActiveForBlock` instead.
 */
export function shouldConvertBothDownToPushBack(
  state: GameState,
  attacker: Player,
): boolean {
  if (!isJuggernautActiveForBlock(state, attacker)) return false;
  // If the attacker has Block, the standard BOTH_DOWN handling already puts
  // the defender on the ground while keeping the attacker up — strictly
  // better than a Push Back. Skip the conversion in that case.
  if (hasSkill(attacker, 'block')) return false;
  return true;
}
