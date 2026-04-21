/**
 * AI kickoff ball placement — picks a legal ball position during the
 * `place-ball` step of the kickoff sequence when the AI is the kicking team.
 *
 * Fixes the bug where an online practice match would hang on the ball
 * placement step: no client submits on behalf of the AI, so the kickoff
 * sequence never advances past `place-ball`.
 *
 * Strategy: place the ball in the centre of the receiving team's half.
 * This is always legal (see `placeKickoffBall` bounds check) and produces
 * a fair, predictable deviation target.
 *
 * Pure function: no side effects, deterministic for a given input.
 */
import type { Position, TeamId } from '../core/types';
import type { ExtendedGameState } from '../core/game-state';

const CENTER_Y = 7;
const RECEIVER_A_CENTER_X = 7; // receiver A → x in [1, 12]
const RECEIVER_B_CENTER_X = 18; // receiver B → x in [13, 24]

/**
 * Pick a legal kickoff ball position for the AI (kicking team).
 *
 * The receiving team is derived from `state.preMatch.receivingTeam`; falls
 * back to the opposite of `aiTeam` if that field is missing. The returned
 * position is guaranteed to satisfy the bounds enforced by
 * `placeKickoffBall`.
 */
export function pickAIKickoffBallPosition(
  state: ExtendedGameState,
  aiTeam: TeamId,
): Position {
  const receivingTeam: TeamId =
    state.preMatch?.receivingTeam ?? (aiTeam === 'A' ? 'B' : 'A');
  const x = receivingTeam === 'A' ? RECEIVER_A_CENTER_X : RECEIVER_B_CENTER_X;
  return { x, y: CENTER_Y };
}
