/**
 * Turn timer orchestrator.
 * Manages the lifecycle of per-match turn timers:
 * - Starts/resets timers when the active player changes after a move.
 * - Auto-submits END_TURN when the timer expires.
 * - Broadcasts timer events to connected clients.
 */
import { resetTurnTimer, cancelTurnTimer, getTurnTimerDeadline } from "./turn-timer";
import { broadcastTurnTimerStarted } from "./game-broadcast";
import { processMove } from "./move-processor";
import { serverLog } from "../utils/server-log";

export const TURN_TIMER_CONFIG_KEY = "turnTimerSeconds";

/**
 * Map of matchId → userId of the player whose turn it currently is.
 * Needed to submit END_TURN on behalf of the correct user when the timer fires.
 */
const matchCurrentUser = new Map<string, string>();

/**
 * Called after a move is processed. Decides whether to start/reset/cancel the turn timer.
 *
 * @param matchId        - The match ID
 * @param prevPlayer     - The team side (A/B) that was playing before the move
 * @param nextPlayer     - The team side (A/B) that plays after the move
 * @param turnTimerSecs  - Timer duration in seconds (0 = disabled)
 * @param gamePhase      - Current game phase (optional, 'ended' cancels timer)
 * @param nextUserId     - The userId of the next active player
 */
export function handleTurnTimerAfterMove(
  matchId: string,
  prevPlayer: string,
  nextPlayer: string,
  turnTimerSecs: number,
  gamePhase?: string,
  nextUserId?: string,
): void {
  // Cancel timer if match ended
  if (gamePhase === "ended") {
    cancelTurnTimer(matchId);
    matchCurrentUser.delete(matchId);
    return;
  }

  // No timer if disabled
  if (!turnTimerSecs || turnTimerSecs <= 0) {
    return;
  }

  // Only reset timer when the active player actually changes (turn switch)
  if (prevPlayer === nextPlayer) {
    return;
  }

  const durationMs = turnTimerSecs * 1000;

  // Track who will need END_TURN submitted on their behalf
  if (nextUserId) {
    matchCurrentUser.set(matchId, nextUserId);
  }

  // Reset the timer (cancel old + start new)
  resetTurnTimer(matchId, durationMs, (expiredMatchId) => {
    const userId = matchCurrentUser.get(expiredMatchId);
    if (userId) {
      void handleTurnTimerAutoEnd(expiredMatchId, userId);
    }
    matchCurrentUser.delete(expiredMatchId);
  });

  // Broadcast timer info to all connected clients
  const deadline = getTurnTimerDeadline(matchId);
  if (deadline) {
    broadcastTurnTimerStarted(matchId, deadline, turnTimerSecs);
  }
}

/**
 * Called when a turn timer expires. Submits END_TURN on behalf of the timed-out player.
 */
export async function handleTurnTimerAutoEnd(
  matchId: string,
  userId: string,
): Promise<void> {
  try {
    const result = await processMove(matchId, userId, { type: "END_TURN" });
    if (result.success) {
      serverLog.log(
        `[turn-timer] Auto-ended turn for match ${matchId} (user ${userId})`,
      );
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    serverLog.error(
      `[turn-timer] Failed to auto-end turn for match ${matchId}: ${msg}`,
    );
  }
}
