import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    match: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    teamSelection: {
      findMany: vi.fn(),
    },
    turn: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("./game-broadcast", () => ({
  broadcastMatchForfeited: vi.fn(),
}));

vi.mock("./elo-update", () => ({
  updateEloAfterMatch: vi.fn(),
}));

import {
  startForfeitTimer,
  cancelForfeitTimer,
  getActiveForfeitTimers,
  resetForfeitTimers,
  FORFEIT_TIMEOUT_MS,
} from "./forfeit-tracker";
import { prisma } from "../prisma";
import { broadcastMatchForfeited } from "./game-broadcast";
import { updateEloAfterMatch } from "./elo-update";

describe("forfeit-tracker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    resetForfeitTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetForfeitTimers();
  });

  it("FORFEIT_TIMEOUT_MS is 2 minutes", () => {
    expect(FORFEIT_TIMEOUT_MS).toBe(2 * 60 * 1000);
  });

  describe("startForfeitTimer", () => {
    it("registers a timer for the match/user", () => {
      startForfeitTimer("match-1", "user-a");

      const timers = getActiveForfeitTimers();
      expect(timers.has("match-1:user-a")).toBe(true);
    });

    it("does not create duplicate timers for the same match/user", () => {
      startForfeitTimer("match-1", "user-a");
      startForfeitTimer("match-1", "user-a");

      const timers = getActiveForfeitTimers();
      expect(timers.size).toBe(1);
    });

    it("triggers forfeit after FORFEIT_TIMEOUT_MS", async () => {
      vi.mocked(prisma.match.findUnique).mockResolvedValue({
        id: "match-1",
        status: "active",
        seed: "test-seed",
        score: { teamA: 1, teamB: 0 },
      });
      vi.mocked(prisma.teamSelection.findMany).mockResolvedValue([
        { userId: "user-a", teamId: "team-a" },
        { userId: "user-b", teamId: "team-b" },
      ]);
      vi.mocked(prisma.turn.findMany).mockResolvedValue([
        { number: 1, payload: { gameState: { score: { teamA: 1, teamB: 0 }, gamePhase: "playing" } } },
      ]);
      vi.mocked(prisma.match.update).mockResolvedValue({});
      vi.mocked(prisma.turn.create).mockResolvedValue({});

      startForfeitTimer("match-1", "user-a");

      await vi.advanceTimersByTimeAsync(FORFEIT_TIMEOUT_MS);

      expect(prisma.match.findUnique).toHaveBeenCalledWith({
        where: { id: "match-1" },
        select: { id: true, status: true },
      });
      expect(prisma.match.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "match-1" },
          data: expect.objectContaining({ status: "ended" }),
        }),
      );
      expect(broadcastMatchForfeited).toHaveBeenCalledWith(
        "match-1",
        "user-a",
        expect.any(Object),
      );
    });

    it("does not forfeit if match is no longer active", async () => {
      vi.mocked(prisma.match.findUnique).mockResolvedValue({
        id: "match-1",
        status: "ended",
      });

      startForfeitTimer("match-1", "user-a");

      await vi.advanceTimersByTimeAsync(FORFEIT_TIMEOUT_MS);

      expect(prisma.match.update).not.toHaveBeenCalled();
      expect(broadcastMatchForfeited).not.toHaveBeenCalled();
    });

    it("does not forfeit if match not found", async () => {
      vi.mocked(prisma.match.findUnique).mockResolvedValue(null);

      startForfeitTimer("match-1", "user-a");

      await vi.advanceTimersByTimeAsync(FORFEIT_TIMEOUT_MS);

      expect(prisma.match.update).not.toHaveBeenCalled();
    });

    it("cleans up the timer entry after forfeit triggers", async () => {
      vi.mocked(prisma.match.findUnique).mockResolvedValue({
        id: "match-1",
        status: "active",
      });
      vi.mocked(prisma.teamSelection.findMany).mockResolvedValue([
        { userId: "user-a", teamId: "team-a" },
        { userId: "user-b", teamId: "team-b" },
      ]);
      vi.mocked(prisma.turn.findMany).mockResolvedValue([
        { number: 1, payload: { gameState: { score: { teamA: 0, teamB: 0 }, gamePhase: "playing" } } },
      ]);
      vi.mocked(prisma.match.update).mockResolvedValue({});
      vi.mocked(prisma.turn.create).mockResolvedValue({});

      startForfeitTimer("match-1", "user-a");

      await vi.advanceTimersByTimeAsync(FORFEIT_TIMEOUT_MS);

      expect(getActiveForfeitTimers().has("match-1:user-a")).toBe(false);
    });

    it("updates ELO on forfeit (forfeiting player loses)", async () => {
      vi.mocked(prisma.match.findUnique).mockResolvedValue({
        id: "match-1",
        status: "active",
      });
      vi.mocked(prisma.teamSelection.findMany).mockResolvedValue([
        { userId: "user-a", teamId: "team-a" },
        { userId: "user-b", teamId: "team-b" },
      ]);
      vi.mocked(prisma.turn.findMany).mockResolvedValue([
        { number: 1, payload: { gameState: { score: { teamA: 0, teamB: 0 }, gamePhase: "playing" } } },
      ]);
      vi.mocked(prisma.match.update).mockResolvedValue({});
      vi.mocked(prisma.turn.create).mockResolvedValue({});

      startForfeitTimer("match-1", "user-a");

      await vi.advanceTimersByTimeAsync(FORFEIT_TIMEOUT_MS);

      // user-a is team A (first selection), so user-a forfeits => team B wins
      // ELO: scoreA=0 scoreB=1 to represent forfeit loss for team A
      expect(updateEloAfterMatch).toHaveBeenCalledWith(
        prisma,
        "user-a",
        "user-b",
        0,
        1,
      );
    });
  });

  describe("cancelForfeitTimer", () => {
    it("cancels an active timer", () => {
      startForfeitTimer("match-1", "user-a");
      expect(getActiveForfeitTimers().has("match-1:user-a")).toBe(true);

      cancelForfeitTimer("match-1", "user-a");
      expect(getActiveForfeitTimers().has("match-1:user-a")).toBe(false);
    });

    it("does nothing if no timer exists", () => {
      expect(() => cancelForfeitTimer("match-1", "user-a")).not.toThrow();
    });

    it("prevents forfeit from triggering after cancel", async () => {
      vi.mocked(prisma.match.findUnique).mockResolvedValue({
        id: "match-1",
        status: "active",
      });

      startForfeitTimer("match-1", "user-a");
      cancelForfeitTimer("match-1", "user-a");

      await vi.advanceTimersByTimeAsync(FORFEIT_TIMEOUT_MS);

      expect(prisma.match.update).not.toHaveBeenCalled();
      expect(broadcastMatchForfeited).not.toHaveBeenCalled();
    });
  });

  describe("resetForfeitTimers", () => {
    it("clears all timers", () => {
      startForfeitTimer("match-1", "user-a");
      startForfeitTimer("match-2", "user-b");
      expect(getActiveForfeitTimers().size).toBe(2);

      resetForfeitTimers();
      expect(getActiveForfeitTimers().size).toBe(0);
    });
  });
});
