import * as React from "react";
import type { GameLogEntry, TeamId } from "@bb/game-engine";
import {
  type Particle,
  type TouchdownEvent,
  detectTouchdownEvent,
  createParticles,
  updateParticles,
  getParticlePosition,
  getParticleAlpha,
  touchdownFlashAlpha,
  TOUCHDOWN_FLASH_DURATION_MS,
} from "./touchdownEffects";

/* ── Types ─────────────────────────────────────────────────────────── */

export interface TouchdownOverlay {
  /** Scoring team (determines which endzone to flash) */
  scoringTeam: TeamId;
  /** Flash alpha for the endzone overlay (0..0.5, fading out) */
  flashAlpha: number;
  /** Flash progress (0..1) */
  flashProgress: number;
  /** Active particles with computed positions */
  particles: ReadonlyArray<{
    x: number;
    y: number;
    alpha: number;
    color: number;
    size: number;
  }>;
}

export interface TouchdownEffects {
  /** Active touchdown overlay, or null if no animation running */
  overlay: TouchdownOverlay | null;
  /** True while any touchdown animation is playing */
  animating: boolean;
}

/* ── Hook ──────────────────────────────────────────────────────────── */

/**
 * Detects touchdown events from game log changes and returns visual effect data.
 * Renders a flash overlay on the scoring endzone + particle burst.
 */
export function useTouchdownEffects(
  gameLog: ReadonlyArray<GameLogEntry>,
  boardWidth: number,
  boardHeight: number,
): TouchdownEffects {
  const prevLogRef = React.useRef<ReadonlyArray<GameLogEntry>>([]);
  const rafRef = React.useRef<number>(0);
  const lastTimeRef = React.useRef<number>(0);

  // Animation state
  const flashElapsedRef = React.useRef<number>(0);
  const particlesRef = React.useRef<Particle[]>([]);
  const scoringTeamRef = React.useRef<TeamId | null>(null);

  const [overlay, setOverlay] = React.useState<TouchdownOverlay | null>(null);

  // Detect touchdown events and start animation
  React.useEffect(() => {
    const prev = prevLogRef.current;
    prevLogRef.current = gameLog;

    if (prev.length === 0 && gameLog.length === 0) return;

    const event = detectTouchdownEvent(prev, gameLog);
    if (!event) return;

    // Initialize animation state
    scoringTeamRef.current = event.scoringTeam;
    flashElapsedRef.current = 0;
    particlesRef.current = createParticles(
      event.scoringTeam,
      boardWidth,
      boardHeight,
    );

    // Start the RAF loop if not already running
    if (rafRef.current === 0) {
      lastTimeRef.current = performance.now();
      const loop = (now: number) => {
        const delta = now - lastTimeRef.current;
        lastTimeRef.current = now;

        // Advance flash
        flashElapsedRef.current += delta;
        const flashProgress = Math.min(
          flashElapsedRef.current / TOUCHDOWN_FLASH_DURATION_MS,
          1,
        );
        const flashAlpha = touchdownFlashAlpha(flashProgress);

        // Advance particles
        particlesRef.current = updateParticles(particlesRef.current, delta);

        const hasFlash = flashProgress < 1;
        const hasParticles = particlesRef.current.length > 0;

        if (hasFlash || hasParticles) {
          const renderedParticles = particlesRef.current.map((p) => {
            const pos = getParticlePosition(p);
            return {
              x: pos.x,
              y: pos.y,
              alpha: getParticleAlpha(p),
              color: p.color,
              size: p.size,
            };
          });

          setOverlay({
            scoringTeam: scoringTeamRef.current!,
            flashAlpha,
            flashProgress,
            particles: renderedParticles,
          });

          rafRef.current = requestAnimationFrame(loop);
        } else {
          setOverlay(null);
          rafRef.current = 0;
        }
      };
      rafRef.current = requestAnimationFrame(loop);
    }
  }, [gameLog, boardWidth, boardHeight]);

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
    overlay,
    animating: overlay !== null,
  };
}
