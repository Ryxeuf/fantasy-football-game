/**
 * Shadowing (BB3 Season 2/3 rules).
 *
 * When an opposing player attempts to leave a square in this player's tackle
 * zone (via a Dodge action), the Shadowing player may attempt to follow by
 * rolling 2D6, adding their own MA and subtracting the moving player's MA.
 * On a total of 7 or more, the shadower immediately moves into the square the
 * opponent just vacated (if it is empty and in bounds). Otherwise, the move
 * proceeds normally.
 *
 * Implementation:
 * - Usage is tracked per-shadower per-team-turn via
 *   `state.usedShadowingThisTurn`. The array is reset at the start of each
 *   team turn (in `handleEndTurn`), matching the lifetime of other per-turn
 *   flags (`rerollUsedThisTurn`, `usedBreakTackleThisTurn`, ...).
 * - Only one shadower may attempt to follow per dodge. The closest candidate
 *   available (not hypnotized, not stunned, not already used this turn) is
 *   chosen deterministically.
 *
 * Primary users: Lizardmen Chameleon Skink (MA 7), several star players.
 */

import type { GameState, Player, Position, RNG, TeamId } from '../core/types';
import { getAdjacentOpponents } from './movement';
import { hasSkill } from '../skills/skill-effects';
import { createLogEntry } from '../utils/logging';

/** Target number (inclusive) for a successful Shadowing check (2D6 + MAs). */
export const SHADOWING_TARGET = 7;

/**
 * Returns true if the player owns the Shadowing skill.
 */
export function hasShadowing(player: Player): boolean {
  return hasSkill(player, 'shadowing');
}

/**
 * Returns true if `playerId` has already used Shadowing during the current
 * team turn.
 */
export function hasUsedShadowingThisTurn(
  state: GameState,
  playerId: string,
): boolean {
  return (state.usedShadowingThisTurn ?? []).includes(playerId);
}

/**
 * Records that `playerId` has used Shadowing this team turn. Returns a new
 * GameState; does not mutate the input. Idempotent for the same player.
 */
export function markShadowingUsed(
  state: GameState,
  playerId: string,
): GameState {
  const current = state.usedShadowingThisTurn ?? [];
  if (current.includes(playerId)) {
    return state.usedShadowingThisTurn
      ? state
      : { ...state, usedShadowingThisTurn: current };
  }
  return {
    ...state,
    usedShadowingThisTurn: [...current, playerId],
  };
}

/**
 * Returns adversaries adjacent to `mover.pos` that have the Shadowing skill
 * and have not yet used it this turn.
 */
export function getShadowingCandidates(
  state: GameState,
  mover: Player,
): Player[] {
  const adjacent = getAdjacentOpponents(state, mover.pos, mover.team);
  return adjacent.filter(
    p => hasShadowing(p) && !hasUsedShadowingThisTurn(state, p.id),
  );
}

/**
 * Finds a Shadowing candidate adjacent to `square` for a moving `team`.
 * Returns `null` if no eligible shadower exists.
 *
 * Convenience wrapper around {@link getShadowingCandidates}: takes an explicit
 * square instead of a player, because the Shadowing check happens before the
 * moving player is translated into the destination.
 */
export function findShadowerForSquare(
  state: GameState,
  square: Position,
  movingTeam: TeamId,
): Player | null {
  const adjacent = getAdjacentOpponents(state, square, movingTeam);
  const candidates = adjacent.filter(
    p => hasShadowing(p) && !hasUsedShadowingThisTurn(state, p.id),
  );
  return candidates[0] ?? null;
}

export interface ShadowingRollResult {
  /** The 2D6 total (without MA modifier). */
  diceRoll: number;
  /** The signed MA modifier added to the dice (shadower MA - target MA). */
  maModifier: number;
  /** Final total compared against {@link SHADOWING_TARGET}. */
  total: number;
  /** True when `total >= SHADOWING_TARGET`. */
  success: boolean;
  /** Individual dice faces for logging/UI. */
  dice: [number, number];
}

/**
 * Rolls 2D6 using `rng` and computes the Shadowing success.
 *
 * Formula (BB3): 2D6 + MA_shadower - MA_target ; success on 7 or more.
 */
