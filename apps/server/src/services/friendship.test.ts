import { describe, it, expect, beforeEach, vi } from "vitest";

// Audit round 8 : respondToFriendRequest utilise maintenant updateMany
// conditionnel WHERE { id, receiverId, status: 'pending' } + re-fetch.
vi.mock("../prisma", () => ({
  prisma: {
    friendship: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(async () => ({ count: 1 })),
      delete: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("./in-app-notifications", () => ({
  createInAppNotification: vi.fn().mockResolvedValue(null),
}));

import { prisma } from "../prisma";
import { createInAppNotification } from "./in-app-notifications";
import {
  sendFriendRequest,
  respondToFriendRequest,
  listFriendships,
  removeFriendship,
  areFriends,
  listAcceptedFriendIds,
  FriendshipStatus,
} from "./friendship";

const mockPrisma = prisma as any;
const mockInApp = createInAppNotification as ReturnType<typeof vi.fn>;

describe("Rule: Friendship service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const alice = "user-alice";
  const bob = "user-bob";

  describe("sendFriendRequest", () => {
    it("creates a new pending request when no relationship exists", async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: bob });
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
      mockPrisma.user.findFirst.mockResolvedValue(null);
      await expect(sendFriendRequest(alice, bob)).rejects.toThrow(
        /introuvable|not found/i,
      );
      expect(mockPrisma.friendship.create).not.toHaveBeenCalled();
    });

    it("rejects when a request already exists in either direction", async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: bob });
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
    // Audit round 8 : la fonction utilise updateMany conditionnel.
    // count: 1 = happy path ; count: 0 = race / authz fail.
    it("accepts a pending request addressed to the current user", async () => {
      mockPrisma.friendship.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.friendship.findUnique.mockResolvedValue({
        id: "f-1",
        requesterId: alice,
        receiverId: bob,
        status: "accepted",
      });

      const result = await respondToFriendRequest("f-1", bob, "accept");

      expect(result.status).toBe("accepted");
      expect(mockPrisma.friendship.updateMany).toHaveBeenCalledWith({
        where: { id: "f-1", receiverId: bob, status: "pending" },
        data: { status: "accepted" },
      });
    });

    it("declines a pending request addressed to the current user", async () => {
      mockPrisma.friendship.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.friendship.findUnique.mockResolvedValue({
        id: "f-1",
        requesterId: alice,
        receiverId: bob,
        status: "declined",
      });

      const result = await respondToFriendRequest("f-1", bob, "decline");

      expect(result.status).toBe("declined");
    });

    it("rejects if the current user is not the receiver", async () => {
      mockPrisma.friendship.updateMany.mockResolvedValueOnce({ count: 0 });
      mockPrisma.friendship.findUnique.mockResolvedValue({
        id: "f-1",
        requesterId: alice,
        receiverId: bob,
        status: "pending",
      });

      await expect(
        respondToFriendRequest("f-1", "user-other", "accept"),
      ).rejects.toThrow(/autorise|unauthorized/i);
    });

    it("rejects if the request is not pending", async () => {
      mockPrisma.friendship.updateMany.mockResolvedValueOnce({ count: 0 });
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
      mockPrisma.friendship.updateMany.mockResolvedValueOnce({ count: 0 });
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

  describe("listAcceptedFriendIds (S26.5b)", () => {
    it("returns an empty array (no DB call) for empty userId", async () => {
      expect(await listAcceptedFriendIds("")).toEqual([]);
      expect(mockPrisma.friendship.findMany).not.toHaveBeenCalled();
    });

    it("queries only accepted friendships involving the user", async () => {
      mockPrisma.friendship.findMany.mockResolvedValue([]);
      await listAcceptedFriendIds("u-self");
      const arg = mockPrisma.friendship.findMany.mock.calls[0][0];
      expect(arg.where.status).toBe(FriendshipStatus.Accepted);
      expect(arg.where.OR).toEqual([
        { requesterId: "u-self" },
        { receiverId: "u-self" },
      ]);
    });

    it("returns the friend id from each row, regardless of direction", async () => {
      mockPrisma.friendship.findMany.mockResolvedValue([
        { requesterId: "u-self", receiverId: "u-friend1" },
        { requesterId: "u-friend2", receiverId: "u-self" },
      ]);
      const result = await listAcceptedFriendIds("u-self");
      expect(new Set(result)).toEqual(new Set(["u-friend1", "u-friend2"]));
    });

    it("dedupes when the same friend appears twice (defensive)", async () => {
      mockPrisma.friendship.findMany.mockResolvedValue([
        { requesterId: "u-self", receiverId: "u-friend1" },
        { requesterId: "u-friend1", receiverId: "u-self" },
      ]);
      const result = await listAcceptedFriendIds("u-self");
      expect(result).toEqual(["u-friend1"]);
    });

    it("never includes the requester itself", async () => {
      mockPrisma.friendship.findMany.mockResolvedValue([
        { requesterId: "u-self", receiverId: "u-friend1" },
      ]);
      const result = await listAcceptedFriendIds("u-self");
      expect(result).not.toContain("u-self");
    });
  });
});

describe("Friendship → notifications internes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const alice = "user-alice";
  const bob = "user-bob";

  it("une demande envoyée notifie le destinataire avec le nom du demandeur", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: bob });
    mockPrisma.friendship.findFirst.mockResolvedValue(null);
    mockPrisma.friendship.create.mockResolvedValue({
      id: "f-1",
      requesterId: alice,
      receiverId: bob,
      status: "pending",
    });
    mockPrisma.user.findUnique.mockResolvedValue({ coachName: "Alice" });

    await sendFriendRequest(alice, bob);

    expect(mockInApp).toHaveBeenCalledTimes(1);
    expect(mockInApp).toHaveBeenCalledWith({
      userId: bob,
      kind: "friend.request",
      title: "Demande d'ami",
      body: "Alice souhaite t'ajouter en ami",
      url: null,
      meta: { friendshipId: "f-1", actorUserId: alice },
    });
  });

  it("repli « Un coach » quand le nom du demandeur est inconnu", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: bob });
    mockPrisma.friendship.findFirst.mockResolvedValue(null);
    mockPrisma.friendship.create.mockResolvedValue({
      id: "f-2",
      requesterId: alice,
      receiverId: bob,
      status: "pending",
    });
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await sendFriendRequest(alice, bob);
    expect(mockInApp.mock.calls[0][0].body).toBe("Un coach souhaite t'ajouter en ami");
  });

  it("un échec du lookup de nom ne fait pas échouer la demande", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: bob });
    mockPrisma.friendship.findFirst.mockResolvedValue(null);
    mockPrisma.friendship.create.mockResolvedValue({
      id: "f-3",
      requesterId: alice,
      receiverId: bob,
      status: "pending",
    });
    mockPrisma.user.findUnique.mockRejectedValue(new Error("db down"));

    await expect(sendFriendRequest(alice, bob)).resolves.toMatchObject({
      id: "f-3",
    });
    expect(mockInApp).not.toHaveBeenCalled();
  });

  it("l'acceptation notifie le demandeur ; le refus reste silencieux", async () => {
    mockPrisma.friendship.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.friendship.findUnique.mockResolvedValue({
      id: "f-1",
      requesterId: alice,
      receiverId: bob,
      status: "accepted",
    });
    mockPrisma.user.findUnique.mockResolvedValue({ coachName: "Bob" });

    await respondToFriendRequest("f-1", bob, "accept");
    expect(mockInApp).toHaveBeenCalledWith({
      userId: alice,
      kind: "friend.accepted",
      title: "Demande d'ami acceptée",
      body: "Bob a accepté ta demande d'ami",
      url: null,
      meta: { friendshipId: "f-1", actorUserId: bob },
    });

    mockInApp.mockClear();
    mockPrisma.friendship.findUnique.mockResolvedValue({
      id: "f-1",
      requesterId: alice,
      receiverId: bob,
      status: "declined",
    });
    await respondToFriendRequest("f-1", bob, "decline");
    expect(mockInApp).not.toHaveBeenCalled();
  });
});
