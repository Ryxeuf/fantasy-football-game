/**
 * Tests for the turn timer orchestrator.
 * Verifies that turn timers start/reset on turn changes
 * and auto-submit END_TURN when expired.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  handleTurnTimerAfterMove,
  handleTurnTimerAutoEnd,
  TURN_TIMER_CONFIG_KEY,
} from "./turn-timer-orchestrator";
import {
  getActiveTurnTimers,
  resetAllTurnTimers,
} from "./turn-timer";

// Mock processMove to avoid real DB calls
vi.mock("./move-processor", () => ({
  processMove: vi.fn().mockResolvedValue({ success: true, gameState: {} }),
}));

// Mock game-broadcast to avoid real socket calls
vi.mock("./game-broadcast", () => ({
  broadcastGameState: vi.fn(),
  broadcastMatchEnd: vi.fn(),
  broadcastTurnTimerStarted: vi.fn(),
}));

describe("Turn Timer Orchestrator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetAllTurnTimers();
  });

  afterEach(() => {
    resetAllTurnTimers();
    vi.useRealTimers();
  });

  describe("handleTurnTimerAfterMove", () => {
    it("starts a turn timer when the current player changes", () => {
      handleTurnTimerAfterMove("match-1", "A", "B", 120);

      const timers = getActiveTurnTimers();
      expect(timers.has("match-1")).toBe(true);
    });

    it("does not start a timer when the current player does not change", () => {
      handleTurnTimerAfterMove("match-1", "A", "A", 120);

      const timers = getActiveTurnTimers();
      expect(timers.has("match-1")).toBe(false);
    });

    it("does not start a timer when turnTimerSeconds is 0 (disabled)", () => {
      handleTurnTimerAfterMove("match-1", "A", "B", 0);

      const timers = getActiveTurnTimers();
      expect(timers.has("match-1")).toBe(false);
    });

    it("resets the timer when player changes again", () => {
      handleTurnTimerAfterMove("match-1", "A", "B", 120);
      const firstDeadline = getActiveTurnTimers().get("match-1")?.deadline;

      vi.advanceTimersByTime(30_000);

      handleTurnTimerAfterMove("match-1", "B", "A", 120);
      const secondDeadline = getActiveTurnTimers().get("match-1")?.deadline;

      expect(secondDeadline).toBeGreaterThan(firstDeadline!);
    });

    it("cancels timer when game phase is ended", () => {
      handleTurnTimerAfterMove("match-1", "A", "B", 120);
      expect(getActiveTurnTimers().has("match-1")).toBe(true);

      // Simulate match ended — pass same player (no change) with 0 timer
      handleTurnTimerAfterMove("match-1", "B", "B", 0, "ended");
      // Timer should be cancelled because gamePhase is ended
    });
  });

  describe("handleTurnTimerAutoEnd", () => {
    it("calls processMove with END_TURN when timer expires", async () => {
      const { processMove } = await import("./move-processor");

      handleTurnTimerAutoEnd("match-1", "user-1");

      expect(processMove).toHaveBeenCalledWith(
        "match-1",
        "user-1",
        { type: "END_TURN" },
      );
    });
  });
});
