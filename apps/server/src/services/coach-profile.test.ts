/**
 * Tests pour `getCoachPublicProfile` (S26.3b).
 *
 * Verifie le service qui fournit le DTO public d'un coach a partir de
 * son slug. Resoud le slug -> user, calcule le statut supporter, expose
 * pseudonyme + ELO + member-since. RGPD : `private profile` opt-in
 * (slice ulterieure) — ici on retourne tous les comptes valides.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
    },
    userAchievement: {
      findMany: vi.fn(),
    },
    team: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "../prisma";
import {
  getCoachPublicProfile,
  getCoachRecentTeams,
  getCoachShowcaseAchievements,
  listPublicCoachSlugs,
} from "./coach-profile";

const mockPrisma = prisma as unknown as {
  user: {
    findMany: ReturnType<typeof vi.fn>;
  };
  userAchievement: {
    findMany: ReturnType<typeof vi.fn>;
  };
  team: {
    findMany: ReturnType<typeof vi.fn>;
  };
};

const FIXED_NOW = new Date("2026-04-29T12:00:00.000Z");

function buildUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "u-1",
    coachName: "Coach Alpha",
    eloRating: 1234,
    patreon: false,
    supporterActiveUntil: null as Date | null,
    supporterTier: null as string | null,
    valid: true,
    createdAt: new Date("2025-12-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("getCoachPublicProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no user matches the slug", async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    const result = await getCoachPublicProfile("ghost-slug", FIXED_NOW);
    expect(result).toBeNull();
  });

  it("returns the public profile DTO when a user matches", async () => {
    mockPrisma.user.findMany.mockResolvedValue([buildUser()]);
    const result = await getCoachPublicProfile("coach-alpha", FIXED_NOW);
    expect(result).not.toBeNull();
    expect(result!.slug).toBe("coach-alpha");
    expect(result!.coachName).toBe("Coach Alpha");
    expect(result!.eloRating).toBe(1234);
    expect(result!.isSupporter).toBe(false);
    expect(result!.memberSince).toBe("2025-12-01T00:00:00.000Z");
  });

  it("flags the supporter status from supporterActiveUntil in the future", async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      buildUser({
        supporterActiveUntil: new Date("2026-12-31T00:00:00.000Z"),
        supporterTier: "Bronze",
      }),
    ]);
    const result = await getCoachPublicProfile("coach-alpha", FIXED_NOW);
    expect(result!.isSupporter).toBe(true);
    expect(result!.supporterTier).toBe("Bronze");
  });

  it("flags non-supporter when supporterActiveUntil is in the past", async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      buildUser({
        supporterActiveUntil: new Date("2025-01-01T00:00:00.000Z"),
        supporterTier: "Bronze",
      }),
    ]);
    const result = await getCoachPublicProfile("coach-alpha", FIXED_NOW);
    expect(result!.isSupporter).toBe(false);
  });

  it("only queries users with `valid: true` (skips unverified accounts)", async () => {
    mockPrisma.user.findMany.mockResolvedValue([buildUser()]);
    await getCoachPublicProfile("coach-alpha", FIXED_NOW);
    expect(mockPrisma.user.findMany).toHaveBeenCalledTimes(1);
    const arg = mockPrisma.user.findMany.mock.calls[0][0] as {
      where: { valid: boolean };
    };
    expect(arg.where).toEqual({ valid: true });
  });

  it("disambiguates collisions by returning the oldest matching account", async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      buildUser({
        id: "u-old",
        coachName: "Coach Alpha",
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
      }),
      buildUser({
        id: "u-new",
        coachName: "Coach   Alpha",
        createdAt: new Date("2025-12-01T00:00:00.000Z"),
      }),
    ]);
    const result = await getCoachPublicProfile("coach-alpha", FIXED_NOW);
    expect(result!.id).toBe("u-old");
  });

  it("matches accent-insensitive coach names (slug derivation reuses S26.3a)", async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      buildUser({ coachName: "Émile" }),
    ]);
    const result = await getCoachPublicProfile("emile", FIXED_NOW);
    expect(result).not.toBeNull();
    expect(result!.coachName).toBe("Émile");
    expect(result!.slug).toBe("emile");
  });

  it("returns null for an empty / whitespace slug input", async () => {
    expect(await getCoachPublicProfile("", FIXED_NOW)).toBeNull();
    expect(await getCoachPublicProfile("   ", FIXED_NOW)).toBeNull();
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
  });
});

describe("getCoachShowcaseAchievements (S26.3e)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an empty array when the user has no unlocks", async () => {
    mockPrisma.userAchievement.findMany.mockResolvedValue([]);
    const result = await getCoachShowcaseAchievements("u-1");
    expect(result).toEqual([]);
  });

  it("queries userAchievement scoped to userId, sorted desc by unlockedAt, with default limit 6", async () => {
    mockPrisma.userAchievement.findMany.mockResolvedValue([]);
    await getCoachShowcaseAchievements("u-42");
    expect(mockPrisma.userAchievement.findMany).toHaveBeenCalledTimes(1);
    const arg = mockPrisma.userAchievement.findMany.mock.calls[0][0] as {
      where: { userId: string };
      orderBy: { unlockedAt: "asc" | "desc" };
      take: number;
    };
    expect(arg.where).toEqual({ userId: "u-42" });
    expect(arg.orderBy).toEqual({ unlockedAt: "desc" });
    expect(arg.take).toBe(6);
  });

  it("respects a custom limit", async () => {
    mockPrisma.userAchievement.findMany.mockResolvedValue([]);
    await getCoachShowcaseAchievements("u-1", 3);
    const arg = mockPrisma.userAchievement.findMany.mock.calls[0][0] as {
      take: number;
    };
    expect(arg.take).toBe(3);
  });

  it("enriches each unlock with catalog metadata (name, icon, category)", async () => {
    const unlockedAt = new Date("2026-04-15T12:00:00.000Z");
    mockPrisma.userAchievement.findMany.mockResolvedValue([
      { slug: "first-match", unlockedAt },
    ]);
    const result = await getCoachShowcaseAchievements("u-1");
    expect(result.length).toBe(1);
    expect(result[0].slug).toBe("first-match");
    expect(result[0].nameFr.length).toBeGreaterThan(0);
    expect(result[0].icon.length).toBeGreaterThan(0);
    expect(result[0].category.length).toBeGreaterThan(0);
    expect(result[0].unlockedAt).toBe(unlockedAt.toISOString());
  });

  it("silently drops unlocks whose slug is no longer in the catalog (forward-compat)", async () => {
    mockPrisma.userAchievement.findMany.mockResolvedValue([
      {
        slug: "first-match",
        unlockedAt: new Date("2026-04-15T12:00:00.000Z"),
      },
      {
        slug: "ghost-achievement-removed",
        unlockedAt: new Date("2026-04-16T12:00:00.000Z"),
      },
    ]);
    const result = await getCoachShowcaseAchievements("u-1");
    expect(result.length).toBe(1);
    expect(result[0].slug).toBe("first-match");
  });

  it("returns an empty array (no DB call) for empty userId", async () => {
    expect(await getCoachShowcaseAchievements("")).toEqual([]);
    expect(mockPrisma.userAchievement.findMany).not.toHaveBeenCalled();
  });
});

describe("listPublicCoachSlugs (S26.3g)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the list of unique slugs derived from coach names", async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { coachName: "Coach Alpha" },
      { coachName: "Émile" },
      { coachName: "Player One" },
    ]);
    const result = await listPublicCoachSlugs();
    expect(result).toEqual(["coach-alpha", "emile", "player-one"]);
  });

  it("dedupes slugs that collide after normalisation", async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { coachName: "Coach Alpha" },
      { coachName: "coach-alpha" },
      { coachName: "COACH ALPHA" },
    ]);
    const result = await listPublicCoachSlugs();
    expect(result).toEqual(["coach-alpha"]);
  });

  it("filters out coach names whose slug is empty after normalisation", async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { coachName: "Coach Alpha" },
      { coachName: "!!!" },
      { coachName: "" },
    ]);
    const result = await listPublicCoachSlugs();
    expect(result).toEqual(["coach-alpha"]);
  });

  it("queries only valid users and applies the requested limit (default 1000)", async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    await listPublicCoachSlugs();
    const arg = mockPrisma.user.findMany.mock.calls[0][0] as {
      where: { valid: boolean };
      take: number;
    };
    expect(arg.where).toEqual({ valid: true });
    expect(arg.take).toBe(1000);
  });

  it("respects a custom limit", async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    await listPublicCoachSlugs(50);
    const arg = mockPrisma.user.findMany.mock.calls[0][0] as { take: number };
    expect(arg.take).toBe(50);
  });
});

describe("getCoachRecentTeams (S26.3h)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an empty array (no DB call) for empty userId", async () => {
    expect(await getCoachRecentTeams("")).toEqual([]);
    expect(mockPrisma.team.findMany).not.toHaveBeenCalled();
  });

  it("queries teams scoped to ownerId, sorted desc by createdAt, default limit 5", async () => {
    mockPrisma.team.findMany.mockResolvedValue([]);
    await getCoachRecentTeams("u-1");
    expect(mockPrisma.team.findMany).toHaveBeenCalledTimes(1);
    const arg = mockPrisma.team.findMany.mock.calls[0][0] as {
      where: { ownerId: string };
      orderBy: { createdAt: "asc" | "desc" };
      take: number;
    };
    expect(arg.where).toEqual({ ownerId: "u-1" });
    expect(arg.orderBy).toEqual({ createdAt: "desc" });
    expect(arg.take).toBe(5);
  });

  it("respects a custom limit", async () => {
    mockPrisma.team.findMany.mockResolvedValue([]);
    await getCoachRecentTeams("u-1", 10);
    const arg = mockPrisma.team.findMany.mock.calls[0][0] as { take: number };
    expect(arg.take).toBe(10);
  });

  it("maps each team to a public DTO with ISO createdAt", async () => {
    mockPrisma.team.findMany.mockResolvedValue([
      {
        id: "t-1",
        name: "Skaven Stars",
        roster: "skaven",
        currentValue: 1500,
        createdAt: new Date("2026-04-15T12:00:00.000Z"),
      },
    ]);
    const result = await getCoachRecentTeams("u-1");
    expect(result).toEqual([
      {
        id: "t-1",
        name: "Skaven Stars",
        roster: "skaven",
        currentValue: 1500,
        createdAt: "2026-04-15T12:00:00.000Z",
      },
    ]);
  });
});
