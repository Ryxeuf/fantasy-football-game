import { describe, it, expect, vi } from "vitest";
import { updateEloAfterMatch } from "./elo-update";

function createMockPrisma(ratingA = 1000, ratingB = 1000) {
  const users: Record<string, { eloRating: number }> = {
    "user-a": { eloRating: ratingA },
    "user-b": { eloRating: ratingB },
  };

  return {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        return users[where.id] ?? null;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: { eloRating: number } }) => {
        if (users[where.id]) {
          users[where.id] = { eloRating: data.eloRating };
        }
        return users[where.id];
      }),
    },
    _users: users,
  };
}

describe("updateEloAfterMatch", () => {
  it("increases winner rating and decreases loser rating on win", async () => {
    const prisma = createMockPrisma(1000, 1000);
    const result = await updateEloAfterMatch(prisma, "user-a", "user-b", 2, 1);

    expect(result.deltaA).toBeGreaterThan(0);
    expect(result.deltaB).toBeLessThan(0);
    expect(result.newRatingA).toBeGreaterThan(1000);
    expect(result.newRatingB).toBeLessThan(1000);
  });

  it("updates the correct user when team B wins", async () => {
    const prisma = createMockPrisma(1000, 1000);
    const result = await updateEloAfterMatch(prisma, "user-a", "user-b", 0, 3);

    expect(result.deltaA).toBeLessThan(0);
    expect(result.deltaB).toBeGreaterThan(0);
    expect(result.newRatingB).toBeGreaterThan(1000);
  });

  it("handles draws with no change for equal ratings", async () => {
    const prisma = createMockPrisma(1000, 1000);
    const result = await updateEloAfterMatch(prisma, "user-a", "user-b", 1, 1);

    expect(result.deltaA).toBe(0);
    expect(result.deltaB).toBe(0);
  });

  it("handles draws between unequal ratings", async () => {
    const prisma = createMockPrisma(1200, 800);
    const result = await updateEloAfterMatch(prisma, "user-a", "user-b", 0, 0);

    // Weaker player gains from drawing stronger player
    expect(result.deltaB).toBeGreaterThan(0);
    expect(result.deltaA).toBeLessThan(0);
  });

  it("persists new ratings to database", async () => {
    const prisma = createMockPrisma(1000, 1000);
    await updateEloAfterMatch(prisma, "user-a", "user-b", 2, 0);

    expect(prisma.user.update).toHaveBeenCalledTimes(2);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-a" },
        data: { eloRating: expect.any(Number) },
      }),
    );
  });

  it("never drops rating below minimum (100)", async () => {
    const prisma = createMockPrisma(100, 2000);
    const result = await updateEloAfterMatch(prisma, "user-a", "user-b", 0, 5);

    expect(result.newRatingA).toBeGreaterThanOrEqual(100);
  });

  it("throws when a user is not found", async () => {
    const prisma = createMockPrisma();
    await expect(
      updateEloAfterMatch(prisma, "user-a", "unknown-user", 1, 0),
    ).rejects.toThrow("introuvables");
  });

  it("returns correct old and new ratings", async () => {
    const prisma = createMockPrisma(1200, 900);
    const result = await updateEloAfterMatch(prisma, "user-a", "user-b", 3, 1);

    expect(result.oldRatingA).toBe(1200);
    expect(result.oldRatingB).toBe(900);
    expect(result.newRatingA).toBe(result.oldRatingA + result.deltaA);
    expect(result.newRatingB).toBe(result.oldRatingB + result.deltaB);
  });
});
