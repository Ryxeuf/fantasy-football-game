/**
 * Tests pour `suggestFriendsByElo` (S26.5a).
 *
 * Verifie le service de suggestions d'amis basee sur le rating ELO.
 * Exclut soi-meme + les comptes deja en relation (toutes statuts) +
 * les profils prives + les comptes non valides.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    friendship: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "../prisma";
import { suggestFriendsByElo } from "./friend-suggestions";

const mockPrisma = prisma as unknown as {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  friendship: {
    findMany: ReturnType<typeof vi.fn>;
  };
};

describe("suggestFriendsByElo (S26.5a)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an empty array when the requester does not exist", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    expect(await suggestFriendsByElo("ghost")).toEqual([]);
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
  });

  it("queries users within +/- range around the requester ELO", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u-self",
      eloRating: 1200,
    });
    mockPrisma.friendship.findMany.mockResolvedValue([]);
    mockPrisma.user.findMany.mockResolvedValue([]);

    await suggestFriendsByElo("u-self", 100);

    const arg = mockPrisma.user.findMany.mock.calls[0][0] as {
      where: {
        valid: boolean;
        privateProfile: boolean;
        eloRating: { gte: number; lte: number };
        id: { notIn: string[] };
      };
      take: number;
    };
    expect(arg.where.valid).toBe(true);
    expect(arg.where.privateProfile).toBe(false);
    expect(arg.where.eloRating.gte).toBe(1100);
    expect(arg.where.eloRating.lte).toBe(1300);
  });

  it("excludes self + every user already in a friendship (any status)", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u-self",
      eloRating: 1200,
    });
    mockPrisma.friendship.findMany.mockResolvedValue([
      { requesterId: "u-self", receiverId: "u-friend1" },
      { requesterId: "u-blocked", receiverId: "u-self" },
    ]);
    mockPrisma.user.findMany.mockResolvedValue([]);

    await suggestFriendsByElo("u-self");

    const arg = mockPrisma.user.findMany.mock.calls[0][0] as {
      where: { id: { notIn: string[] } };
    };
    expect(new Set(arg.where.id.notIn)).toEqual(
      new Set(["u-self", "u-friend1", "u-blocked"]),
    );
  });

  it("default range is +/- 100 ELO and default limit is 10", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u-self",
      eloRating: 1500,
    });
    mockPrisma.friendship.findMany.mockResolvedValue([]);
    mockPrisma.user.findMany.mockResolvedValue([]);

    await suggestFriendsByElo("u-self");

    const arg = mockPrisma.user.findMany.mock.calls[0][0] as {
      where: { eloRating: { gte: number; lte: number } };
      take: number;
    };
    expect(arg.where.eloRating.gte).toBe(1400);
    expect(arg.where.eloRating.lte).toBe(1600);
    expect(arg.take).toBe(10);
  });

  it("orders results by ELO proximity (closest first) and returns compact DTOs", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u-self",
      eloRating: 1200,
    });
    mockPrisma.friendship.findMany.mockResolvedValue([]);
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "u-1", coachName: "Far", eloRating: 1290 },
      { id: "u-2", coachName: "Near", eloRating: 1205 },
      { id: "u-3", coachName: "Mid", eloRating: 1180 },
    ]);

    const result = await suggestFriendsByElo("u-self");

    expect(result.map((r) => r.id)).toEqual(["u-2", "u-3", "u-1"]);
    expect(result[0]).toEqual({
      id: "u-2",
      coachName: "Near",
      eloRating: 1205,
      eloDelta: 5,
    });
  });

  it("respects a custom limit (cap 50)", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u-self",
      eloRating: 1500,
    });
    mockPrisma.friendship.findMany.mockResolvedValue([]);
    mockPrisma.user.findMany.mockResolvedValue([]);

    await suggestFriendsByElo("u-self", 100, 25);
    const arg1 = mockPrisma.user.findMany.mock.calls[0][0] as { take: number };
    expect(arg1.take).toBe(25);

    await suggestFriendsByElo("u-self", 100, 9999);
    const arg2 = mockPrisma.user.findMany.mock.calls[1][0] as { take: number };
    expect(arg2.take).toBe(50);
  });
});
