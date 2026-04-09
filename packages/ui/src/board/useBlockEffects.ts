import * as React from "react";
import type { Player } from "@bb/game-engine";
import {
  type EffectManager,
  type VisualEffect,
  createEffectManager,
  detectKnockdowns,
  shakeOffset,
} from "./blockEffects";

/* ── Constants ──────────────────────────────────────────────────────── */

const IMPACT_DURATION_MS = 200;
const KNOCKDOWN_DURATION_MS = 300;

const EFFECT_COLORS: Record<string, number> = {
  stunned: 0xff4444, // red flash for stun
  knocked_out: 0xff8800, // orange for KO
  casualty: 0xff0000, // deep red for casualty
};

/* ── Hook return type ───────────────────────────────────────────────── */

export interface BlockEffectOverlay {
  targetId: string;
  /** Shake offset in grid units (add to rendered x/y) */
  shakeX: number;
  shakeY: number;
  /** Flash ring alpha (0 = invisible, 0.7 = full) */
  flashAlpha: number;
  /** Flash ring color */
  flashColor: number;
}

export interface BlockEffects {
  /** Active effect overlays keyed by player id */
  overlays: Record<string, BlockEffectOverlay>;
  /** True while any block effect is playing */
  animating: boolean;
}

/**
 * Detects block-related state transitions and returns visual effect overlays.
 * Renders shake + flash effects on players who get knocked down.
 */
export function useBlockEffects(players: Player[]): BlockEffects {
  const managerRef = React.useRef<EffectManager>(createEffectManager());
  const prevPlayersRef = React.useRef<Player[]>([]);
  const rafRef = React.useRef<number>(0);
  const lastTimeRef = React.useRef<number>(0);
  const [overlays, setOverlays] = React.useState<
    Record<string, BlockEffectOverlay>
  >({});

  // Detect knockdown transitions and enqueue effects
  React.useEffect(() => {
    const prev = prevPlayersRef.current;
    prevPlayersRef.current = players;

    if (prev.length === 0) return;

    const events = detectKnockdowns(prev, players);
    if (events.length === 0) return;

    const manager = managerRef.current;

    for (const event of events) {
      const duration =
        event.type === "stunned" ? IMPACT_DURATION_MS : KNOCKDOWN_DURATION_MS;
      const color = EFFECT_COLORS[event.type] ?? 0xff0000;

      manager.add({
        targetId: event.playerId,
        effect: event.type === "stunned" ? "impact" : "knockdown",
        duration,
        color,
      });
    }

    // Start the RAF loop if not already running
    if (rafRef.current === 0) {
      lastTimeRef.current = performance.now();
      const loop = (now: number) => {
        const delta = now - lastTimeRef.current;
        lastTimeRef.current = now;
        manager.tick(delta);

        if (manager.isActive()) {
          const newOverlays: Record<string, BlockEffectOverlay> = {};
          for (const effect of manager.getActiveEffects()) {
            const progress = manager.getProgress(effect.targetId);
            if (progress < 0) continue;
            const shake = shakeOffset(progress);
            newOverlays[effect.targetId] = {
              targetId: effect.targetId,
              shakeX: shake.dx,
              shakeY: shake.dy,
              flashAlpha: manager.getFlashAlpha(effect.targetId),
              flashColor: effect.color,
            };
          }
          setOverlays(newOverlays);
          rafRef.current = requestAnimationFrame(loop);
        } else {
          setOverlays({});
          rafRef.current = 0;
        }
      };
      rafRef.current = requestAnimationFrame(loop);
    }
  }, [players]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (rafRef.current !== 0) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, []);

  const animating = Object.keys(overlays).length > 0;

  return { overlays, animating };
}
