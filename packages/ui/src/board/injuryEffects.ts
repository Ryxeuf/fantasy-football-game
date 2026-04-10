/**
 * Injury animation effects — visual icons for KO, casualty, and death.
 * Pure functions, no DOM/React dependencies.
 *
 * Provides:
 * - Injury transition detection from player state changes
 * - Icon type mapping (KO / casualty / dead)
 * - Float-up + fade animation math
 */

import type { Player, Position, CasualtyOutcome } from "@bb/game-engine";

/* ── Constants ─────────────────────────────────────────────────────── */

/** Total duration of the injury icon animation in ms */
export const INJURY_ICON_DURATION_MS = 1200;

/** Maximum float-up distance in grid cells */
const FLOAT_DISTANCE = 1.5;

/** Animation phases as fractions of total duration */
const FADE_IN_END = 0.15;
const HOLD_END = 0.6;
// FADE_OUT runs from HOLD_END to 1.0

/* ── Types ─────────────────────────────────────────────────────────── */

export type InjuryIconType = "ko" | "casualty" | "dead";

export interface InjuryEvent {
  playerId: string;
  iconType: InjuryIconType;
  /** Position where the icon should appear (player's position at time of injury) */
  pos: Position;
}

export interface InjuryIcon {
  playerId: string;
  iconType: InjuryIconType;
  pos: Position;
  elapsed: number;
  duration: number;
}

/* ── Icon colors and labels ───────────────────────────────────────── */

export const INJURY_ICON_COLORS: Record<InjuryIconType, number> = {
  ko: 0xff8800, // orange
  casualty: 0xff0000, // red
  dead: 0x8b0000, // dark red
};

export const INJURY_ICON_LABELS: Record<InjuryIconType, string> = {
  ko: "KO",
  casualty: "\u2620", // ☠ skull and crossbones
  dead: "\u2620", // ☠ skull and crossbones (same symbol, different color)
};

/* ── Injury transition detection ──────────────────────────────────── */

/**
 * Compare two player arrays and detect injury transitions.
 * A player transitioning from active to knocked_out or casualty triggers an event.
 * The casualtyResults map determines whether casualty is "dead" or generic.
 */
export function detectInjuryTransitions(
  prev: ReadonlyArray<Player>,
  next: ReadonlyArray<Player>,
  casualtyResults: Readonly<Record<string, CasualtyOutcome>>,
): InjuryEvent[] {
  const prevMap = new Map(prev.map((p) => [p.id, p]));
  const events: InjuryEvent[] = [];

  for (const player of next) {
    const prevPlayer = prevMap.get(player.id);
    if (!prevPlayer) continue; // new player, no transition

    const prevState = prevPlayer.state ?? "active";
    const nextState = player.state ?? "active";

    if (prevState === nextState) continue;

    if (prevState === "active" && nextState === "knocked_out") {
      events.push({
        playerId: player.id,
        iconType: "ko",
        pos: { ...prevPlayer.pos },
      });
    } else if (prevState === "active" && nextState === "casualty") {
      const outcome = casualtyResults[player.id];
      const iconType: InjuryIconType = outcome === "dead" ? "dead" : "casualty";
      events.push({
        playerId: player.id,
        iconType,
        pos: { ...prevPlayer.pos },
      });
    }
  }

  return events;
}

/* ── Icon animation math ──────────────────────────────────────────── */

/**
 * Compute the alpha (opacity) for an injury icon at a given progress (0..1).
 * Three phases: fade-in (0..FADE_IN_END), hold (..HOLD_END), fade-out (..1.0).
 */
export function getInjuryIconAlpha(progress: number): number {
  if (progress >= 1) return 0;
  if (progress < 0) return 0;

  if (progress < FADE_IN_END) {
    // Fade in: 0 → 1
    return progress / FADE_IN_END;
  }

  if (progress < HOLD_END) {
    // Hold at full opacity
    return 1;
  }

  // Fade out: 1 → 0
  const fadeOutProgress = (progress - HOLD_END) / (1 - HOLD_END);
  return Math.max(0, 1 - fadeOutProgress);
}

/**
 * Compute the vertical offset for the floating icon.
 * Moves upward (negative y) with ease-out deceleration.
 */
export function getInjuryIconOffsetY(progress: number): number {
  if (progress <= 0) return 0;
  const clamped = Math.min(progress, 1);
  // Ease-out: fast start, slow end
  const eased = 1 - (1 - clamped) * (1 - clamped);
  return -FLOAT_DISTANCE * eased;
}

/* ── Icon update (immutable) ──────────────────────────────────────── */

/**
 * Advance injury icons by deltaMs. Returns a new array with updated icons.
 * Icons that exceed their duration are removed.
 */
export function updateInjuryIcons(
  icons: ReadonlyArray<InjuryIcon>,
  deltaMs: number,
): InjuryIcon[] {
  return icons
    .map((icon) => ({ ...icon, elapsed: icon.elapsed + deltaMs }))
    .filter((icon) => icon.elapsed < icon.duration);
}

/**
 * Create an InjuryIcon from an InjuryEvent.
 */
export function createInjuryIcon(event: InjuryEvent): InjuryIcon {
  return {
    playerId: event.playerId,
    iconType: event.iconType,
    pos: { ...event.pos },
    elapsed: 0,
    duration: INJURY_ICON_DURATION_MS,
  };
}
