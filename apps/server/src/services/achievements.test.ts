import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    userAchievement: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
    teamSelection: {
      findMany: vi.fn(),
    },
    friendship: {
      count: vi.fn(),
    },
  },
}));

import { prisma } from "../prisma";
import {
  ACHIEVEMENTS_CATALOG,
  evaluateAchievements,
  unlockAchievements,
  getUserAchievements,
  type UserAchievementStats,
} from "./achievements";

const mockPrisma = prisma as any;

const baseStats = (
  overrides: Partial<UserAchievementStats> = {},
): UserAchievementStats => ({
  matchesPlayed: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  touchdowns: 0,
  casualties: 0,
  friendsCount: 0,
  rostersPlayed: new Set<string>(),
  winsByRoster: new Map<string, number>(),
  ...overrides,
});

describe("Rule: Achievements catalog", () => {
  it("exposes a non-empty catalog with unique slugs", () => {
    expect(ACHIEVEMENTS_CATALOG.length).toBeGreaterThan(0);
    const slugs = ACHIEVEMENTS_CATALOG.map((a) => a.slug);
    const unique = new Set(slugs);
    expect(unique.size).toBe(slugs.length);
  });

  it("every achievement has required i18n fields", () => {
    for (const ach of ACHIEVEMENTS_CATALOG) {
      expect(ach.slug).toMatch(/^[a-z0-9_-]+$/);
      expect(ach.nameFr).toBeTruthy();
      expect(ach.nameEn).toBeTruthy();
      expect(ach.descriptionFr).toBeTruthy();
      expect(ach.descriptionEn).toBeTruthy();
      expect(ach.category).toBeTruthy();
      expect(typeof ach.predicate).toBe("function");
    }
  });

  it("includes one 'first match' achievement", () => {
    const firstMatch = ACHIEVEMENTS_CATALOG.find(
      (a) => a.slug === "first-match",
    );
    expect(firstMatch).toBeDefined();
    expect(firstMatch!.predicate(baseStats({ matchesPlayed: 1 }))).toBe(true);
    expect(firstMatch!.predicate(baseStats({ matchesPlayed: 0 }))).toBe(false);
  });
});

describe("Rule: evaluateAchievements", () => {
  it("returns empty when stats unlock nothing", () => {
    const result = evaluateAchievements(baseStats(), new Set<string>());
    expect(result).toEqual([]);
  });

  it("returns newly-satisfied achievements, ignoring already unlocked", () => {
    const firstMatchSlug = "first-match";
    const result = evaluateAchievements(
      baseStats({ matchesPlayed: 1 }),
      new Set<string>([firstMatchSlug]),
    );
    expect(result).not.toContain(firstMatchSlug);
  });

  it("unlocks all thresholds at once when stats jump", () => {
    const result = evaluateAchievements(
      baseStats({ matchesPlayed: 100, wins: 50 }),
      new Set<string>(),
    );
    expect(result).toContain("first-match");
    expect(result).toContain("matches-10");
    expect(result).toContain("matches-50");
    expect(result).toContain("matches-100");
    expect(result).toContain("first-win");
    expect(result).toContain("wins-10");
    expect(result).toContain("wins-50");
  });

  it("unlocks roster achievements only for rosters actually played", () => {
    const result = evaluateAchievements(
      baseStats({ rostersPlayed: new Set(["skaven", "dwarf"]) }),
      new Set<string>(),
    );
    expect(result).toContain("roster-skaven");
    expect(result).toContain("roster-dwarf");
    expect(result).not.toContain("roster-lizardmen");
  });

  it("unlocks social friends achievement when friends >= 1", () => {
    const result = evaluateAchievements(
      baseStats({ friendsCount: 1 }),
      new Set<string>(),
    );
    expect(result).toContain("first-friend");
  });
});

