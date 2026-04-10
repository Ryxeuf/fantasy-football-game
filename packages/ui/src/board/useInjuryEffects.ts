import * as React from "react";
import type { Player, CasualtyOutcome } from "@bb/game-engine";
import {
  type InjuryIcon,
  type InjuryIconType,
  detectInjuryTransitions,
  createInjuryIcon,
  updateInjuryIcons,
  getInjuryIconAlpha,
  getInjuryIconOffsetY,
  INJURY_ICON_DURATION_MS,
  INJURY_ICON_COLORS,
  INJURY_ICON_LABELS,
} from "./injuryEffects";

/* ── Types ─────────────────────────────────────────────────────────── */

export interface InjuryIconOverlay {
  playerId: string;
  /** Grid position x (row) */
  posX: number;
  /** Grid position y (column) */
  posY: number;
  /** Vertical offset in grid cells (negative = upward) */
  offsetY: number;
  /** Alpha (opacity) 0..1 */
  alpha: number;
  /** Icon color */
  color: number;
  /** Text label for the icon ("KO", "☠") */
  label: string;
  /** Icon type for styling decisions */
  iconType: InjuryIconType;
}

export interface InjuryEffects {
  /** Active injury icon overlays */
  icons: ReadonlyArray<InjuryIconOverlay>;
  /** True while any injury animation is playing */
  animating: boolean;
}

/* ── Hook ──────────────────────────────────────────────────────────── */

/**
 * Detects injury state transitions and returns visual icon overlays.
 * Shows floating KO/casualty/death icons above injured players.
 */
export function useInjuryEffects(
  players: ReadonlyArray<Player>,
  casualtyResults: Readonly<Record<string, CasualtyOutcome>>,
): InjuryEffects {
  const prevPlayersRef = React.useRef<ReadonlyArray<Player>>([]);
  const rafRef = React.useRef<number>(0);
  const lastTimeRef = React.useRef<number>(0);
  const iconsRef = React.useRef<InjuryIcon[]>([]);

  const [overlays, setOverlays] = React.useState<ReadonlyArray<InjuryIconOverlay>>([]);

  // Detect injury transitions and start animation
  React.useEffect(() => {
    const prev = prevPlayersRef.current;
    prevPlayersRef.current = players;

    if (prev.length === 0) return;

    const events = detectInjuryTransitions(prev, players, casualtyResults);
    if (events.length === 0) return;

    // Add new icons
    for (const event of events) {
      iconsRef.current = [...iconsRef.current, createInjuryIcon(event)];
    }

    // Start the RAF loop if not already running
    if (rafRef.current === 0) {
      lastTimeRef.current = performance.now();
      const loop = (now: number) => {
        const delta = now - lastTimeRef.current;
        lastTimeRef.current = now;

        iconsRef.current = updateInjuryIcons(iconsRef.current, delta);

        if (iconsRef.current.length > 0) {
          const rendered: InjuryIconOverlay[] = iconsRef.current.map((icon) => {
            const progress = Math.min(icon.elapsed / icon.duration, 1);
            return {
              playerId: icon.playerId,
              posX: icon.pos.x,
              posY: icon.pos.y,
              offsetY: getInjuryIconOffsetY(progress),
              alpha: getInjuryIconAlpha(progress),
              color: INJURY_ICON_COLORS[icon.iconType],
              label: INJURY_ICON_LABELS[icon.iconType],
              iconType: icon.iconType,
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
  }, [players, casualtyResults]);

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
    icons: overlays,
    animating: overlays.length > 0,
  };
}
