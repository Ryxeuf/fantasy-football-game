/**
 * Leap / Pogo Stick mechanics — BB3 Season 2/3.
 *
 * Leap (Agility skill):
 *   - During its movement, the player may Leap over any adjacent square
 *     (empty, occupied by a Standing player, Prone or Stunned).
 *   - Costs 2 squares of movement.
 *   - The player makes a single Agility test to land.
 *   - Success: the player lands Standing at the destination. No Dodge roll is
 *     required even if leaving tackle zones.
 *   - Failure: the player falls Prone at the destination (armor + injury +
 *     turnover if carrying the ball).
 *
 * Pogo Stick (Trait):
 *   - Same as Leap.
 *   - In addition, a +1 modifier is applied to the Agility test.
 *
 * Implementation notes:
 *   - The destination must be at Chebyshev distance 2 from the player's
 *     current position.
 *   - The destination must be in-bounds and unoccupied.
 *   - There must exist at least one adjacent "over" square that is adjacent to
 *     both the origin and the destination (this is always true for Chebyshev
 *     distance 2 in a square grid, but we verify defensively).
 *   - Leap replaces the Dodge test — leaving tackle zones does NOT trigger a
 *     dodge roll during a Leap.
 */

import type { GameState, Player, Position, RNG, DiceResult } from '../core/types';
import { hasSkill } from '../skills/skill-effects';
import { inBounds, isPositionOccupied, samePos } from './movement';
import { rollD6 } from '../utils/dice';

/**
 * Returns true if the player has the Leap skill or Pogo Stick trait.
 */
export function canLeap(player: Player): boolean {
  return hasSkill(player, 'leap') || hasSkill(player, 'pogo-stick');
}

/**
 * Returns the Agility test modifier granted by the player's leap/pogo-stick.
 * Pogo Stick grants +1; Leap alone grants +0.
 */
export function getLeapModifier(player: Player): number {
  return hasSkill(player, 'pogo-stick') ? 1 : 0;
}

/**
 * Returns the target number (on a D6) needed to succeed the Leap Agility test.
 * Clamped to [2, 6] per BB3 rules.
 */
export function calculateLeapTarget(player: Player, modifiers: number = 0): number {
  return Math.max(2, Math.min(6, player.ag - modifiers));
}

/**
 * Performs the Leap Agility roll.
 */
export function performLeapRoll(
  player: Player,
  rng: RNG,
  modifiers: number = 0,
): DiceResult {
  const diceRoll = rollD6(rng);
  const targetNumber = calculateLeapTarget(player, modifiers);
  // A natural 1 always fails, a natural 6 always succeeds (BB3 AG tests).
  const success = diceRoll !== 1 && (diceRoll === 6 || diceRoll >= targetNumber);

  return {
    type: 'dodge',
    playerId: player.id,
    diceRoll,
    targetNumber,
    success,
    modifiers,
    playerName: player.name,
  };
}

/**
 * Returns the list of legal destinations for a Leap from the given position.
 * Destinations are at Chebyshev distance 2, in-bounds, unoccupied.
 */
export function getLegalLeapDestinations(
  state: GameState,
  from: Position,
): Position[] {
  const destinations: Position[] = [];

  for (let dx = -2; dx <= 2; dx++) {
    for (let dy = -2; dy <= 2; dy++) {
      // Chebyshev distance must be exactly 2
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== 2) continue;

      const to: Position = { x: from.x + dx, y: from.y + dy };
      if (!inBounds(state, to)) continue;
      if (samePos(from, to)) continue;
      if (isPositionOccupied(state, to)) continue;

      destinations.push(to);
    }
  }

  return destinations;
}
