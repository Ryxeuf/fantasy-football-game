import { describe, it, expect } from "vitest";
import {
  LEADERBOARD_PAGE_SIZE,
  computeLeaderboardStats,
  formatEloRating,
  getCurrentPage,
  getTotalPages,
  isFirstPage,
  isLastPage,
  parseLeaderboardResponse,
  type LeaderboardEntry,
} from "./leaderboard";

function makeEntry(
  overrides: Partial<LeaderboardEntry> = {},
): LeaderboardEntry {
  return {
    rank: 1,
    userId: "u1",
    coachName: "Coach",
    eloRating: 1500,
    ...overrides,
  };
}

describe("computeLeaderboardStats", () => {
  it("returns zeros for an empty list", () => {
    expect(computeLeaderboardStats([])).toEqual({ top: 0, average: 0 });
  });

  it("returns the top rating as the max of entries", () => {
    const entries = [
      makeEntry({ eloRating: 1500 }),
      makeEntry({ eloRating: 1700 }),
      makeEntry({ eloRating: 1600 }),
    ];
    expect(computeLeaderboardStats(entries).top).toBe(1700);
  });

  it("returns the rounded average rating", () => {
    const entries = [
      makeEntry({ eloRating: 1500 }),
      makeEntry({ eloRating: 1700 }),
      makeEntry({ eloRating: 1601 }),
    ];
    // (1500 + 1700 + 1601) / 3 = 1600.333... → 1600
    expect(computeLeaderboardStats(entries).average).toBe(1600);
  });

  it("handles a single entry", () => {
    const entries = [makeEntry({ eloRating: 1234 })];
    expect(computeLeaderboardStats(entries)).toEqual({
      top: 1234,
      average: 1234,
    });
  });
});

describe("pagination helpers", () => {
  it("getCurrentPage is 1-indexed from offset 0", () => {
    expect(getCurrentPage(0, 20)).toBe(1);
    expect(getCurrentPage(20, 20)).toBe(2);
    expect(getCurrentPage(40, 20)).toBe(3);
  });

  it("getCurrentPage rounds down for partial offsets", () => {
    expect(getCurrentPage(15, 20)).toBe(1);
    expect(getCurrentPage(25, 20)).toBe(2);
  });

  it("getTotalPages returns at least 1", () => {
    expect(getTotalPages(0, 20)).toBe(1);
    expect(getTotalPages(5, 20)).toBe(1);
  });

  it("getTotalPages rounds up for partial results", () => {
    expect(getTotalPages(21, 20)).toBe(2);
    expect(getTotalPages(40, 20)).toBe(2);
    expect(getTotalPages(41, 20)).toBe(3);
  });

  it("isFirstPage is true only when offset is 0", () => {
    expect(isFirstPage(0)).toBe(true);
    expect(isFirstPage(1)).toBe(false);
    expect(isFirstPage(20)).toBe(false);
  });

  it("isLastPage true when offset + pageSize >= total", () => {
    expect(isLastPage(0, 20, 10)).toBe(true);
    expect(isLastPage(0, 20, 20)).toBe(true);
    expect(isLastPage(0, 20, 21)).toBe(false);
    expect(isLastPage(20, 20, 40)).toBe(true);
    expect(isLastPage(20, 20, 41)).toBe(false);
  });
});

describe("formatEloRating", () => {
  it("formats an integer rating as a string", () => {
    expect(formatEloRating(1500)).toBe("1500");
  });

  it("floors non-integer ratings", () => {
    expect(formatEloRating(1500.8)).toBe("1500");
  });
});

describe("parseLeaderboardResponse", () => {
  it("extracts data and meta from a well-formed response", () => {
    const response = {
      success: true,
      data: [
        { rank: 1, userId: "u1", coachName: "A", eloRating: 1700 },
        { rank: 2, userId: "u2", coachName: "B", eloRating: 1600 },
      ],
      meta: { total: 2, limit: 20, offset: 0 },
    };
    const parsed = parseLeaderboardResponse(response);
    expect(parsed.entries).toHaveLength(2);
    expect(parsed.entries[0].coachName).toBe("A");
    expect(parsed.meta).toEqual({ total: 2, limit: 20, offset: 0 });
  });

  it("returns empty entries when data is missing", () => {
    const response = {
      success: true,
      meta: { total: 0, limit: 20, offset: 0 },
    };
    const parsed = parseLeaderboardResponse(response);
    expect(parsed.entries).toEqual([]);
    expect(parsed.meta.total).toBe(0);
  });

  it("fills missing meta with safe defaults", () => {
    const parsed = parseLeaderboardResponse({ data: [] });
    expect(parsed.meta).toEqual({
      total: 0,
      limit: LEADERBOARD_PAGE_SIZE,
      offset: 0,
    });
  });

  it("filters out entries with invalid shape", () => {
    const response = {
      data: [
        { rank: 1, userId: "u1", coachName: "A", eloRating: 1700 },
        null,
        { rank: "bad" },
        { rank: 2, userId: "u2", coachName: "B", eloRating: 1600 },
      ],
      meta: { total: 4, limit: 20, offset: 0 },
    };
    const parsed = parseLeaderboardResponse(response);
    expect(parsed.entries).toHaveLength(2);
    expect(parsed.entries.map((e) => e.userId)).toEqual(["u1", "u2"]);
  });
});

describe("LEADERBOARD_PAGE_SIZE", () => {
  it("is a positive integer", () => {
    expect(Number.isInteger(LEADERBOARD_PAGE_SIZE)).toBe(true);
    expect(LEADERBOARD_PAGE_SIZE).toBeGreaterThan(0);
  });
});
