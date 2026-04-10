/**
 * Dice animation effects — animated 2D dice for roll results.
 * Pure functions, no DOM/React dependencies.
 *
 * Provides:
 * - Dice roll detection from game log changes
 * - Tumble animation (cycling through values before settling)
 * - Fade in → hold → fade out alpha math
 */

import type { GameLogEntry, TeamId } from "@bb/game-engine";

/* ── Constants ─────────────────────────────────────────────────────── */

/** Duration of the tumble phase (dice cycling through values) in ms */
export const TUMBLE_PHASE_MS = 600;

/** Duration of the hold phase (final value displayed) in ms */
export const HOLD_PHASE_MS = 500;

/** Fade-out phase at the end of hold in ms */
const FADE_OUT_MS = 300;

/** Total animation duration */
export const DICE_ANIMATION_DURATION_MS = TUMBLE_PHASE_MS + HOLD_PHASE_MS;

/** Fade-in duration at animation start */
const FADE_IN_MS = 100;

/** Tumble speed: how often the displayed value changes (ms per face) */
const TUMBLE_INTERVAL_MS = 60;

/* ── Types ─────────────────────────────────────────────────────────── */

export interface DiceRollEvent {
  /** The dice roll value (e.g. 1-6 for d6, sum for 2d6) */
  diceRoll?: number;
  /** Target number to beat */
  targetNumber?: number;
  /** Whether the roll succeeded */
  success?: boolean;
  /** Log message describing the roll */
  message: string;
  /** Team that rolled */
  team?: TeamId;
  /** Player who rolled */
  playerId?: string;
}

export interface DiceAnimation {
  /** The final value the dice should show */
  finalValue?: number;
  /** Whether the roll succeeded */
  success?: boolean;
  /** Team that rolled (for color) */
  team?: TeamId;
  /** Log message */
  message: string;
  /** Elapsed time in ms */
  elapsed: number;
  /** Total duration in ms */
  duration: number;
}

/* ── Dice roll detection ───────────────────────────────────────────── */

/**
 * Compare previous and next game logs to detect new dice roll entries.
 * Returns an array of DiceRollEvent for each new 'dice' type log entry.
 */
export function detectDiceRollEvents(
  prevLog: ReadonlyArray<GameLogEntry>,
  nextLog: ReadonlyArray<GameLogEntry>,
): DiceRollEvent[] {
  if (nextLog.length <= prevLog.length) return [];

  const newEntries = nextLog.slice(prevLog.length);
  const diceEntries = newEntries.filter((e) => e.type === "dice");

  return diceEntries.map((entry) => ({
    diceRoll: entry.details?.diceRoll as number | undefined,
    targetNumber: entry.details?.targetNumber as number | undefined,
    success: entry.details?.success as boolean | undefined,
    message: entry.message,
    team: entry.team,
    playerId: entry.playerId,
  }));
}

/* ── Animation creation ────────────────────────────────────────────── */

/**
 * Create a dice animation from a dice roll event.
 */
export function createDiceAnimation(event: DiceRollEvent): DiceAnimation {
  return {
    finalValue: event.diceRoll,
    success: event.success,
    team: event.team,
    message: event.message,
    elapsed: 0,
    duration: DICE_ANIMATION_DURATION_MS,
  };
}

/* ── Animation update (immutable) ──────────────────────────────────── */

/**
 * Advance a dice animation by deltaMs. Returns a new animation object,
 * or null if the animation has completed.
 */
export function updateDiceAnimation(
  anim: Readonly<DiceAnimation>,
  deltaMs: number,
): DiceAnimation | null {
  const newElapsed = anim.elapsed + deltaMs;
  if (newElapsed >= anim.duration) return null;
  return { ...anim, elapsed: newElapsed };
}

/* ── Display value (tumble effect) ─────────────────────────────────── */

/**
 * Compute the displayed dice value at a given elapsed time.
 * During the tumble phase, the value cycles through 1-6.
 * After the tumble phase, the final value is shown.
 */
export function getDiceDisplayValue(finalValue: number, elapsed: number): number {
  if (elapsed >= TUMBLE_PHASE_MS) return finalValue;

  // Cycle through 1-6 based on elapsed time
  const cycleIndex = Math.floor(elapsed / TUMBLE_INTERVAL_MS);
  return (cycleIndex % 6) + 1;
}

/* ── Alpha (opacity) ───────────────────────────────────────────────── */

/**
 * Compute the alpha (opacity) for the dice overlay at a given elapsed time.
 * Three phases: fade-in (quick), hold (full opacity), fade-out (gentle).
 */
export function getDiceAlpha(elapsed: number): number {
  if (elapsed >= DICE_ANIMATION_DURATION_MS) return 0;
  if (elapsed < 0) return 0;

  // Phase 1: Fade in (0 → 1)
  if (elapsed < FADE_IN_MS) {
    return elapsed / FADE_IN_MS;
  }

  // Phase 2: Full opacity during tumble + early hold
  const fadeOutStart = DICE_ANIMATION_DURATION_MS - FADE_OUT_MS;
  if (elapsed < fadeOutStart) {
    return 1;
  }

  // Phase 3: Fade out (1 → 0)
  const fadeOutProgress = (elapsed - fadeOutStart) / FADE_OUT_MS;
  return Math.max(0, 1 - fadeOutProgress);
}
