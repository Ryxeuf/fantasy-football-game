/**
 * Tests for the server-side turn timer service.
 * B1.10 — Timer de tour configurable avec fin de tour auto.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  startTurnTimer,
  cancelTurnTimer,
  resetTurnTimer,
  getActiveTurnTimers,
  resetAllTurnTimers,
  DEFAULT_TURN_TIMER_MS,
} from "./turn-timer";

describe("Turn Timer Service", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetAllTurnTimers();
  });

  afterEach(() => {
    resetAllTurnTimers();
    vi.useRealTimers();
  });

  describe("startTurnTimer", () => {
    it("registers a timer for the match", () => {
      const onExpire = vi.fn();
      startTurnTimer("match-1", DEFAULT_TURN_TIMER_MS, onExpire);

      const timers = getActiveTurnTimers();
      expect(timers.has("match-1")).toBe(true);
    });

    it("does not create duplicate timers for the same match", () => {
      const onExpire = vi.fn();
      startTurnTimer("match-1", DEFAULT_TURN_TIMER_MS, onExpire);
      startTurnTimer("match-1", DEFAULT_TURN_TIMER_MS, onExpire);

      const timers = getActiveTurnTimers();
      expect(timers.size).toBe(1);
    });

    it("fires onExpire callback after the configured duration", () => {
      const onExpire = vi.fn();
      startTurnTimer("match-1", 5000, onExpire);

      vi.advanceTimersByTime(4999);
      expect(onExpire).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(onExpire).toHaveBeenCalledTimes(1);
      expect(onExpire).toHaveBeenCalledWith("match-1");
    });

    it("removes itself from active timers after firing", () => {
      const onExpire = vi.fn();
      startTurnTimer("match-1", 5000, onExpire);

      vi.advanceTimersByTime(5000);
      expect(getActiveTurnTimers().has("match-1")).toBe(false);
    });

    it("supports custom durations", () => {
      const onExpire = vi.fn();
      startTurnTimer("match-1", 180_000, onExpire);

      vi.advanceTimersByTime(120_000);
      expect(onExpire).not.toHaveBeenCalled();

      vi.advanceTimersByTime(60_000);
      expect(onExpire).toHaveBeenCalledTimes(1);
    });
  });

  describe("cancelTurnTimer", () => {
    it("cancels an active timer", () => {
      const onExpire = vi.fn();
      startTurnTimer("match-1", 5000, onExpire);

      cancelTurnTimer("match-1");

      vi.advanceTimersByTime(10_000);
      expect(onExpire).not.toHaveBeenCalled();
      expect(getActiveTurnTimers().has("match-1")).toBe(false);
    });

    it("does nothing if no timer exists", () => {
      expect(() => cancelTurnTimer("nonexistent")).not.toThrow();
    });
  });

  describe("resetTurnTimer", () => {
    it("cancels existing timer and starts a new one", () => {
      const onExpire = vi.fn();
      startTurnTimer("match-1", 10_000, onExpire);

      vi.advanceTimersByTime(8_000);

      // Reset with a new duration
      resetTurnTimer("match-1", 10_000, onExpire);

      // After 8s more (16s total), the original would have fired but new one hasn't
      vi.advanceTimersByTime(8_000);
      expect(onExpire).not.toHaveBeenCalled();

      // After 2 more seconds (10s after reset), it should fire
      vi.advanceTimersByTime(2_000);
      expect(onExpire).toHaveBeenCalledTimes(1);
    });
  });

  describe("resetAllTurnTimers", () => {
    it("clears all active timers", () => {
      const onExpire = vi.fn();
      startTurnTimer("match-1", 5000, onExpire);
      startTurnTimer("match-2", 5000, onExpire);

      resetAllTurnTimers();

      expect(getActiveTurnTimers().size).toBe(0);
      vi.advanceTimersByTime(10_000);
      expect(onExpire).not.toHaveBeenCalled();
    });
  });

  describe("multiple matches", () => {
    it("manages independent timers per match", () => {
      const onExpire1 = vi.fn();
      const onExpire2 = vi.fn();

      startTurnTimer("match-1", 5000, onExpire1);
      startTurnTimer("match-2", 10_000, onExpire2);

      vi.advanceTimersByTime(5000);
      expect(onExpire1).toHaveBeenCalledTimes(1);
      expect(onExpire2).not.toHaveBeenCalled();

      vi.advanceTimersByTime(5000);
      expect(onExpire2).toHaveBeenCalledTimes(1);
    });
  });

  describe("DEFAULT_TURN_TIMER_MS", () => {
    it("is 120 seconds", () => {
      expect(DEFAULT_TURN_TIMER_MS).toBe(120_000);
    });
  });
});
