import { describe, it, expect } from "vitest";
import {
  type VisualEffect,
  type EffectType,
  createEffectManager,
  shakeOffset,
  detectKnockdowns,
} from "./blockEffects";

describe("blockEffects — VisualEffect manager", () => {
  describe("createEffectManager", () => {
    it("starts with no active effects", () => {
      const mgr = createEffectManager();
      expect(mgr.getActiveEffects()).toEqual([]);
      expect(mgr.isActive()).toBe(false);
    });

    it("adds an impact effect", () => {
      const mgr = createEffectManager();
      mgr.add({
        targetId: "player-1",
        effect: "impact",
        duration: 150,
        color: 0xff0000,
      });
      expect(mgr.isActive()).toBe(true);
      expect(mgr.getActiveEffects()).toHaveLength(1);
      expect(mgr.getActiveEffects()[0].targetId).toBe("player-1");
      expect(mgr.getActiveEffects()[0].effect).toBe("impact");
    });

    it("advances elapsed time on tick", () => {
      const mgr = createEffectManager();
      mgr.add({
        targetId: "player-1",
        effect: "impact",
        duration: 200,
        color: 0xff0000,
      });
      mgr.tick(100);
      const effects = mgr.getActiveEffects();
      expect(effects[0].elapsed).toBe(100);
    });

    it("removes effect after its duration expires", () => {
      const mgr = createEffectManager();
      mgr.add({
        targetId: "player-1",
        effect: "impact",
        duration: 150,
        color: 0xff0000,
      });
      mgr.tick(150);
      expect(mgr.getActiveEffects()).toHaveLength(0);
      expect(mgr.isActive()).toBe(false);
    });

    it("supports multiple concurrent effects on different targets", () => {
      const mgr = createEffectManager();
      mgr.add({
        targetId: "player-1",
        effect: "impact",
        duration: 200,
        color: 0xff0000,
      });
      mgr.add({
        targetId: "player-2",
        effect: "knockdown",
        duration: 300,
        color: 0xff4444,
      });
      expect(mgr.getActiveEffects()).toHaveLength(2);

      mgr.tick(200);
      // First effect expired, second still active
      expect(mgr.getActiveEffects()).toHaveLength(1);
      expect(mgr.getActiveEffects()[0].targetId).toBe("player-2");
    });

    it("clear removes all effects", () => {
      const mgr = createEffectManager();
      mgr.add({
        targetId: "player-1",
        effect: "impact",
        duration: 200,
        color: 0xff0000,
      });
      mgr.add({
        targetId: "player-2",
        effect: "knockdown",
        duration: 300,
        color: 0xff4444,
      });
      mgr.clear();
      expect(mgr.getActiveEffects()).toHaveLength(0);
      expect(mgr.isActive()).toBe(false);
    });

    it("getProgress returns normalized progress 0..1", () => {
      const mgr = createEffectManager();
      mgr.add({
        targetId: "player-1",
        effect: "impact",
        duration: 200,
        color: 0xff0000,
      });

      expect(mgr.getProgress("player-1")).toBeCloseTo(0);

      mgr.tick(100);
      expect(mgr.getProgress("player-1")).toBeCloseTo(0.5);

      mgr.tick(100);
      // Effect expired, no progress
      expect(mgr.getProgress("player-1")).toBe(-1);
    });

    it("getFlashAlpha returns fading alpha based on progress", () => {
      const mgr = createEffectManager();
      mgr.add({
        targetId: "player-1",
        effect: "impact",
        duration: 200,
        color: 0xff0000,
      });

      // At start: full alpha
      const alphaStart = mgr.getFlashAlpha("player-1");
      expect(alphaStart).toBeCloseTo(0.7);

      mgr.tick(100);
      // At midpoint: reduced alpha
      const alphaMid = mgr.getFlashAlpha("player-1");
      expect(alphaMid).toBeGreaterThan(0);
      expect(alphaMid).toBeLessThan(0.7);

      mgr.tick(100);
      // Expired: 0
      expect(mgr.getFlashAlpha("player-1")).toBe(0);
    });
  });

  describe("shakeOffset", () => {
    it("returns zero offset at progress 0 (not yet started)", () => {
      const offset = shakeOffset(0);
      // At t=0, shake amplitude should be near-max but sin(0)=0
      expect(offset.dx).toBeCloseTo(0);
    });

    it("returns non-zero offset during animation", () => {
      const offset = shakeOffset(0.25);
      // Should have some displacement
      expect(Math.abs(offset.dx) + Math.abs(offset.dy)).toBeGreaterThan(0);
    });

    it("returns zero offset at progress 1 (animation complete)", () => {
      const offset = shakeOffset(1);
      // At t=1, damping factor = 0, so offset should be 0
      expect(offset.dx).toBeCloseTo(0);
      expect(offset.dy).toBeCloseTo(0);
    });

    it("offset amplitude decreases over time (damped oscillation)", () => {
      // Compare magnitude at early vs late progress
      const earlyOffset = shakeOffset(0.15);
      const lateOffset = shakeOffset(0.85);
      const earlyMag = Math.abs(earlyOffset.dx) + Math.abs(earlyOffset.dy);
      const lateMag = Math.abs(lateOffset.dx) + Math.abs(lateOffset.dy);
      expect(earlyMag).toBeGreaterThan(lateMag);
    });
  });
});

describe("blockEffects — detectKnockdowns", () => {

  const makePlayer = (
    id: string,
    stunned = false,
    state: "active" | "knocked_out" | "casualty" = "active",
  ) => ({
    id,
    team: "A" as const,
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
    stunned: stunned || undefined,
    state,
  });

  it("detects a player becoming stunned", () => {
    const prev = [makePlayer("p1", false)];
    const next = [makePlayer("p1", true)];
    const events = detectKnockdowns(prev, next);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ playerId: "p1", type: "stunned" });
  });

  it("detects a player becoming knocked out", () => {
    const prev = [makePlayer("p1", false, "active")];
    const next = [makePlayer("p1", false, "knocked_out")];
    const events = detectKnockdowns(prev, next);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ playerId: "p1", type: "knocked_out" });
  });

  it("detects a player becoming a casualty", () => {
    const prev = [makePlayer("p1", false, "active")];
    const next = [makePlayer("p1", false, "casualty")];
    const events = detectKnockdowns(prev, next);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ playerId: "p1", type: "casualty" });
  });

  it("returns empty array when no state changes", () => {
    const prev = [makePlayer("p1", false)];
    const next = [makePlayer("p1", false)];
    const events = detectKnockdowns(prev, next);
    expect(events).toHaveLength(0);
  });

  it("ignores players that were already stunned", () => {
    const prev = [makePlayer("p1", true)];
    const next = [makePlayer("p1", true)];
    const events = detectKnockdowns(prev, next);
    expect(events).toHaveLength(0);
  });

  it("detects multiple knockdowns in the same state update", () => {
    const prev = [makePlayer("p1", false), makePlayer("p2", false)];
    const next = [makePlayer("p1", true), makePlayer("p2", false, "knocked_out")];
    const events = detectKnockdowns(prev, next);
    expect(events).toHaveLength(2);
  });

  it("handles new players (not in previous state) gracefully", () => {
    const prev: ReturnType<typeof makePlayer>[] = [];
    const next = [makePlayer("p1", true)];
    const events = detectKnockdowns(prev, next);
    // New player appearing as stunned should not trigger (no transition)
    expect(events).toHaveLength(0);
  });
});
