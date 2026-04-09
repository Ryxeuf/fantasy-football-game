/**
 * Block animation effects — visual feedback for block impacts and knockdowns.
 * Pure functions, no DOM/React dependencies.
 */

import type { Player } from "@bb/game-engine";

/* ── Types ──────────────────────────────────────────────────────────── */

export type EffectType = "impact" | "knockdown" | "push";

export interface VisualEffect {
  targetId: string;
  effect: EffectType;
  duration: number;
  elapsed: number;
  color: number;
}

export interface KnockdownEvent {
  playerId: string;
  type: "stunned" | "knocked_out" | "casualty";
}

/* ── Shake offset — damped sinusoidal oscillation ───────────────────── */

const SHAKE_AMPLITUDE = 3; // max pixel displacement
const SHAKE_FREQUENCY = 4; // oscillation cycles during the effect

/**
 * Compute a shake offset at a given animation progress (0..1).
 * Uses damped sinusoidal oscillation: amplitude decreases linearly.
 */
export function shakeOffset(progress: number): { dx: number; dy: number } {
  const damping = 1 - progress; // linear decay: 1 at start, 0 at end
  const angle = progress * SHAKE_FREQUENCY * Math.PI * 2;
  return {
    dx: Math.sin(angle) * SHAKE_AMPLITUDE * damping,
    dy: Math.cos(angle * 0.7) * SHAKE_AMPLITUDE * damping * 0.5,
  };
}

/* ── EffectManager ──────────────────────────────────────────────────── */

const MAX_FLASH_ALPHA = 0.7;

export interface EffectManager {
  add(effect: Omit<VisualEffect, "elapsed">): void;
  tick(deltaMs: number): void;
  isActive(): boolean;
  getActiveEffects(): ReadonlyArray<VisualEffect>;
  getProgress(targetId: string): number;
  getFlashAlpha(targetId: string): number;
  clear(): void;
}

export function createEffectManager(): EffectManager {
  const effects: VisualEffect[] = [];

  function add(effect: Omit<VisualEffect, "elapsed">): void {
    effects.push({ ...effect, elapsed: 0 });
  }

  function tick(deltaMs: number): void {
    for (let i = effects.length - 1; i >= 0; i--) {
      effects[i].elapsed += deltaMs;
      if (effects[i].elapsed >= effects[i].duration) {
        effects.splice(i, 1);
      }
    }
  }

  function isActive(): boolean {
    return effects.length > 0;
  }

  function getActiveEffects(): ReadonlyArray<VisualEffect> {
    return effects;
  }

  function getProgress(targetId: string): number {
    const effect = effects.find((e) => e.targetId === targetId);
    if (!effect) return -1;
    return Math.min(effect.elapsed / effect.duration, 1);
  }

  function getFlashAlpha(targetId: string): number {
    const progress = getProgress(targetId);
    if (progress < 0) return 0;
    // Fade out linearly
    return MAX_FLASH_ALPHA * (1 - progress);
  }

  function clear(): void {
    effects.length = 0;
  }

  return { add, tick, isActive, getActiveEffects, getProgress, getFlashAlpha, clear };
}

/* ── Knockdown detection — pure function comparing player states ──── */

/**
 * Compare two player arrays and detect knockdown transitions.
 * A knockdown is detected when a player transitions from
 * non-stunned to stunned, or from 'active' state to 'knocked_out'/'casualty'.
 */
export function detectKnockdowns(
  prev: ReadonlyArray<Player>,
  next: ReadonlyArray<Player>,
): KnockdownEvent[] {
  const prevMap = new Map(prev.map((p) => [p.id, p]));
  const events: KnockdownEvent[] = [];

  for (const player of next) {
    const prevPlayer = prevMap.get(player.id);
    if (!prevPlayer) continue; // new player, no transition

    // Detect stunned transition (field knockdown)
    if (player.stunned && !prevPlayer.stunned) {
      events.push({ playerId: player.id, type: "stunned" });
      continue;
    }

    // Detect state transitions to KO or casualty
    const prevState = prevPlayer.state ?? "active";
    const nextState = player.state ?? "active";

    if (prevState === "active" && nextState === "knocked_out") {
      events.push({ playerId: player.id, type: "knocked_out" });
    } else if (prevState === "active" && nextState === "casualty") {
      events.push({ playerId: player.id, type: "casualty" });
    }
  }

  return events;
}