export function rollShadowingCheck(args: {
  shadowerMa: number;
  targetMa: number;
  rng: RNG;
}): ShadowingRollResult {
  const d1 = Math.floor(args.rng() * 6) + 1;
  const d2 = Math.floor(args.rng() * 6) + 1;
  const diceRoll = d1 + d2;
  const maModifier = args.shadowerMa - args.targetMa;
  const total = diceRoll + maModifier;
  return {
    diceRoll,
    maModifier,
    total,
    success: total >= SHADOWING_TARGET,
    dice: [d1, d2],
  };
}

/**
 * Pure success check (no RNG). Useful for tests and for reusing the outcome
 * of a dice result produced elsewhere (e.g. through the notification helper).
 */
export function computeShadowingSuccess(args: {
  diceTotal: number;
  shadowerMa: number;
  targetMa: number;
}): boolean {
  return args.diceTotal + args.shadowerMa - args.targetMa >= SHADOWING_TARGET;
}

export interface ApplyShadowingResult {
  /** New GameState (possibly equal to input if no effect). */
  state: GameState;
  /** True when the shadower successfully followed into the vacated square. */
  shadowed: boolean;
  /** The shadower that attempted, if any. */
  shadower?: Player;
  /** Dice result, if a roll took place. */
  roll?: ShadowingRollResult;
}

export interface ApplyShadowingOptions {
  /**
   * IDs of players that still occupy `from` after the mover has left. When
   * provided and non-empty, Shadowing cannot follow because the square is not
   * actually vacant. Defaults to "empty" (the mover's square is assumed to
   * become free when they leave).
   */
  occupantIds?: string[];
}

/**
 * Attempts to apply Shadowing when `mover` leaves `from` to go to `_to`.
 *
 * Must be called AFTER the dodge roll resolves successfully (so the mover
 * actually leaves the square). Only one shadower is picked — the first
 * eligible adjacent opponent. The moving player's position is NOT mutated by
 * this function: the caller is expected to translate the mover independently.
 *
 * On success, the chosen shadower is moved onto `from` and marked as having
 * used Shadowing this turn. On failure, the attempt is still consumed
 * (one-per-turn per shadower). If `from` is still occupied by another player
 * (via `options.occupantIds`), no attempt is made at all.
 */
export function applyShadowingOnDodge(
  state: GameState,
  mover: Player,
  from: Position,
  _to: Position,
  rng: RNG,
  options: ApplyShadowingOptions = {},
): ApplyShadowingResult {
  const shadower = findShadowerForSquare(state, from, mover.team);
  if (!shadower) {
    return { state, shadowed: false };
  }

  // If the vacated square is not actually free (another player occupies it),
  // Shadowing cannot follow — bail out without consuming the per-turn use.
  const occupants = options.occupantIds ?? [];
  if (occupants.length > 0) {
    return { state, shadowed: false, shadower };
  }

  const roll = rollShadowingCheck({
    shadowerMa: shadower.ma,
    targetMa: mover.ma,
    rng,
  });

  // Consume the per-turn use regardless of outcome: the attempt happened.
  let next: GameState = markShadowingUsed(state, shadower.id);

  const logEntry = createLogEntry(
    'dice',
    `Shadowing (${shadower.name}): 2D6=${roll.diceRoll} + MA ${shadower.ma} - MA ${mover.ma} = ${roll.total}/${SHADOWING_TARGET} ${roll.success ? '✓' : '✗'}`,
    shadower.id,
    shadower.team,
    {
      diceRoll: roll.diceRoll,
      dice: roll.dice,
      maModifier: roll.maModifier,
      total: roll.total,
      targetNumber: SHADOWING_TARGET,
      success: roll.success,
    },
  );
  next = { ...next, gameLog: [...next.gameLog, logEntry] };

  if (!roll.success) {
    return { state: next, shadowed: false, shadower, roll };
  }

  // Success: move the shadower onto `from`.
  const players = next.players.map(p =>
    p.id === shadower.id ? { ...p, pos: { x: from.x, y: from.y } } : p,
  );
  next = { ...next, players };

  return { state: next, shadowed: true, shadower, roll };
}
