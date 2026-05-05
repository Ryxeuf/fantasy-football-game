/**
 * S26 DoD — Tests du service `tutorial-completion`.
 *
 * Service de telemetrie pour mesurer le KPI sprint 26 :
 * "80% des nouveaux comptes finissent au moins une lecon".
 *
 * - `recordTutorialCompletion(userId, lessonSlug)` : idempotent,
 *   upsert sur (userId, lessonSlug).
 * - `getTutorialCompletionRate(opts?)` : ratio de comptes (eligibles
 *   selon `since`) qui ont au moins une `TutorialCompletion`.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    tutorialCompletion: {
      upsert: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      count: vi.fn(),
    },
  },
}));

import { prisma } from "../prisma";
import {
  recordTutorialCompletion,
  getTutorialCompletionRate,
} from "./tutorial-completion";

const mockPrisma = prisma as unknown as {
  tutorialCompletion: {
    upsert: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  user: {
    count: ReturnType<typeof vi.fn>;
  };
};

describe("recordTutorialCompletion (S26 DoD)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upsert sur (userId, lessonSlug) — premier appel", async () => {
    mockPrisma.tutorialCompletion.upsert.mockResolvedValue({
      id: "tc-1",
      userId: "user-1",
      lessonSlug: "intro",
      completedAt: new Date("2026-05-05T10:00:00Z"),
    });
    const r = await recordTutorialCompletion("user-1", "intro");
    expect(mockPrisma.tutorialCompletion.upsert).toHaveBeenCalledWith({
      where: {
        userId_lessonSlug: { userId: "user-1", lessonSlug: "intro" },
      },
      update: {},
      create: { userId: "user-1", lessonSlug: "intro" },
    });
    expect(r.lessonSlug).toBe("intro");
    expect(r.userId).toBe("user-1");
  });

  it("est idempotent — second appel ne duplique pas", async () => {
    mockPrisma.tutorialCompletion.upsert.mockResolvedValue({
      id: "tc-1",
      userId: "user-1",
      lessonSlug: "intro",
      completedAt: new Date("2026-05-05T10:00:00Z"),
    });
    await recordTutorialCompletion("user-1", "intro");
    await recordTutorialCompletion("user-1", "intro");
    expect(mockPrisma.tutorialCompletion.upsert).toHaveBeenCalledTimes(2);
  });

  it("rejette les inputs invalides (userId vide)", async () => {
    await expect(recordTutorialCompletion("", "intro")).rejects.toThrow(
      /userId/i,
    );
    expect(mockPrisma.tutorialCompletion.upsert).not.toHaveBeenCalled();
  });

  it("rejette les inputs invalides (lessonSlug vide)", async () => {
    await expect(recordTutorialCompletion("user-1", "")).rejects.toThrow(
      /lessonSlug/i,
    );
    expect(mockPrisma.tutorialCompletion.upsert).not.toHaveBeenCalled();
  });

  it("trim le slug pour eviter les variations a la marge", async () => {
    mockPrisma.tutorialCompletion.upsert.mockResolvedValue({
      id: "tc-1",
      userId: "user-1",
      lessonSlug: "intro",
      completedAt: new Date(),
    });
    await recordTutorialCompletion("user-1", "  intro  ");
    expect(mockPrisma.tutorialCompletion.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { userId: "user-1", lessonSlug: "intro" },
      }),
    );
  });
});

describe("getTutorialCompletionRate (S26 DoD)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne 0 quand il n'y a aucun utilisateur eligible", async () => {
    mockPrisma.user.count.mockResolvedValue(0);
    mockPrisma.tutorialCompletion.findMany.mockResolvedValue([]);
    const r = await getTutorialCompletionRate();
    expect(r).toEqual({
      eligibleUsers: 0,
      usersCompletedAtLeastOne: 0,
      ratio: 0,
    });
  });

  it("calcule le ratio sur l'ensemble du parc utilisateurs", async () => {
    mockPrisma.user.count.mockResolvedValue(10);
    mockPrisma.tutorialCompletion.findMany.mockResolvedValue([
      { userId: "u1" },
      { userId: "u2" },
      { userId: "u3" },
      { userId: "u4" },
      { userId: "u5" },
      { userId: "u6" },
      { userId: "u7" },
      { userId: "u8" },
    ]);
    const r = await getTutorialCompletionRate();
    expect(r.eligibleUsers).toBe(10);
    expect(r.usersCompletedAtLeastOne).toBe(8);
    expect(r.ratio).toBeCloseTo(0.8, 2);
  });

  it("dedup les userIds quand un compte a fini plusieurs lecons", async () => {
    mockPrisma.user.count.mockResolvedValue(5);
    mockPrisma.tutorialCompletion.findMany.mockResolvedValue([
      { userId: "u1" },
      { userId: "u1" },
      { userId: "u2" },
    ]);
    const r = await getTutorialCompletionRate();
    expect(r.eligibleUsers).toBe(5);
    expect(r.usersCompletedAtLeastOne).toBe(2);
    expect(r.ratio).toBe(0.4);
  });

  it("filtre par `since` quand fourni (cohorte recente)", async () => {
    const since = new Date("2026-04-01T00:00:00Z");
    mockPrisma.user.count.mockResolvedValue(20);
    mockPrisma.tutorialCompletion.findMany.mockResolvedValue([
      { userId: "u1" },
      { userId: "u2" },
    ]);
    await getTutorialCompletionRate({ since });
    expect(mockPrisma.user.count).toHaveBeenCalledWith({
      where: { createdAt: { gte: since } },
    });
    expect(mockPrisma.tutorialCompletion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user: { createdAt: { gte: since } } },
      }),
    );
  });
});
