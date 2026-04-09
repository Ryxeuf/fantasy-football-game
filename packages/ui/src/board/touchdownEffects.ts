/**
 * Touchdown animation effects — visual feedback for scoring a touchdown.
 * Pure functions, no DOM/React dependencies.
 *
 * Provides:
 * - Touchdown detection from game log changes
 * - Particle burst originating from the scoring endzone
 * - Full-width flash overlay that fades out
 */

import type { GameLogEntry, TeamId } from "@bb/game-engine";

/* ── Constants ─────────────────────────────────────────────────────── */

export const TOUCHDOWN_FLASH_DURATION_MS = 800;
export const PARTICLE_DURATION_MS = 1200;
export const PARTICLE_COUNT = 24;

const MAX_FLASH_ALPHA = 0.5;

/* Team colors for particles */
const TEAM_A_COLORS = [0xff4444, 0xff6666, 0xffd700, 0xffaa00];
const TEAM_B_COLORS = [0x4488ff, 0x66aaff, 0xffd700, 0xffaa00];

/* ── Types ─────────────────────────────────────────────────────────── */

export interface TouchdownEvent {
  scoringTeam: TeamId;
}

export interface Particle {
  /** Grid x origin (endzone row) */
  originX: number;
  /** Grid y origin (random cell along endzone width) */
  originY: number;
  /** Velocity in grid-cells per second (x direction) */
  vx: number;
  /** Velocity in grid-cells per second (y direction) */
  vy: number;
  /** Particle color */
  color: number;
  /** Particle radius in pixels */
  size: number;
  /** Elapsed time in ms */
  elapsed: number;
  /** Total duration in ms */
  duration: number;
}

/* ── Touchdown detection ───────────────────────────────────────────── */

/**
 * Compare previous and next game logs to detect a new touchdown.
 * Returns the most recent new score entry, or null.
 */
export function detectTouchdownEvent(
  prevLog: ReadonlyArray<GameLogEntry>,
  nextLog: ReadonlyArray<GameLogEntry>,
): TouchdownEvent | null {
  if (nextLog.length <= prevLog.length) return null;

  // Find new entries (those beyond the previous log length)
  const newEntries = nextLog.slice(prevLog.length);
  // Find the last score entry among new entries
  const scoreEntries = newEntries.filter((e) => e.type === "score");
  if (scoreEntries.length === 0) return null;

  const latest = scoreEntries[scoreEntries.length - 1];
  const scoringTeam = latest.team ?? "A";

  return { scoringTeam };
}

/* ── Particle creation ─────────────────────────────────────────────── */

/**
 * Deterministic seeded random for particle generation.
 * Uses a simple LCG to avoid Math.random() (per project rules).
 */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) & 0xffffffff;
    return (state >>> 0) / 0xffffffff;
  };
}

/**
 * Create a burst of particles originating from the scoring endzone.
 */
export function createParticles(
  scoringTeam: TeamId,
  boardWidth: number,
  boardHeight: number,
): Particle[] {
  const endzoneX = scoringTeam === "A" ? boardWidth - 1 : 0;
  const colors = scoringTeam === "A" ? TEAM_A_COLORS : TEAM_B_COLORS;
  // Particles fly away from the endzone
  const baseVx = scoringTeam === "A" ? -3 : 3;

  const rng = seededRandom(endzoneX * 1000 + boardHeight);
  const particles: Particle[] = [];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const y = rng() * boardHeight;
    const vx = baseVx + (rng() - 0.5) * 2;
    const vy = (rng() - 0.5) * 4;
    const color = colors[Math.floor(rng() * colors.length)];
    const size = 2 + rng() * 3;

    particles.push({
      originX: endzoneX,
      originY: y,
      vx,
      vy,
      color,
      size,
      elapsed: 0,
      duration: PARTICLE_DURATION_MS,
    });
  }

  return particles;
}

/* ── Particle update (immutable) ───────────────────────────────────── */

/**
 * Advance particles by deltaMs. Returns a new array with updated particles.
 * Particles that exceed their duration are removed.
 */
export function updateParticles(
  particles: ReadonlyArray<Particle>,
  deltaMs: number,
): Particle[] {
  return particles
    .map((p) => ({ ...p, elapsed: p.elapsed + deltaMs }))
    .filter((p) => p.elapsed < p.duration);
}

/**
 * Compute the current position of a particle based on its elapsed time.
 */
export function getParticlePosition(p: Particle): { x: number; y: number } {
  const progress = Math.min(p.elapsed / p.duration, 1);
  return {
    x: p.originX + p.vx * progress,
    y: p.originY + p.vy * progress,
  };
}

/**
 * Compute the alpha (opacity) of a particle — fades out over its duration.
 */
export function getParticleAlpha(p: Particle): number {
  const progress = Math.min(p.elapsed / p.duration, 1);
  return Math.max(0, 1 - progress);
}

/* ── Flash overlay ─────────────────────────────────────────────────── */

/**
 * Compute the flash alpha for the endzone overlay at a given progress (0..1).
 * Fades out linearly from MAX_FLASH_ALPHA to 0.
 */
export function touchdownFlashAlpha(progress: number): number {
  if (progress >= 1) return 0;
  return MAX_FLASH_ALPHA * Math.max(0, 1 - progress);
}
