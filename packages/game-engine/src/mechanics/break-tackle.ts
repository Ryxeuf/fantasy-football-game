/**
 * Break Tackle (BB3 Season 2/3 rules).
 *
 * Once per team turn, a player with the Break Tackle skill may attempt to
 * Dodge using their ST characteristic in place of their AG characteristic.
 *
 * Implementation:
 * - Only meaningful when the player's ST is strictly greater than their AG
 *   (otherwise replacing AG with ST would not help). In that case, we model
 *   the effect as a dodge-roll bonus equal to `ST - AG`. This is equivalent
 *   to computing the AG target number using ST instead of AG.
 * - Usage is tracked per-player per-team-turn via `state.usedBreakTackleThisTurn`.
 *   The bonus only applies when the player has not yet used Break Tackle
 *   during the current team turn.
 * - The tracking array is cleared at the start of each team turn (in
 *   `handleEndTurn`), matching the lifetime of other per-turn flags
 *   (`rerollUsedThisTurn`, `teamBlitzCount`, ...).
 *
 * Primary users: Dwarf Deathroller (ST 7, AG 5 → +2 on dodge), Orc Blitzer
 * (ST 4, AG 3 → +1), various Big Guys.
 */

import type { GameState, Player } from '../core/types';
import { hasSkill } from '../skills/skill-effects';

/**
 * Returns true if the player owns the Break Tackle skill (either slug form).
 */
export function hasBreakTackle(player: Player): boolean {
  return hasSkill(player, 'break-tackle') || hasSkill(player, 'break_tackle');
}

/**
 * Returns the raw dodge bonus (ST - AG, never negative) granted by Break Tackle.
 * Returns 0 when the player lacks the skill or ST <= AG.
 *
 * Does NOT take into account the once-per-turn restriction — use
 * {@link canApplyBreakTackle} for that.
 */
export function getBreakTackleDodgeBonus(player: Player): number {
  if (!hasBreakTackle(player)) return 0;
  return Math.max(0, player.st - player.ag);
}

/**
 * Returns true if the player has already used Break Tackle during the current
 * team turn.
 */
export function hasUsedBreakTackleThisTurn(
  state: GameState,
  playerId: string,
): boolean {
  return (state.usedBreakTackleThisTurn ?? []).includes(playerId);
}

/**
 * Returns true if Break Tackle is applicable right now for this player:
 * - skill is present,
 * - ST > AG (otherwise replacing AG with ST is not beneficial),
 * - the player has not yet used Break Tackle this team turn.
 */
export function canApplyBreakTackle(state: GameState, player: Player): boolean {
  if (!hasBreakTackle(player)) return false;
  if (player.st <= player.ag) return false;
  if (hasUsedBreakTackleThisTurn(state, player.id)) return false;
  return true;
}

/**
 * Records that `playerId` has used Break Tackle this turn. Returns a new
 * GameState; does not mutate the input. Idempotent for the same player.
 */
export function markBreakTackleUsed(
  state: GameState,
  playerId: string,
): GameState {
  const current = state.usedBreakTackleThisTurn ?? [];
  if (current.includes(playerId)) {
    return state.usedBreakTackleThisTurn
      ? state
      : { ...state, usedBreakTackleThisTurn: current };
  }
  return {
    ...state,
    usedBreakTackleThisTurn: [...current, playerId],
  };
}
