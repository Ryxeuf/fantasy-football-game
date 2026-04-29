import { describe, it, expect, vi } from "vitest";
import { updateEloAfterMatch } from "./elo-update";

interface SnapshotRow {
  userId: string;
  rating: number;
  delta: number;
  matchId: string | null;
}

function createMockPrisma(ratingA = 1000, ratingB = 1000) {
  const users: Record<string, { eloRating: number }> = {
    "user-a": { eloRating: ratingA },
    "user-b": { eloRating: ratingB },
  };
  const snapshots: SnapshotRow[] = [];

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
    eloSnapshot: {
      create: vi.fn(async ({ data }: { data: SnapshotRow }) => {
        snapshots.push(data);
        return data;
      }),
    },
    _users: users,
    _snapshots: snapshots,
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

  // S26.3l — Each ELO update writes a snapshot row per user, used by the
  // 90-day ELO graph on /coach/{slug}.
  describe("EloSnapshot persistence (S26.3l)", () => {
    it("creates two snapshots, one per user", async () => {
      const prisma = createMockPrisma(1000, 1000);
      await updateEloAfterMatch(prisma, "user-a", "user-b", 2, 1);

      expect(prisma.eloSnapshot.create).toHaveBeenCalledTimes(2);
      expect(prisma._snapshots).toHaveLength(2);
    });

    it("stores the post-match rating and delta for each user", async () => {
      const prisma = createMockPrisma(1000, 1000);
      const result = await updateEloAfterMatch(prisma, "user-a", "user-b", 2, 1);

      const snapA = prisma._snapshots.find((s) => s.userId === "user-a");
      const snapB = prisma._snapshots.find((s) => s.userId === "user-b");
      expect(snapA).toEqual({
        userId: "user-a",
        rating: result.newRatingA,
        delta: result.deltaA,
        matchId: null,
      });
      expect(snapB).toEqual({
        userId: "user-b",
        rating: result.newRatingB,
        delta: result.deltaB,
        matchId: null,
      });
    });

    it("forwards an explicit matchId when provided", async () => {
      const prisma = createMockPrisma(1000, 1000);
      await updateEloAfterMatch(prisma, "user-a", "user-b", 2, 1, "match-42");

      expect(prisma._snapshots.every((s) => s.matchId === "match-42")).toBe(true);
    });

    it("does not write snapshots when one user is missing", async () => {
      const prisma = createMockPrisma();
      await expect(
        updateEloAfterMatch(prisma, "user-a", "unknown-user", 1, 0),
      ).rejects.toThrow();
      expect(prisma.eloSnapshot.create).not.toHaveBeenCalled();
    });

    it("clamps the recorded rating at the 100 floor", async () => {
      const prisma = createMockPrisma(100, 2000);
      await updateEloAfterMatch(prisma, "user-a", "user-b", 0, 5);

      const snapA = prisma._snapshots.find((s) => s.userId === "user-a");
      expect(snapA?.rating).toBeGreaterThanOrEqual(100);
      // Delta reflects the actual clamped change, not the raw calculation.
      expect(snapA?.rating).toBe(100 + (snapA?.delta ?? 0));
    });
  });
});
