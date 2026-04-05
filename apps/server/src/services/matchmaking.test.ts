import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock prisma
vi.mock("../prisma", () => ({
  prisma: {
    team: {
      findUnique: vi.fn(),
    },
    matchQueue: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    match: {
      create: vi.fn(),
    },
    teamSelection: {
      createMany: vi.fn(),
    },
  },
}));

import { prisma } from "../prisma";
import {
  joinQueue,
  leaveQueue,
  getQueueStatus,
  cleanupStaleEntries,
} from "./matchmaking";

const mockPrisma = prisma as any;

describe("Matchmaking Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("joinQueue", () => {
    const userId = "user-1";
    const teamId = "team-1";

    it("throws if team does not exist", async () => {
      mockPrisma.team.findUnique.mockResolvedValue(null);

      await expect(joinQueue({ userId, teamId })).rejects.toThrow(
        "Equipe introuvable",
      );
    });

    it("throws if team does not belong to user", async () => {
      mockPrisma.team.findUnique.mockResolvedValue({
        id: teamId,
        ownerId: "other-user",
        currentValue: 1000000,
      });

      await expect(joinQueue({ userId, teamId })).rejects.toThrow(
        "Cette equipe ne vous appartient pas",
      );
    });

    it("throws if user is already searching", async () => {
      mockPrisma.team.findUnique.mockResolvedValue({
        id: teamId,
        ownerId: userId,
        currentValue: 1000000,
      });
      mockPrisma.matchQueue.findUnique.mockResolvedValue({
        id: "q-1",
        userId,
        status: "searching",
      });

      await expect(joinQueue({ userId, teamId })).rejects.toThrow(
        "Vous etes deja en file d'attente",
      );
    });

    it("adds user to queue when no opponent available", async () => {
      mockPrisma.team.findUnique.mockResolvedValue({
        id: teamId,
        ownerId: userId,
        currentValue: 1000000,
      });
      mockPrisma.matchQueue.findUnique.mockResolvedValue(null);
      mockPrisma.matchQueue.findMany.mockResolvedValue([]); // No compatible opponent
      mockPrisma.matchQueue.create.mockResolvedValue({
        id: "q-new",
        userId,
        teamId,
        teamValue: 1000000,
        status: "searching",
      });
      mockPrisma.matchQueue.count.mockResolvedValue(1);

      const result = await joinQueue({ userId, teamId });

      expect(result.matched).toBe(false);
      if (!result.matched) {
        expect(result.queueId).toBe("q-new");
        expect(result.teamValue).toBe(1000000);
        expect(result.position).toBe(1);
      }
      expect(mockPrisma.matchQueue.create).toHaveBeenCalledWith({
        data: {
          userId,
          teamId,
          teamValue: 1000000,
          status: "searching",
        },
      });
    });

    it("matches with compatible opponent (TV within 150k)", async () => {
      const opponentEntry = {
        id: "q-opp",
        userId: "user-2",
        teamId: "team-2",
        teamValue: 1050000,
        status: "searching",
        joinedAt: new Date(),
      };

      mockPrisma.team.findUnique.mockResolvedValue({
        id: teamId,
        ownerId: userId,
        currentValue: 1000000,
      });
      mockPrisma.matchQueue.findUnique.mockResolvedValue(null);
      mockPrisma.matchQueue.findMany.mockResolvedValue([opponentEntry]);
      mockPrisma.match.create.mockResolvedValue({
        id: "match-new",
        status: "pending",
        seed: "test-seed",
      });
      mockPrisma.teamSelection.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.matchQueue.update.mockResolvedValue({
        ...opponentEntry,
        status: "matched",
        matchId: "match-new",
      });

      const result = await joinQueue({ userId, teamId });

      expect(result.matched).toBe(true);
      if (result.matched) {
        expect(result.matchId).toBe("match-new");
        expect(result.opponentUserId).toBe("user-2");
        expect(result.matchToken).toBeDefined();
      }

      // Verify match was created with both players
      expect(mockPrisma.match.create).toHaveBeenCalledWith({
        data: {
          status: "pending",
          seed: expect.any(String),
          players: {
            connect: [{ id: userId }, { id: "user-2" }],
          },
        },
      });

      // Verify team selections were created
      expect(mockPrisma.teamSelection.createMany).toHaveBeenCalledWith({
        data: [
          { matchId: "match-new", userId, teamId },
          { matchId: "match-new", userId: "user-2", teamId: "team-2" },
        ],
      });

      // Verify opponent's queue entry was updated
      expect(mockPrisma.matchQueue.update).toHaveBeenCalledWith({
        where: { id: "q-opp" },
        data: { status: "matched", matchId: "match-new" },
      });
    });

    it("cleans up stale queue entry before creating new one", async () => {
      mockPrisma.team.findUnique.mockResolvedValue({
        id: teamId,
        ownerId: userId,
        currentValue: 1000000,
      });
      // Existing cancelled/matched entry
      mockPrisma.matchQueue.findUnique.mockResolvedValue({
        id: "q-old",
        userId,
        status: "cancelled",
      });
      mockPrisma.matchQueue.delete.mockResolvedValue({});
      mockPrisma.matchQueue.findMany.mockResolvedValue([]);
      mockPrisma.matchQueue.create.mockResolvedValue({
        id: "q-new",
        userId,
        teamId,
        teamValue: 1000000,
        status: "searching",
      });
      mockPrisma.matchQueue.count.mockResolvedValue(1);

      const result = await joinQueue({ userId, teamId });

      expect(mockPrisma.matchQueue.delete).toHaveBeenCalledWith({
        where: { id: "q-old" },
      });
      expect(result.matched).toBe(false);
    });

    it("does NOT match opponents outside TV range", async () => {
      mockPrisma.team.findUnique.mockResolvedValue({
        id: teamId,
        ownerId: userId,
        currentValue: 1000000,
      });
      mockPrisma.matchQueue.findUnique.mockResolvedValue(null);
      // No compatible opponents (findMany returns empty)
      mockPrisma.matchQueue.findMany.mockResolvedValue([]);
      mockPrisma.matchQueue.create.mockResolvedValue({
        id: "q-new",
        userId,
        teamId,
        teamValue: 1000000,
        status: "searching",
      });
      mockPrisma.matchQueue.count.mockResolvedValue(1);

      const result = await joinQueue({ userId, teamId });
      expect(result.matched).toBe(false);

      // Verify the query used correct TV range
      expect(mockPrisma.matchQueue.findMany).toHaveBeenCalledWith({
        where: {
          status: "searching",
          userId: { not: userId },
          teamValue: { gte: 850000, lte: 1150000 },
        },
        orderBy: { joinedAt: "asc" },
        take: 1,
      });
    });
  });

  describe("leaveQueue", () => {
    it("cancels a searching entry", async () => {
      mockPrisma.matchQueue.findUnique.mockResolvedValue({
        id: "q-1",
        userId: "user-1",
        status: "searching",
      });
      mockPrisma.matchQueue.update.mockResolvedValue({
        id: "q-1",
        status: "cancelled",
      });

      const result = await leaveQueue("user-1");
      expect(result.ok).toBe(true);
      expect(mockPrisma.matchQueue.update).toHaveBeenCalledWith({
        where: { id: "q-1" },
        data: { status: "cancelled" },
      });
    });

    it("returns false if not in queue", async () => {
      mockPrisma.matchQueue.findUnique.mockResolvedValue(null);

      const result = await leaveQueue("user-1");
      expect(result.ok).toBe(false);
    });

    it("returns false if entry is not searching", async () => {
      mockPrisma.matchQueue.findUnique.mockResolvedValue({
        id: "q-1",
        userId: "user-1",
        status: "matched",
      });

      const result = await leaveQueue("user-1");
      expect(result.ok).toBe(false);
    });
  });

  describe("getQueueStatus", () => {
    it("returns the queue entry for the user", async () => {
      const entry = {
        id: "q-1",
        userId: "user-1",
        teamId: "team-1",
        teamValue: 1000000,
        status: "searching",
        matchId: null,
        joinedAt: new Date(),
      };
      mockPrisma.matchQueue.findUnique.mockResolvedValue(entry);

      const result = await getQueueStatus("user-1");
      expect(result).toEqual(entry);
    });

    it("returns null if user is not in queue", async () => {
      mockPrisma.matchQueue.findUnique.mockResolvedValue(null);

      const result = await getQueueStatus("user-1");
      expect(result).toBeNull();
    });
  });

  describe("cleanupStaleEntries", () => {
    it("cancels entries older than 30 minutes", async () => {
      mockPrisma.matchQueue.updateMany.mockResolvedValue({ count: 3 });

      const result = await cleanupStaleEntries();
      expect(result).toBe(3);
      expect(mockPrisma.matchQueue.updateMany).toHaveBeenCalledWith({
        where: {
          status: "searching",
          joinedAt: { lt: expect.any(Date) },
        },
        data: { status: "cancelled" },
      });
    });
  });
});
