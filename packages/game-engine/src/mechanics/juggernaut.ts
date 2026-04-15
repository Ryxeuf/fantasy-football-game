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
 * in `blocking.ts` (inside `handleBothDown`). We always convert BOTH_DOWN to
 * PUSH_BACK when Juggernaut is active — the attacker always benefits from
 * the conversion, so the "may choose" clause is resolved automatically.
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
