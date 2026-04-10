/**
 * Replay module — extracts ordered replay frames from stored turn payloads.
 * Each frame contains a full GameState snapshot for rendering.
 */

import type { GameState } from './types';

/** Shape of a stored turn payload as persisted by the server. */
export interface ReplayTurnPayload {
  type: string;
  gameState?: GameState | string;
  move?: Record<string, unknown>;
  timestamp?: string;
}

/** A single replay frame: one game state snapshot with metadata. */
export interface ReplayFrame {
  /** Sequential index within the replay (0-based). */
  index: number;
  /** Full game state at this point in the match. */
  gameState: GameState;
  /** The move type that produced this state (undefined for the initial state). */
  moveType?: string;
  /** ISO timestamp when this turn was recorded. */
  timestamp?: string;
}

/**
 * Builds an ordered array of replay frames from raw turn payloads.
 * Skips turns that have no gameState (e.g. accept, meta turns).
 * Handles both object and JSON-string encoded gameState.
 */
export function buildReplayFrames(turns: ReplayTurnPayload[]): ReplayFrame[] {
  const frames: ReplayFrame[] = [];

  for (const turn of turns) {
    if (turn.gameState == null) continue;

    const gameState: GameState =
      typeof turn.gameState === 'string'
        ? JSON.parse(turn.gameState)
        : turn.gameState;

    frames.push({
      index: frames.length,
      gameState,
      moveType: turn.move?.type as string | undefined,
      timestamp: turn.timestamp,
    });
  }

  return frames;
}
