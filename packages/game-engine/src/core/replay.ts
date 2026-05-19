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
 * Garde structurelle minimale d'un GameState. On ne valide pas tout le
 * schema (trop large, evolue souvent) — juste les champs critiques pour
 * detecter un JSON corrompu / d'un autre format.
 *
 * Audit 2026-05-19 bug B2 : avant, `JSON.parse` levait sans try/catch
 * et un objet manquant des champs requis (rosters anciens) passait
 * silencieusement, faisant crasher les frames downstream.
 */
function isPlausibleGameState(value: unknown): value is GameState {
  if (value == null || typeof value !== 'object') return false;
  const state = value as Record<string, unknown>;
  if (!Array.isArray(state.players)) return false;
  if (typeof state.turn !== 'number') return false;
  if (typeof state.half !== 'number') return false;
  if (state.score == null || typeof state.score !== 'object') return false;
  return true;
}

/**
 * Parse tolerant d'un GameState : accepte object natif, string JSON,
 * ou retourne `null` si invalide (JSON malforme OU schema implausible).
 *
 * Logs `console.warn` en cas d'erreur pour aider au debug replay.
 */
export function parseReplayGameState(
  raw: GameState | string | undefined | null
): GameState | null {
  if (raw == null) return null;
  let parsed: unknown;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.warn('[replay] JSON.parse failed:', err);
      return null;
    }
  } else {
    parsed = raw;
  }
  if (!isPlausibleGameState(parsed)) {
    console.warn('[replay] gameState shape invalid (missing players/turn/half/score)');
    return null;
  }
  return parsed;
}

/**
 * Builds an ordered array of replay frames from raw turn payloads.
 * Skips turns that have no gameState (e.g. accept, meta turns) ou dont
 * le gameState est invalide (corrupted JSON, mauvais schema).
 */
export function buildReplayFrames(turns: ReplayTurnPayload[]): ReplayFrame[] {
  const frames: ReplayFrame[] = [];

  for (const turn of turns) {
    const gameState = parseReplayGameState(turn.gameState);
    if (gameState == null) continue;

    frames.push({
      index: frames.length,
      gameState,
      moveType: turn.move?.type as string | undefined,
      timestamp: turn.timestamp,
    });
  }

  return frames;
}
