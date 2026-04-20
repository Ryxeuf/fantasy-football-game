import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    friendship: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "../prisma";
import {
  sendFriendRequest,
  respondToFriendRequest,
  listFriendships,
  removeFriendship,
  areFriends,
  FriendshipStatus,
} from "./friendship";

const mockPrisma = prisma as any;

describe("Rule: Friendship service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const alice = "user-alice";
  const bob = "user-bob";

  describe("sendFriendRequest", () => {
    it("creates a new pending request when no relationship exists", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: bob });
      mockPrisma.friendship.findFirst.mockResolvedValue(null);
      const created = {
        id: "f-1",
        requesterId: alice,
        receiverId: bob,
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.friendship.create.mockResolvedValue(created);

      const result = await sendFriendRequest(alice, bob);

      expect(result.status).toBe("pending");
      expect(result.requesterId).toBe(alice);
      expect(result.receiverId).toBe(bob);
      expect(mockPrisma.friendship.create).toHaveBeenCalledWith({
        data: { requesterId: alice, receiverId: bob, status: "pending" },
      });
    });

    it("rejects self-friendship", async () => {
      await expect(sendFriendRequest(alice, alice)).rejects.toThrow(
        /soi-meme|yourself|self/i,
      );
      expect(mockPrisma.friendship.create).not.toHaveBeenCalled();
    });

    it("rejects when receiver does not exist", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(sendFriendRequest(alice, bob)).rejects.toThrow(
        /introuvable|not found/i,
      );
      expect(mockPrisma.friendship.create).not.toHaveBeenCalled();
    });

    it("rejects when a request already exists in either direction", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: bob });
      mockPrisma.friendship.findFirst.mockResolvedValue({
        id: "existing",
        requesterId: bob,
        receiverId: alice,
        status: "pending",
      });

      await expect(sendFriendRequest(alice, bob)).rejects.toThrow(/existe/i);
      expect(mockPrisma.friendship.create).not.toHaveBeenCalled();
    });
  });

  describe("respondToFriendRequest", () => {
    it("accepts a pending request addressed to the current user", async () => {
      mockPrisma.friendship.findUnique.mockResolvedValue({
        id: "f-1",
        requesterId: alice,
        receiverId: bob,
        status: "pending",
      });
      mockPrisma.friendship.update.mockResolvedValue({
        id: "f-1",
        requesterId: alice,
        receiverId: bob,
        status: "accepted",
      });

      const result = await respondToFriendRequest("f-1", bob, "accept");

      expect(result.status).toBe("accepted");
      expect(mockPrisma.friendship.update).toHaveBeenCalledWith({
        where: { id: "f-1" },
        data: { status: "accepted" },
      });
    });

    it("declines a pending request addressed to the current user", async () => {
      mockPrisma.friendship.findUnique.mockResolvedValue({
        id: "f-1",
        requesterId: alice,
        receiverId: bob,
        status: "pending",
      });
      mockPrisma.friendship.update.mockResolvedValue({
        id: "f-1",
        requesterId: alice,
        receiverId: bob,
        status: "declined",
      });

      const result = await respondToFriendRequest("f-1", bob, "decline");

      expect(result.status).toBe("declined");
    });

    it("rejects if the current user is not the receiver", async () => {
      mockPrisma.friendship.findUnique.mockResolvedValue({
        id: "f-1",
        requesterId: alice,
        receiverId: bob,
        status: "pending",
      });

      await expect(
        respondToFriendRequest("f-1", "user-other", "accept"),
      ).rejects.toThrow(/autorise|unauthorized/i);
      expect(mockPrisma.friendship.update).not.toHaveBeenCalled();
    });

    it("rejects if the request is not pending", async () => {
      mockPrisma.friendship.findUnique.mockResolvedValue({
        id: "f-1",
        requesterId: alice,
        receiverId: bob,
        status: "accepted",
      });

      await expect(
        respondToFriendRequest("f-1", bob, "accept"),
      ).rejects.toThrow(/pending|attente/i);
    });

    it("rejects unknown friendship id", async () => {
      mockPrisma.friendship.findUnique.mockResolvedValue(null);
      await expect(
        respondToFriendRequest("missing", bob, "accept"),
      ).rejects.toThrow(/introuvable|not found/i);
    });
  });

  describe("listFriendships", () => {
    it("returns all friendships involving the user when no status filter", async () => {
      const rows = [
        {
          id: "f-1",
          requesterId: alice,
          receiverId: bob,
          status: "accepted",
          requester: { id: alice, coachName: "Alice" },
          receiver: { id: bob, coachName: "Bob" },
        },
      ];
      mockPrisma.friendship.findMany.mockResolvedValue(rows);

      const result = await listFriendships(alice);

      expect(result).toHaveLength(1);
      expect(mockPrisma.friendship.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [{ requesterId: alice }, { receiverId: alice }],
          },
        }),
      );
    });

    it("applies status filter when provided", async () => {
      mockPrisma.friendship.findMany.mockResolvedValue([]);
      await listFriendships(alice, "pending");

      expect(mockPrisma.friendship.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { OR: [{ requesterId: alice }, { receiverId: alice }] },
              { status: "pending" },
            ],
          },
        }),
      );
    });
  });

  describe("removeFriendship", () => {
    it("deletes a friendship the user participates in", async () => {
      mockPrisma.friendship.findUnique.mockResolvedValue({
        id: "f-1",
        requesterId: alice,
        receiverId: bob,
        status: "accepted",
      });
      mockPrisma.friendship.delete.mockResolvedValue({ id: "f-1" });

      await removeFriendship("f-1", alice);

      expect(mockPrisma.friendship.delete).toHaveBeenCalledWith({
        where: { id: "f-1" },
      });
    });

    it("rejects if the user does not participate in the friendship", async () => {
      mockPrisma.friendship.findUnique.mockResolvedValue({
        id: "f-1",
        requesterId: alice,
        receiverId: bob,
        status: "accepted",
      });

      await expect(removeFriendship("f-1", "user-other")).rejects.toThrow(
        /autorise|unauthorized/i,
      );
      expect(mockPrisma.friendship.delete).not.toHaveBeenCalled();
    });

    it("rejects unknown friendship id", async () => {
      mockPrisma.friendship.findUnique.mockResolvedValue(null);
      await expect(removeFriendship("missing", alice)).rejects.toThrow(
        /introuvable|not found/i,
      );
    });
  });

  describe("areFriends", () => {
    it("returns true when an accepted friendship exists in either direction", async () => {
      mockPrisma.friendship.findFirst.mockResolvedValue({
        id: "f-1",
        requesterId: alice,
        receiverId: bob,
        status: "accepted",
      });

      expect(await areFriends(alice, bob)).toBe(true);
    });

    it("returns false when no accepted friendship exists", async () => {
      mockPrisma.friendship.findFirst.mockResolvedValue(null);
      expect(await areFriends(alice, bob)).toBe(false);
    });
  });

  describe("FriendshipStatus enum", () => {
    it("exposes the four canonical statuses", () => {
      expect(FriendshipStatus.Pending).toBe("pending");
      expect(FriendshipStatus.Accepted).toBe("accepted");
      expect(FriendshipStatus.Declined).toBe("declined");
      expect(FriendshipStatus.Blocked).toBe("blocked");
    });
  });
});
