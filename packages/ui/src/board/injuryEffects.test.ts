import { describe, it, expect } from "vitest";
import type { Player, CasualtyOutcome } from "@bb/game-engine";
import {
  detectInjuryTransitions,
  type InjuryEvent,
  type InjuryIconType,
  INJURY_ICON_DURATION_MS,
  getInjuryIconAlpha,
  getInjuryIconOffsetY,
  INJURY_ICON_COLORS,
  INJURY_ICON_LABELS,
} from "./injuryEffects";

/* ── Helper: minimal Player ────────────────────────────────────────── */

function makePlayer(
  id: string,
  state: "active" | "knocked_out" | "casualty" = "active",
  overrides: Partial<Player> = {},
): Player {
  return {
    id,
    team: "A",
    pos: { x: 5, y: 5 },
    name: "Test",
    number: 1,
    position: "Lineman",
    ma: 6,
    st: 3,
    ag: 3,
    pa: 4,
    av: 8,
    skills: [],
    pm: 6,
    state,
    ...overrides,
  };
}

/* ── detectInjuryTransitions ─────────────────────────────────────── */

describe("injuryEffects — detectInjuryTransitions", () => {
  it("detects a player transitioning from active to knocked_out", () => {
    const prev = [makePlayer("p1", "active")];
    const next = [makePlayer("p1", "knocked_out")];
    const events = detectInjuryTransitions(prev, next, {});
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      playerId: "p1",
      iconType: "ko",
      pos: { x: 5, y: 5 },
    });
  });

  it("detects a player transitioning from active to casualty (badly_hurt)", () => {
    const prev = [makePlayer("p1", "active")];
    const next = [makePlayer("p1", "casualty")];
    const casualties: Record<string, CasualtyOutcome> = {
      p1: "badly_hurt",
    };
    const events = detectInjuryTransitions(prev, next, casualties);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      playerId: "p1",
      iconType: "casualty",
      pos: { x: 5, y: 5 },
    });
  });

  it("detects dead casualty outcome", () => {
    const prev = [makePlayer("p1", "active")];
    const next = [makePlayer("p1", "casualty")];
    const casualties: Record<string, CasualtyOutcome> = {
      p1: "dead",
    };
    const events = detectInjuryTransitions(prev, next, casualties);
    expect(events).toHaveLength(1);
    expect(events[0].iconType).toBe("dead");
  });

  it("returns empty array when no state changes", () => {
    const prev = [makePlayer("p1", "active")];
    const next = [makePlayer("p1", "active")];
    const events = detectInjuryTransitions(prev, next, {});
    expect(events).toHaveLength(0);
  });

  it("ignores players already knocked_out (no re-trigger)", () => {
    const prev = [makePlayer("p1", "knocked_out")];
    const next = [makePlayer("p1", "knocked_out")];
    const events = detectInjuryTransitions(prev, next, {});
    expect(events).toHaveLength(0);
  });

  it("ignores players already casualty (no re-trigger)", () => {
    const prev = [makePlayer("p1", "casualty")];
    const next = [makePlayer("p1", "casualty")];
    const events = detectInjuryTransitions(prev, next, {});
    expect(events).toHaveLength(0);
  });

  it("detects multiple injuries in the same state update", () => {
    const prev = [makePlayer("p1", "active"), makePlayer("p2", "active")];
    const next = [makePlayer("p1", "knocked_out"), makePlayer("p2", "casualty")];
    const casualties: Record<string, CasualtyOutcome> = {
      p2: "seriously_hurt",
    };
    const events = detectInjuryTransitions(prev, next, casualties);
    expect(events).toHaveLength(2);
    expect(events[0].iconType).toBe("ko");
    expect(events[1].iconType).toBe("casualty");
  });

  it("handles new players (not in previous state) gracefully", () => {
    const prev: Player[] = [];
    const next = [makePlayer("p1", "knocked_out")];
    const events = detectInjuryTransitions(prev, next, {});
    // New player appearing as KO should not trigger (no transition)
    expect(events).toHaveLength(0);
  });

  it("uses the player position from previous state for the icon", () => {
    const prev = [makePlayer("p1", "active", { pos: { x: 10, y: 7 } })];
    const next = [makePlayer("p1", "knocked_out", { pos: { x: 10, y: 7 } })];
    const events = detectInjuryTransitions(prev, next, {});
    expect(events[0].pos).toEqual({ x: 10, y: 7 });
  });

  it("treats casualty without casualtyResults entry as generic casualty", () => {
    const prev = [makePlayer("p1", "active")];
    const next = [makePlayer("p1", "casualty")];
    const events = detectInjuryTransitions(prev, next, {});
    expect(events[0].iconType).toBe("casualty");
  });
});

/* ── Icon animation functions ────────────────────────────────────── */

describe("injuryEffects — getInjuryIconAlpha", () => {
  it("returns 0 at progress 0 (fade-in starts)", () => {
    const alpha = getInjuryIconAlpha(0);
    expect(alpha).toBeCloseTo(0);
  });

  it("returns full alpha at ~15% progress (after fade-in)", () => {
    // Fade-in phase is 0..0.15
    const alpha = getInjuryIconAlpha(0.2);
    expect(alpha).toBeCloseTo(1);
  });

  it("returns full alpha during hold phase (0.15..0.6)", () => {
    const alpha = getInjuryIconAlpha(0.4);
    expect(alpha).toBeCloseTo(1);
  });

  it("fades out during fade-out phase (0.6..1.0)", () => {
    const alpha = getInjuryIconAlpha(0.8);
    expect(alpha).toBeGreaterThan(0);
    expect(alpha).toBeLessThan(1);
  });

  it("returns 0 at progress 1 (animation complete)", () => {
    const alpha = getInjuryIconAlpha(1);
    expect(alpha).toBeCloseTo(0);
  });

  it("clamps at 0 for progress > 1", () => {
    expect(getInjuryIconAlpha(1.5)).toBe(0);
  });
});

describe("injuryEffects — getInjuryIconOffsetY", () => {
  it("returns 0 at progress 0 (icon at player position)", () => {
    expect(getInjuryIconOffsetY(0)).toBeCloseTo(0);
  });

  it("returns negative value as progress increases (icon floats up)", () => {
    const offset = getInjuryIconOffsetY(0.5);
    expect(offset).toBeLessThan(0);
  });

  it("reaches maximum offset at progress 1", () => {
    const offset = getInjuryIconOffsetY(1);
    expect(offset).toBeLessThan(0);
  });

  it("offset magnitude increases over time", () => {
    const early = getInjuryIconOffsetY(0.2);
    const late = getInjuryIconOffsetY(0.8);
    expect(Math.abs(late)).toBeGreaterThan(Math.abs(early));
  });
});

/* ── Constants ───────────────────────────────────────────────────── */

describe("injuryEffects — constants", () => {
  it("has a positive duration", () => {
    expect(INJURY_ICON_DURATION_MS).toBeGreaterThan(0);
  });

  it("defines colors for all icon types", () => {
    expect(INJURY_ICON_COLORS.ko).toBeDefined();
    expect(INJURY_ICON_COLORS.casualty).toBeDefined();
    expect(INJURY_ICON_COLORS.dead).toBeDefined();
  });

  it("defines labels for all icon types", () => {
    expect(INJURY_ICON_LABELS.ko).toBe("KO");
    expect(typeof INJURY_ICON_LABELS.casualty).toBe("string");
    expect(typeof INJURY_ICON_LABELS.dead).toBe("string");
  });
});
