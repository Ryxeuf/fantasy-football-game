import * as React from "react";
import type { Player, Position } from "@bb/game-engine";
import {
  type AnimPosition,
  type AnimationItem,
  createAnimationQueue,
  diffPositions,
} from "./animation";

/* ── Constants ───────────────────────────────────────────────────────── */

const MOVE_DURATION_MS = 200;
const BALL_DURATION_MS = 250;
const BALL_KEY = "__ball__";

/* ── Build snapshot from game state ──────────────────────────────────── */

function buildSnapshot(
  players: Player[],
  ball: Position | undefined,
): Record<string, AnimPosition> {
  const map: Record<string, AnimPosition> = {};
  for (const p of players) {
    if (p.pos.x >= 0 && p.pos.y >= 0) {
      map[p.id] = { x: p.pos.x, y: p.pos.y };
    }
  }
  if (ball && ball.x >= 0 && ball.y >= 0) {
    map[BALL_KEY] = { x: ball.x, y: ball.y };
  }
  return map;
}

/* ── Hook ─────────────────────────────────────────────────────────────── */

export interface AnimatedPositions {
  /** Overridden positions for players currently animating (id → pixel-grid pos) */
  players: Record<string, AnimPosition>;
  /** Overridden ball position while animating, or null */
  ball: AnimPosition | null;
  /** True while any animation is playing */
  animating: boolean;
}

/**
 * Detects position changes between renders and smoothly tweens them.
 * Returns animated position overrides for the renderer.
 */
export function useAnimatedPositions(
  players: Player[],
  ball: Position | undefined,
): AnimatedPositions {
  const queueRef = React.useRef(createAnimationQueue());
  const prevSnapshotRef = React.useRef<Record<string, AnimPosition>>({});
  const rafRef = React.useRef<number>(0);
  const lastTimeRef = React.useRef<number>(0);
  const [positions, setPositions] = React.useState<
    Record<string, AnimPosition>
  >({});

  // Detect position changes and enqueue animations
  React.useEffect(() => {
    const snapshot = buildSnapshot(players, ball);
    const prev = prevSnapshotRef.current;
    const diffs = diffPositions(prev, snapshot);
    prevSnapshotRef.current = snapshot;

    if (diffs.length === 0) return;

    const queue = queueRef.current;
    const items: AnimationItem[] = diffs.map((d) => ({
      type: d.id === BALL_KEY ? ("ball" as const) : ("player" as const),
      id: d.id,
      from: d.from,
      to: d.to,
      duration: d.id === BALL_KEY ? BALL_DURATION_MS : MOVE_DURATION_MS,
    }));

    // Animate all diffs from this state change in parallel
    queue.enqueueParallel(items);

    // Start the RAF loop if not already running
    if (rafRef.current === 0) {
      lastTimeRef.current = performance.now();
      const loop = (now: number) => {
        const delta = now - lastTimeRef.current;
        lastTimeRef.current = now;
        queue.tick(delta);

        if (queue.isAnimating()) {
          setPositions({ ...queue.getAnimatedPositions() });
          rafRef.current = requestAnimationFrame(loop);
        } else {
          setPositions({});
          rafRef.current = 0;
        }
      };
      rafRef.current = requestAnimationFrame(loop);
    }
  }, [players, ball]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (rafRef.current !== 0) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, []);

  const animating = Object.keys(positions).length > 0;

  return {
    players: Object.fromEntries(
      Object.entries(positions).filter(([id]) => id !== BALL_KEY),
    ),
    ball: positions[BALL_KEY] ?? null,
    animating,
  };
}
