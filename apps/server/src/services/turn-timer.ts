/**
 * Turn timer service for enforcing configurable turn time limits.
 * B1.10 — Timer de tour configurable avec fin de tour auto.
 *
 * When a turn starts, a timer is scheduled. If the active player
 * does not end their turn before the timer fires, the server
 * automatically submits an END_TURN move on their behalf.
 */

/** Default turn timer: 120 seconds (matches FULL_RULES.turnTimerSeconds). */
export const DEFAULT_TURN_TIMER_MS = 120_000;

/**
 * Active turn timers indexed by matchId.
 * Each value stores the timeout handle and the deadline timestamp.
 */
const turnTimers = new Map<
  string,
  { timer: ReturnType<typeof setTimeout>; deadline: number }
>();

/**
 * Start a turn timer for a match.
 * When the timer fires, `onExpire(matchId)` is called.
 * If a timer already exists for this match, this is a no-op.
 */
export function startTurnTimer(
  matchId: string,
  durationMs: number,
  onExpire: (matchId: string) => void,
): void {
  if (turnTimers.has(matchId)) {
    return;
  }

  const deadline = Date.now() + durationMs;
  const timer = setTimeout(() => {
    turnTimers.delete(matchId);
    onExpire(matchId);
  }, durationMs);

  turnTimers.set(matchId, { timer, deadline });
}

/**
 * Cancel a pending turn timer for a match.
 */
export function cancelTurnTimer(matchId: string): void {
  const entry = turnTimers.get(matchId);
  if (entry) {
    clearTimeout(entry.timer);
    turnTimers.delete(matchId);
  }
}

/**
 * Reset the turn timer for a match: cancels any existing timer
 * and starts a fresh one with the given duration.
 */
export function resetTurnTimer(
  matchId: string,
  durationMs: number,
  onExpire: (matchId: string) => void,
): void {
  cancelTurnTimer(matchId);
  startTurnTimer(matchId, durationMs, onExpire);
}

/**
 * Get the deadline timestamp for a match's turn timer.
 * Returns undefined if no timer is active.
 */
export function getTurnTimerDeadline(matchId: string): number | undefined {
  return turnTimers.get(matchId)?.deadline;
}

/** Get the map of active turn timers (for testing). */
export function getActiveTurnTimers(): Map<string, { timer: ReturnType<typeof setTimeout>; deadline: number }> {
  return turnTimers;
}

/** Clear all turn timers (for testing / server shutdown). */
export function resetAllTurnTimers(): void {
  for (const entry of turnTimers.values()) {
    clearTimeout(entry.timer);
  }
  turnTimers.clear();
}