describe("Rule: Master roster badges (N.8)", () => {
  const PRIORITY = [
    "skaven",
    "lizardmen",
    "dwarf",
    "gnome",
    "imperial_nobility",
  ];

  it("exposes a 'master-<roster>' achievement for each priority team", () => {
    for (const roster of PRIORITY) {
      const ach = ACHIEVEMENTS_CATALOG.find((a) => a.slug === `master-${roster}`);
      expect(ach, `missing master-${roster}`).toBeDefined();
      expect(ach!.category).toBe("rosters");
    }
  });

  it("each master badge requires exactly 5 wins with the roster", () => {
    for (const roster of PRIORITY) {
      const ach = ACHIEVEMENTS_CATALOG.find((a) => a.slug === `master-${roster}`)!;
      expect(
        ach.predicate(
          baseStats({ winsByRoster: new Map([[roster, 4]]) }),
        ),
      ).toBe(false);
      expect(
        ach.predicate(
          baseStats({ winsByRoster: new Map([[roster, 5]]) }),
        ),
      ).toBe(true);
    }
  });

  it("master badge is scoped to its own roster (no cross-counting)", () => {
    const masterSkaven = ACHIEVEMENTS_CATALOG.find(
      (a) => a.slug === "master-skaven",
    )!;
    expect(
      masterSkaven.predicate(
        baseStats({ winsByRoster: new Map([["dwarf", 100]]) }),
      ),
    ).toBe(false);
    expect(
      masterSkaven.predicate(
        baseStats({
          winsByRoster: new Map([
            ["skaven", 5],
            ["dwarf", 0],
          ]),
        }),
      ),
    ).toBe(true);
  });

  it("renames the legacy 'roster-<roster>' badges to 'Pioneer' semantics", () => {
    const pioneer = ACHIEVEMENTS_CATALOG.find((a) => a.slug === "roster-skaven")!;
    expect(pioneer.nameFr.toLowerCase()).toContain("pionnier");
    expect(pioneer.nameEn.toLowerCase()).toContain("pioneer");
    expect(pioneer.predicate(baseStats({ rostersPlayed: new Set(["skaven"]) }))).toBe(
      true,
    );
  });

  it("evaluateAchievements unlocks master badge when wins threshold reached", () => {
    const result = evaluateAchievements(
      baseStats({ winsByRoster: new Map([["skaven", 5]]) }),
      new Set<string>(),
    );
    expect(result).toContain("master-skaven");
    expect(result).not.toContain("master-dwarf");
  });
});

describe("unlockAchievements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no-ops when slugs is empty", async () => {
    await unlockAchievements("user-1", []);
    expect(mockPrisma.userAchievement.createMany).not.toHaveBeenCalled();
  });

  it("persists slugs with skipDuplicates", async () => {
    mockPrisma.userAchievement.createMany.mockResolvedValue({ count: 2 });
    await unlockAchievements("user-1", ["first-match", "first-win"]);
    expect(mockPrisma.userAchievement.createMany).toHaveBeenCalledWith({
      data: [
        { userId: "user-1", slug: "first-match" },
        { userId: "user-1", slug: "first-win" },
      ],
      skipDuplicates: true,
    });
  });
});

