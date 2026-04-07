import { describe, it, expect } from "vitest";
import {
  lerp,
  easeOutCubic,
  type AnimationItem,
  createAnimationQueue,
} from "./animation";

describe("animation engine", () => {
  describe("lerp", () => {
    it("returns start at t=0", () => {
      expect(lerp(0, 10, 0)).toBe(0);
    });

    it("returns end at t=1", () => {
      expect(lerp(0, 10, 1)).toBe(10);
    });

    it("returns midpoint at t=0.5", () => {
      expect(lerp(0, 10, 0.5)).toBe(5);
    });

    it("clamps t below 0", () => {
      expect(lerp(0, 10, -0.5)).toBe(0);
    });

    it("clamps t above 1", () => {
      expect(lerp(0, 10, 1.5)).toBe(10);
    });
  });

  describe("easeOutCubic", () => {
    it("returns 0 at t=0", () => {
      expect(easeOutCubic(0)).toBe(0);
    });

    it("returns 1 at t=1", () => {
      expect(easeOutCubic(1)).toBeCloseTo(1);
    });

    it("progresses faster at start (decelerating)", () => {
      const mid = easeOutCubic(0.5);
      // easeOutCubic should be > 0.5 at t=0.5 (fast start)
      expect(mid).toBeGreaterThan(0.5);
    });
  });

  describe("AnimationQueue", () => {
    it("starts empty and idle", () => {
      const queue = createAnimationQueue();
      expect(queue.isAnimating()).toBe(false);
      expect(queue.getAnimatedPositions()).toEqual({});
    });

    it("enqueues a player move animation", () => {
      const queue = createAnimationQueue();
      const item: AnimationItem = {
        type: "player",
        id: "A1",
        from: { x: 0, y: 0 },
        to: { x: 1, y: 0 },
        duration: 200,
      };
      queue.enqueue(item);
      expect(queue.isAnimating()).toBe(true);
    });

    it("enqueues a ball move animation", () => {
      const queue = createAnimationQueue();
      const item: AnimationItem = {
        type: "ball",
        id: "ball",
        from: { x: 5, y: 5 },
        to: { x: 6, y: 6 },
        duration: 200,
      };
      queue.enqueue(item);
      expect(queue.isAnimating()).toBe(true);
    });

    it("returns from-position at the start of animation", () => {
      const queue = createAnimationQueue();
      queue.enqueue({
        type: "player",
        id: "A1",
        from: { x: 0, y: 0 },
        to: { x: 2, y: 3 },
        duration: 200,
      });
      // At t=0, position should be the from position
      const positions = queue.getAnimatedPositions();
      expect(positions["A1"]).toBeDefined();
      expect(positions["A1"]!.x).toBeCloseTo(0);
      expect(positions["A1"]!.y).toBeCloseTo(0);
    });

    it("advances positions when ticked", () => {
      const queue = createAnimationQueue();
      queue.enqueue({
        type: "player",
        id: "A1",
        from: { x: 0, y: 0 },
        to: { x: 10, y: 0 },
        duration: 200,
      });
      // Tick half the duration
      queue.tick(100);
      const positions = queue.getAnimatedPositions();
      // Should be partially along the path (eased, so > 5)
      expect(positions["A1"]!.x).toBeGreaterThan(0);
      expect(positions["A1"]!.x).toBeLessThan(10);
    });

    it("completes animation after full duration", () => {
      const queue = createAnimationQueue();
      queue.enqueue({
        type: "player",
        id: "A1",
        from: { x: 0, y: 0 },
        to: { x: 10, y: 5 },
        duration: 200,
      });
      queue.tick(200);
      // After full duration, animation should be done
      expect(queue.isAnimating()).toBe(false);
      expect(queue.getAnimatedPositions()).toEqual({});
    });

    it("processes sequential items in order", () => {
      const queue = createAnimationQueue();
      queue.enqueue({
        type: "player",
        id: "A1",
        from: { x: 0, y: 0 },
        to: { x: 5, y: 0 },
        duration: 100,
      });
      queue.enqueue({
        type: "player",
        id: "A1",
        from: { x: 5, y: 0 },
        to: { x: 10, y: 0 },
        duration: 100,
      });
      // During first animation
      expect(queue.isAnimating()).toBe(true);
      queue.tick(100); // Complete first
      // Second should now be active
      expect(queue.isAnimating()).toBe(true);
      const positions = queue.getAnimatedPositions();
      expect(positions["A1"]).toBeDefined();
      queue.tick(100); // Complete second
      expect(queue.isAnimating()).toBe(false);
    });

    it("can animate multiple entities in parallel", () => {
      const queue = createAnimationQueue();
      queue.enqueueParallel([
        {
          type: "player",
          id: "A1",
          from: { x: 0, y: 0 },
          to: { x: 5, y: 0 },
          duration: 200,
        },
        {
          type: "ball",
          id: "ball",
          from: { x: 3, y: 3 },
          to: { x: 6, y: 6 },
          duration: 200,
        },
      ]);
      queue.tick(100);
      const positions = queue.getAnimatedPositions();
      expect(positions["A1"]).toBeDefined();
      expect(positions["ball"]).toBeDefined();
    });

    it("clear removes all animations", () => {
      const queue = createAnimationQueue();
      queue.enqueue({
        type: "player",
        id: "A1",
        from: { x: 0, y: 0 },
        to: { x: 5, y: 0 },
        duration: 200,
      });
      queue.clear();
      expect(queue.isAnimating()).toBe(false);
      expect(queue.getAnimatedPositions()).toEqual({});
    });

    it("calls onComplete callback when animation finishes", () => {
      const queue = createAnimationQueue();
      let completed = false;
      queue.enqueue({
        type: "player",
        id: "A1",
        from: { x: 0, y: 0 },
        to: { x: 5, y: 0 },
        duration: 100,
        onComplete: () => {
          completed = true;
        },
      });
      queue.tick(100);
      expect(completed).toBe(true);
    });
  });
});
