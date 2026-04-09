import { describe, it, expect } from "vitest";
import type { GameLogEntry } from "@bb/game-engine";
import {
  detectTouchdownEvent,
  createParticles,
  updateParticles,
  touchdownFlashAlpha,
  type TouchdownEvent,
  type Particle,
  TOUCHDOWN_FLASH_DURATION_MS,
  PARTICLE_DURATION_MS,
  PARTICLE_COUNT,
} from "./touchdownEffects";

/* ── Helper: minimal GameLogEntry ────────────────────────────────── */

function makeLogEntry(
  overrides: Partial<GameLogEntry> & { type: GameLogEntry["type"] },
): GameLogEntry {
  return {
    id: `log-${Math.random()}`,
    timestamp: Date.now(),
    message: "Test",
    ...overrides,
  };
}

/* ── detectTouchdownEvent ─────────────────────────────────────────── */

describe("touchdownEffects — detectTouchdownEvent", () => {
  it("returns null when both logs are empty", () => {
    expect(detectTouchdownEvent([], [])).toBeNull();
  });

  it("returns null when no new score entry appears", () => {
    const prev = [makeLogEntry({ type: "action", message: "Move" })];
    const next = [
      makeLogEntry({ type: "action", message: "Move" }),
      makeLogEntry({ type: "dice", message: "Roll" }),
    ];
    expect(detectTouchdownEvent(prev, next)).toBeNull();
  });

  it("detects a new score entry for team A", () => {
    const prev = [makeLogEntry({ type: "action", message: "Move" })];
    const scoreEntry = makeLogEntry({
      type: "score",
      message: "Touchdown pour Team A !",
      team: "A",
      details: { scorer: "Grim", score: { teamA: 1, teamB: 0 } },
    });
    const next = [...prev, scoreEntry];
    const event = detectTouchdownEvent(prev, next);
    expect(event).not.toBeNull();
    expect(event!.scoringTeam).toBe("A");
  });

  it("detects a new score entry for team B", () => {
    const prev: GameLogEntry[] = [];
    const scoreEntry = makeLogEntry({
      type: "score",
      message: "Touchdown pour Team B !",
      team: "B",
    });
    const next = [scoreEntry];
    const event = detectTouchdownEvent(prev, next);
    expect(event).not.toBeNull();
    expect(event!.scoringTeam).toBe("B");
  });

  it("ignores score entries already present in previous log", () => {
    const scoreEntry = makeLogEntry({
      type: "score",
      message: "Touchdown pour Team A !",
      team: "A",
    });
    const prev = [scoreEntry];
    const next = [scoreEntry];
    expect(detectTouchdownEvent(prev, next)).toBeNull();
  });

  it("returns the most recent score entry when multiple new ones appear", () => {
    const prev: GameLogEntry[] = [];
    const score1 = makeLogEntry({
      type: "score",
      message: "TD 1",
      team: "A",
      id: "score-1",
    });
    const score2 = makeLogEntry({
      type: "score",
      message: "TD 2",
      team: "B",
      id: "score-2",
    });
    const next = [score1, score2];
    const event = detectTouchdownEvent(prev, next);
    expect(event).not.toBeNull();
    expect(event!.scoringTeam).toBe("B");
  });
});

/* ── createParticles ──────────────────────────────────────────────── */

describe("touchdownEffects — createParticles", () => {
  it("creates the expected number of particles", () => {
    const particles = createParticles("A", 26, 15);
    expect(particles).toHaveLength(PARTICLE_COUNT);
  });

  it("positions team A particles at the far endzone (x = width - 1)", () => {
    const particles = createParticles("A", 26, 15);
    for (const p of particles) {
      // Particles originate from the endzone row
      expect(p.originX).toBe(25); // width - 1
      expect(p.originY).toBeGreaterThanOrEqual(0);
      expect(p.originY).toBeLessThan(15);
    }
  });

  it("positions team B particles at x = 0", () => {
    const particles = createParticles("B", 26, 15);
    for (const p of particles) {
      expect(p.originX).toBe(0);
    }
  });

  it("gives each particle a velocity, color, size, and zero elapsed", () => {
    const particles = createParticles("A", 26, 15);
    for (const p of particles) {
      expect(p.elapsed).toBe(0);
      expect(p.duration).toBe(PARTICLE_DURATION_MS);
      expect(typeof p.vx).toBe("number");
      expect(typeof p.vy).toBe("number");
      expect(typeof p.color).toBe("number");
      expect(p.size).toBeGreaterThan(0);
    }
  });
});

/* ── updateParticles ──────────────────────────────────────────────── */

describe("touchdownEffects — updateParticles", () => {
  it("advances particle elapsed time", () => {
    const particles = createParticles("A", 26, 15);
    const updated = updateParticles(particles, 50);
    for (const p of updated) {
      expect(p.elapsed).toBe(50);
    }
  });

  it("removes particles that exceed their duration", () => {
    const particles = createParticles("A", 26, 15);
    const updated = updateParticles(particles, PARTICLE_DURATION_MS + 1);
    expect(updated).toHaveLength(0);
  });

  it("returns new array (immutability)", () => {
    const particles = createParticles("A", 26, 15);
    const updated = updateParticles(particles, 10);
    expect(updated).not.toBe(particles);
    // Original particles untouched
    expect(particles[0].elapsed).toBe(0);
  });

  it("computes current position from origin + velocity * progress", () => {
    const particle: Particle = {
      originX: 25,
      originY: 7,
      vx: 2,
      vy: 3,
      color: 0xffd700,
      size: 3,
      elapsed: 0,
      duration: 1000,
    };
    const updated = updateParticles([particle], 500);
    // progress = 500/1000 = 0.5
    expect(updated[0].elapsed).toBe(500);
  });
});

/* ── touchdownFlashAlpha ──────────────────────────────────────────── */

describe("touchdownEffects — touchdownFlashAlpha", () => {
  it("returns max alpha at progress 0", () => {
    const alpha = touchdownFlashAlpha(0);
    expect(alpha).toBeGreaterThan(0);
    expect(alpha).toBeCloseTo(0.5);
  });

  it("returns 0 at progress 1", () => {
    expect(touchdownFlashAlpha(1)).toBeCloseTo(0);
  });

  it("decreases over time", () => {
    const early = touchdownFlashAlpha(0.2);
    const late = touchdownFlashAlpha(0.8);
    expect(early).toBeGreaterThan(late);
  });

  it("returns 0 for progress > 1", () => {
    expect(touchdownFlashAlpha(1.5)).toBe(0);
  });
});
