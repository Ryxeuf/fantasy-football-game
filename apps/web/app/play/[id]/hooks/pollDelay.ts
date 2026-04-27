/**
 * Poll delay computation for the game-state fallback polling loop (S24.5).
 *
 * Strategy:
 *   - WebSocket connected → slow heartbeat (30 s) — WS is the primary channel.
 *   - WebSocket disconnected → start at 10 s (anti-stampede vs the previous
 *     3 s value) and apply exponential backoff on consecutive failures,
 *     capped at 60 s to keep recovery latency reasonable.
 *
 * The function is pure and side-effect-free so it can be unit-tested
 * without mounting the React hook.
 */

export const WS_CONNECTED_DELAY_MS = 30_000;
export const BASE_FALLBACK_DELAY_MS = 10_000;
export const MAX_FALLBACK_DELAY_MS = 60_000;

export interface PollDelayInput {
  wsConnected: boolean;
  failureCount: number;
}

export function computePollDelay({
  wsConnected,
  failureCount,
}: PollDelayInput): number {
  if (wsConnected) {
    return WS_CONNECTED_DELAY_MS;
  }
  const safeCount = Math.max(0, failureCount);
  const delay = BASE_FALLBACK_DELAY_MS * 2 ** safeCount;
  return Math.min(delay, MAX_FALLBACK_DELAY_MS);
}
