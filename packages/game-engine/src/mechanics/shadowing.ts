/**
 * Shadowing (BB3 Season 2/3 rules).
 *
 * When an active opposing player attempts to Dodge out of the tackle zone of
 * a standing player with the Shadowing skill, after the Dodge has been
 * resolved the shadower may attempt to follow.
 *
 * Resolution: roll 2D6 and add the shadower's MA, minus the dodging player's
 * MA. If the total is >= 7, the shadower immediately moves into the square
 * vacated by the dodging player. This does not cost the shadower any MA and
 * does not require the shadower to have remaining movement.
 *
 * Primary user in the prioritized rosters: Lizardmen Chameleon Skink.
 */

import type { GameState, Player, Position, RNG } from '../core/types';
import { hasSkill } from '../skills/skill-effects';
import { isAdjacent, getAdjacentOpponents } from './movement';
import { rollD6 } from '../utils/dice';
import { createLogEntry } from '../utils/logging';

/**
 * Target number for a successful Shadowing roll (2D6 + MA diff).
 */
export const SHADOWING_TARGET = 7;

/**
 * Result of a single Shadowing 2D6 roll.
 */
export interface ShadowingResult {
  dice: [number, number];
  total: number;
  target: number;
  success: boolean;
}

/**
 * Structured outcome of a Shadowing attempt, returning the updated state.
 */
export interface ShadowingAttempt {
  state: GameState;
  applied: boolean;
  roll: ShadowingResult;
}

/**
 * Returns true if the player has the Shadowing skill.
 */
export function hasShadowing(player: Player): boolean {
  return hasSkill(player, 'shadowing');
}

/**
 * Finds all active opposing players who:
 * - have the Shadowing skill,
 * - are adjacent to the square the dodger left,
 * - are in a state allowed to shadow (standing, not stunned/KO/casualty/sent-off),
 * - have not already attempted Shadowing this team turn (BB3: one attempt per pursuer per turn).
 */
export function findShadowingCandidates(
  state: GameState,
  dodger: Player,
  vacatedSquare: Position,
): Player[] {
  const adjacentOpponents = getAdjacentOpponents(state, vacatedSquare, dodger.team);
  const alreadyUsed = state.usedShadowingThisTurn ?? [];
  return adjacentOpponents.filter((opponent) => {
    if (!hasShadowing(opponent)) return false;
    if (opponent.stunned) return false;
    const playerState = opponent.state;
    if (playerState && playerState !== 'active') return false;
    if (alreadyUsed.includes(opponent.id)) return false;
    return true;
  });
}

/**
 * Performs the 2D6 Shadowing roll using the seeded RNG.
 *
 * The total equals 2D6 + shadower.MA - dodger.MA. The attempt succeeds when
 * the total is greater than or equal to {@link SHADOWING_TARGET}.
 */
export function rollShadowing(
  shadower: Player,
  dodger: Player,
  rng: RNG,
): ShadowingResult {
  const d1 = rollD6(rng);
  const d2 = rollD6(rng);
  const maDiff = shadower.ma - dodger.ma;
  const total = d1 + d2 + maDiff;
  return {
    dice: [d1, d2],
    total,
    target: SHADOWING_TARGET,
    success: total >= SHADOWING_TARGET,
  };
}

/**
 * Returns true when the destination square for the shadower (the square the
 * dodger just left) is free of any active player.
 */
function isSquareFree(state: GameState, square: Position): boolean {
  return !state.players.some(
    (p) =>
      p.pos.x === square.x &&
      p.pos.y === square.y &&
      p.state !== 'knocked_out' &&
      p.state !== 'casualty' &&
      p.state !== 'sent_off',
  );
}

/**
 * Attempts to shadow: rolls the 2D6 and, on success, moves the shadower into
 * the vacated square. Always appends a log entry describing the attempt.
 *
 * Does not mutate the input state: the returned {@link ShadowingAttempt}
 * carries a new GameState.
 */
export function tryApplyShadowing(
  state: GameState,
  dodger: Player,
  shadower: Player,
  vacatedSquare: Position,
  rng: RNG,
): ShadowingAttempt {
  const roll = rollShadowing(shadower, dodger, rng);
  const canMoveInto = isSquareFree(state, vacatedSquare);
  const applied = roll.success && canMoveInto;

  const logEntry = createLogEntry(
    'dice',
    `Shadowing: ${shadower.name} tente de suivre ${dodger.name} — ` +
      `2D6=${roll.dice[0]}+${roll.dice[1]} + MA(${shadower.ma}-${dodger.ma})=${roll.total}/${roll.target} ` +
      `${applied ? '✓ suit' : '✗ reste'}`,
    shadower.id,
    shadower.team,
    {
      dice: roll.dice,
      total: roll.total,
      target: roll.target,
      success: roll.success,
      moved: applied,
    },
  );

  const nextPlayers = applied
    ? state.players.map((p) =>
        p.id === shadower.id ? { ...p, pos: { ...vacatedSquare } } : p,
      )
    : state.players.map((p) => p);

  const nextState: GameState = {
    ...state,
    players: nextPlayers,
    gameLog: [...state.gameLog, logEntry],
  };

  return { state: nextState, applied, roll };
}

/**
 * Returns true when at least one active opponent adjacent to `from` has
 * Shadowing — convenience helper for callers that only want to know if a
 * Shadowing check is needed.
 *
 * The `from` argument is the square the dodger is leaving. `isAdjacent` is
 * used indirectly through {@link findShadowingCandidates}; the helper is
 * re-exported here to remain self-contained.
 */
export function isShadowingPossible(
  state: GameState,
  dodger: Player,
  from: Position,
): boolean {
  return findShadowingCandidates(state, dodger, from).length > 0;
}

/**
 * Resolves all Shadowing opportunities triggered when `dodger` leaves
 * `vacatedSquare`. Each eligible opponent rolls in turn; the first successful
 * roll moves the shadower into the vacated square and stops the loop (only
 * one body can occupy the square).
 *
 * Each attempt (success or failure) marks the shadower as having used their
 * one Shadowing attempt for this team turn (BB3 rule).
 *
 * Returns the updated state; no mutation of the input.
 */
export function resolveShadowingAfterDodge(
  state: GameState,
  dodger: Player,
  vacatedSquare: Position,
  rng: RNG,
): GameState {
  const candidates = findShadowingCandidates(state, dodger, vacatedSquare);
  if (candidates.length === 0) return state;

  let working = state;
  for (const candidate of candidates) {
    const freshShadower = working.players.find((p) => p.id === candidate.id);
    if (!freshShadower) continue;
    const freshDodger = working.players.find((p) => p.id === dodger.id) ?? dodger;
    const attempt = tryApplyShadowing(working, freshDodger, freshShadower, vacatedSquare, rng);
    working = attempt.state;
    // Mark the shadower as having used their one attempt this turn (BB3).
    working = markShadowingUsed(working, freshShadower.id);
    if (attempt.applied) {
      // Only one shadower can follow into the vacated square.
      break;
    }
  }
  return working;
}

/**
 * Records that a player has used their Shadowing attempt for this team turn.
 */
function markShadowingUsed(state: GameState, playerId: string): GameState {
  const current = state.usedShadowingThisTurn ?? [];
  if (current.includes(playerId)) return state;
  return { ...state, usedShadowingThisTurn: [...current, playerId] };
}

// Re-export isAdjacent for downstream helpers/tests that want it alongside.
export { isAdjacent };
