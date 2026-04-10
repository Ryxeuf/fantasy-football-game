import * as React from "react";
import type { GameLogEntry, TeamId } from "@bb/game-engine";
import {
  type DiceAnimation,
  detectDiceRollEvents,
  createDiceAnimation,
  updateDiceAnimation,
  getDiceDisplayValue,
  getDiceAlpha,
  TUMBLE_PHASE_MS,
} from "./diceEffects";

/* ── Types ─────────────────────────────────────────────────────────── */

export interface DiceOverlay {
  /** Current displayed value (cycles during tumble, final after) */
  displayValue: number;
  /** The final/actual dice value */
  finalValue: number;
  /** Whether currently in tumble phase */
  isTumbling: boolean;
  /** Whether the roll succeeded */
  success?: boolean;
  /** Team that rolled (for color) */
  team?: TeamId;
  /** Alpha (opacity) 0..1 */
  alpha: number;
  /** Roll description message */
  message: string;
}

export interface DiceEffects {
  /** Active dice overlays (usually 0-1, can be multiple for rapid rolls) */
  dice: ReadonlyArray<DiceOverlay>;
  /** True while any dice animation is playing */
  animating: boolean;
}

/* ── Hook ──────────────────────────────────────────────────────────── */

/**
 * Detects dice roll events from game log changes and returns visual effect data.
 * Shows animated tumbling dice that settle on the final value.
 */
export function useDiceEffects(
  gameLog: ReadonlyArray<GameLogEntry>,
): DiceEffects {
  const prevLogRef = React.useRef<ReadonlyArray<GameLogEntry>>([]);
  const rafRef = React.useRef<number>(0);
  const lastTimeRef = React.useRef<number>(0);
  const animationsRef = React.useRef<DiceAnimation[]>([]);

  const [overlays, setOverlays] = React.useState<ReadonlyArray<DiceOverlay>>(
    [],
  );

  // Detect dice roll events and start animations
  React.useEffect(() => {
    const prev = prevLogRef.current;
    prevLogRef.current = gameLog;

    if (prev.length === 0 && gameLog.length === 0) return;

    const events = detectDiceRollEvents(prev, gameLog);
    if (events.length === 0) return;

    // Only animate events that have a numeric dice value
    const animatable = events.filter((e) => typeof e.diceRoll === "number");
    if (animatable.length === 0) return;

    // Add new animations (keep only the latest to avoid clutter)
    for (const event of animatable) {
      animationsRef.current = [
        ...animationsRef.current,
        createDiceAnimation(event),
      ];
    }

    // Start the RAF loop if not already running
    if (rafRef.current === 0) {
      lastTimeRef.current = performance.now();
      const loop = (now: number) => {
        const delta = now - lastTimeRef.current;
        lastTimeRef.current = now;

        // Update all animations, remove completed ones
        animationsRef.current = animationsRef.current
          .map((a) => updateDiceAnimation(a, delta))
          .filter((a): a is DiceAnimation => a !== null);

        if (animationsRef.current.length > 0) {
          const rendered: DiceOverlay[] = animationsRef.current
            .filter((a) => typeof a.finalValue === "number")
            .map((a) => {
              const finalValue = a.finalValue!;
              return {
                displayValue: getDiceDisplayValue(finalValue, a.elapsed),
                finalValue,
                isTumbling: a.elapsed < TUMBLE_PHASE_MS,
                success: a.success,
                team: a.team,
                alpha: getDiceAlpha(a.elapsed),
                message: a.message,
              };
            });

          setOverlays(rendered);
          rafRef.current = requestAnimationFrame(loop);
        } else {
          setOverlays([]);
          rafRef.current = 0;
        }
      };
      rafRef.current = requestAnimationFrame(loop);
    }
  }, [gameLog]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (rafRef.current !== 0) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, []);

  return {
    dice: overlays,
    animating: overlays.length > 0,
  };
}