describe("getUserAchievements (lazy evaluation)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns every catalog entry with unlocked/locked status", async () => {
    mockPrisma.userAchievement.findMany.mockResolvedValue([
      {
        userId: "user-1",
        slug: "first-match",
        unlockedAt: new Date("2026-04-20"),
      },
    ]);
    mockPrisma.teamSelection.findMany.mockResolvedValue([]);
    mockPrisma.friendship.count.mockResolvedValue(0);
    mockPrisma.userAchievement.createMany.mockResolvedValue({ count: 0 });

    const result = await getUserAchievements("user-1");

    expect(result.achievements.length).toBe(ACHIEVEMENTS_CATALOG.length);
    const firstMatch = result.achievements.find((a) => a.slug === "first-match");
    expect(firstMatch?.unlocked).toBe(true);
    expect(firstMatch?.unlockedAt).toBeInstanceOf(Date);
    const matches10 = result.achievements.find((a) => a.slug === "matches-10");
    expect(matches10?.unlocked).toBe(false);
    expect(matches10?.unlockedAt).toBeNull();
  });

  it("computes winsByRoster per roster for master badges (N.8)", async () => {
    mockPrisma.userAchievement.findMany.mockResolvedValue([]);
    const buildSelection = (
      selId: string,
      roster: string,
      myScore: number,
      oppScore: number,
    ) => ({
      id: selId,
      userId: "user-1",
      teamRef: { roster },
      match: {
        id: `m-${selId}`,
        status: "ended",
        turns: [
          {
            payload: {
              gameState: {
                score: { teamA: myScore, teamB: oppScore },
                players: [],
                matchStats: {},
              },
            },
          },
        ],
        teamSelections: [
          { id: selId, userId: "user-1" },
          { id: `opp-${selId}`, userId: "user-x" },
        ],
      },
    });
    // 3 wins with skaven, 1 loss with skaven, 2 wins with dwarf
    mockPrisma.teamSelection.findMany.mockResolvedValue([
      buildSelection("s1", "skaven", 2, 0),
      buildSelection("s2", "skaven", 3, 1),
      buildSelection("s3", "skaven", 4, 1),
      buildSelection("s4", "skaven", 0, 2),
      buildSelection("s5", "dwarf", 1, 0),
      buildSelection("s6", "dwarf", 2, 1),
    ]);
    mockPrisma.friendship.count.mockResolvedValue(0);
    mockPrisma.userAchievement.createMany.mockResolvedValue({ count: 0 });

    const result = await getUserAchievements("user-1");

    const winsByRoster = result.stats.winsByRoster ?? {};
    expect(winsByRoster.skaven).toBe(3);
    expect(winsByRoster.dwarf).toBe(2);
  });

  it("unlocks new achievements on first read when stats suffice", async () => {
    // No prior unlocks
    mockPrisma.userAchievement.findMany.mockResolvedValueOnce([]);
    // 3 ended matches on side A against B, user won all 3
    mockPrisma.teamSelection.findMany.mockResolvedValue([
      {
        id: "s-1",
        userId: "user-1",
        teamRef: { roster: "skaven" },
        match: {
          id: "m-1",
          status: "ended",
          turns: [
            {
              payload: {
                gameState: {
                  score: { teamA: 2, teamB: 0 },
                  players: [],
                  matchStats: {},
                },
              },
            },
          ],
          teamSelections: [
            { id: "s-1", userId: "user-1" },
            { id: "s-2", userId: "user-x" },
          ],
        },
      },
    ]);
    mockPrisma.friendship.count.mockResolvedValue(0);
    mockPrisma.userAchievement.createMany.mockResolvedValue({ count: 3 });
    // After unlocks, findMany is called again to return the full state
    mockPrisma.userAchievement.findMany.mockResolvedValueOnce([
      { slug: "first-match", unlockedAt: new Date() },
      { slug: "first-win", unlockedAt: new Date() },
      { slug: "roster-skaven", unlockedAt: new Date() },
    ]);

    const result = await getUserAchievements("user-1");

    expect(mockPrisma.userAchievement.createMany).toHaveBeenCalled();
    const call = mockPrisma.userAchievement.createMany.mock.calls[0][0];
    const persistedSlugs = call.data.map((d: { slug: string }) => d.slug);
    expect(persistedSlugs).toContain("first-match");
    expect(persistedSlugs).toContain("first-win");
    expect(persistedSlugs).toContain("roster-skaven");

    const unlocked = result.achievements.filter((a) => a.unlocked).map((a) => a.slug);
    expect(unlocked).toContain("first-match");
    expect(unlocked).toContain("first-win");
    expect(unlocked).toContain("roster-skaven");
  });
});
